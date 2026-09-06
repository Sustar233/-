<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import LoadErrorState from '@/components/LoadErrorState.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import LearningPreviewPanel from '@/components/LearningPreviewPanel.vue'
import LearningSectionPrompt from '@/components/LearningSectionPrompt.vue'
import ReviewContinuationActions from '@/components/ReviewContinuationActions.vue'
import ReviewQuestionPanel from '@/components/ReviewQuestionPanel.vue'
import { useReviewStore } from '@/stores/review'
import type { ReviewFilter, ReviewRating } from '@/types/review'
import { reviewFilterFromQuery } from '@/utils/reviewFilter'

const reviewStore = useReviewStore()
const { running: busy, run } = useAsyncAction()
const loadError = ref(false)
let initialQuery: Record<string, string | string[] | undefined> = {}

const isFocusedReview = computed(() =>
  Boolean(
    reviewStore.activeFilter.subjectId ||
      reviewStore.activeFilter.chapterId ||
      reviewStore.activeFilter.uncategorizedOnly ||
      reviewStore.activeFilter.tag,
  ),
)
async function load(): Promise<void> {
  loadError.value = false
  const query = initialQuery
  const filter: ReviewFilter = reviewFilterFromQuery(query)
  if (!filter.subjectId) {
    uni.redirectTo({ url: '/pages/study/index' })
    return
  }
  try {
    await reviewStore.start(filter, query.fresh !== '1')
    const todayMode = Array.isArray(query.today) ? query.today[0] : query.today
    if (todayMode === 'all' || todayMode === 'wrong') {
      const count = await reviewStore.startTodayReview(todayMode === 'wrong')
      if (!count) {
        await reviewStore.finishSession()
        uni.showToast({ title: todayMode === 'wrong' ? '今天还没有背错的知识' : '今天还没有复习记录', icon: 'none' })
      }
    }
  } catch {
    loadError.value = true
  }
}

onLoad((query) => { initialQuery = query ?? {}; void load() })

async function rateCard(value: ReviewRating): Promise<void> {
  await run(() => reviewStore.rate(value))
}

async function startBatchRecall(): Promise<void> {
  await run(() => reviewStore.beginRecall())
}

async function undoLastRating(): Promise<void> {
  await run(async () => {
    if (!(await reviewStore.undoLast())) uni.showToast({ title: '没有可撤销的评分', icon: 'none' })
  })
}

async function startNextStudy(): Promise<void> {
  await run(() => reviewStore.startNextStudy())
}

async function reviewWrongCards(): Promise<void> {
  await run(async () => {
    if (!(await reviewStore.startTodayReview(true))) uni.showToast({ title: '今天还没有背错的知识', icon: 'none' })
  })
}

async function goBack(): Promise<void> {
  if (reviewStore.loading) return
  await run(async () => {
    if (!loadError.value && reviewStore.finished) await reviewStore.finishSession()
    uni.navigateBack()
  })
}
</script>

<template>
  <view class="review-page safe-top">
    <view class="review-header">
      <button class="close-button" :disabled="busy || reviewStore.loading" aria-label="退出复习" @click="goBack">×</button>
      <view class="progress-copy">
        <view class="progress-meta">
          <text class="progress-count">
            {{ reviewStore.progressCurrent }} / {{ reviewStore.total }}
          </text>
        </view>
        <view class="progress-track">
          <view
            class="progress-fill remembered"
            :style="{ width: reviewStore.progressWidths.remembered }"
          />
          <view
            class="progress-fill forgotten"
            :style="{ width: reviewStore.progressWidths.forgotten }"
          />
        </view>
      </view>
      <view class="header-space" />
    </view>

    <LoadErrorState v-if="loadError" @retry="load" />
    <view v-else-if="reviewStore.loading" class="loading-copy">正在准备今日复习…</view>

    <EmptyState
      v-else-if="reviewStore.finished"
      :title="
        reviewStore.sessionMode === 'practice'
          ? '本次主动练习已完成'
          : isFocusedReview
            ? '本次路径学习已完成'
            : '今天的复习已经完成'
      "
      :description="reviewStore.sessionCardCount ? `完成了 ${reviewStore.sessionCardCount} 张知识卡` : '当前没有到期卡片或新卡。'"
    >
      <ReviewContinuationActions
        :loading="busy"
        :next-label="reviewStore.nextStudyLabel"
        :can-undo="reviewStore.canUndo && !busy"
        back-label="完成并返回"
        @next-study="startNextStudy"
        @review="reviewWrongCards"
        @undo="undoLastRating"
        @back="goBack"
      />
    </EmptyState>

    <view v-else-if="reviewStore.currentCard" class="card-stage">
      <view v-if="reviewStore.resumed" class="resume-notice">已恢复上次复习进度</view>

      <LearningSectionPrompt
        v-if="reviewStore.sectionPrompt"
        :title="reviewStore.currentSectionTitle"
        :count="reviewStore.learningBatch.length"
        :loading="busy"
        @preview="reviewStore.previewSection"
        @skip="startBatchRecall"
      />

      <LearningPreviewPanel
        v-else-if="reviewStore.learning"
        :cards="reviewStore.learningBatch"
        :title="reviewStore.currentSectionTitle"
        :loading="busy"
        @begin="startBatchRecall"
      />

      <ReviewQuestionPanel
        v-else
        :card="reviewStore.currentCard"
        :context-cards="reviewStore.contextCards"
        :context-revealed="reviewStore.contextRevealed"
        :revealed="reviewStore.revealed"
        :practice="reviewStore.sessionMode === 'practice'"
        :rating="busy"
        :can-undo="reviewStore.canUndo && !busy"
        :show-simple="reviewStore.canMarkCurrentEasy"
        @show-context="reviewStore.showContext"
        @reveal="reviewStore.reveal"
        @rate="rateCard"
        @undo="undoLastRating"
      />
    </view>
  </view>
</template>

<style scoped>
.review-page {
  width: 100%;
  max-width: 860rpx;
  min-height: 100vh;
  margin: 0 auto;
  padding-right: 28rpx;
  padding-bottom: 44rpx;
  padding-left: 28rpx;
}

.review-header {
  display: flex;
  height: 100rpx;
  align-items: center;
  gap: 22rpx;
}

.close-button {
  display: flex;
  width: 66rpx;
  height: 66rpx;
  padding: 0;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1rpx solid var(--color-line);
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 44rpx;
  font-weight: 350;
}

.progress-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 9rpx;
}

.progress-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.progress-count {
  color: var(--color-primary);
  font-size: 23rpx;
  font-weight: 720;
}

.progress-track {
  display: flex;
  width: 100%;
  height: 10rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #e4e7e3;
}

.progress-fill {
  height: 100%;
  flex: 0 0 auto;
  transition: width 180ms ease;
}

.progress-fill.remembered {
  background: var(--color-primary);
}

.progress-fill.forgotten {
  background: #d88a32;
}

.header-space {
  width: 66rpx;
}

.loading-copy {
  padding: 180rpx 0;
  color: var(--color-muted);
  text-align: center;
}

.resume-notice {
  margin: 8rpx 0 14rpx;
  padding: 13rpx 18rpx;
  border: 1rpx solid #ccddd4;
  border-radius: 14rpx;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 22rpx;
  text-align: center;
}

.card-stage {
  padding-top: 24rpx;
}

</style>
