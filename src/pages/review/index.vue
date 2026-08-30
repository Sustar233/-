<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import LearningPreviewPanel from '@/components/LearningPreviewPanel.vue'
import LearningSectionPrompt from '@/components/LearningSectionPrompt.vue'
import ReviewContinuationActions from '@/components/ReviewContinuationActions.vue'
import ReviewQuestionPanel from '@/components/ReviewQuestionPanel.vue'
import { useReviewStore } from '@/stores/review'
import { getChapters, getSubjects } from '@/services/subjectService'
import type { ReviewFilter, ReviewRating } from '@/types/review'
import type { Chapter, Subject } from '@/types/subject'
import { reviewFilterFromQuery } from '@/utils/reviewFilter'

const reviewStore = useReviewStore()
const subjects = ref<Subject[]>([])
const chapters = ref<Chapter[]>([])
const rating = ref(false)
const startingRecall = ref(false)
const continuing = ref(false)

const isFocusedReview = computed(() =>
  Boolean(
    reviewStore.activeFilter.subjectId ||
      reviewStore.activeFilter.chapterId ||
      reviewStore.activeFilter.uncategorizedOnly ||
      reviewStore.activeFilter.tag,
  ),
)
const progressLabel = computed(() => {
  if (reviewStore.isReinforcement) return '巩固背记'
  if (reviewStore.sessionMode === 'practice') return '主动练习'
  if (
    reviewStore.sectionPrompt ||
    reviewStore.learning ||
    reviewStore.canMarkCurrentEasy
  ) {
    return '小节学习'
  }
  return isFocusedReview.value ? '路径学习' : '今日复习'
})

const progress = computed(() =>
  reviewStore.total
    ? Math.round((Math.min(reviewStore.completed + 1, reviewStore.total) / reviewStore.total) * 100)
    : 0,
)
const breadcrumb = computed(() => {
  const card = reviewStore.currentCard
  if (!card) return ''
  const subject = subjects.value.find((item) => item.id === card.subjectId)?.name ?? '未命名科目'
  const chapter = chapters.value.find((item) => item.id === card.chapterId)?.name
  return [subject, chapter ?? '未分类', card.sectionTitle].filter(Boolean).join(' · ')
})

onLoad(async (query) => {
  ;[subjects.value, chapters.value] = await Promise.all([getSubjects(), getChapters()])
  const filter: ReviewFilter = reviewFilterFromQuery(query)
  if (!filter.subjectId) {
    uni.redirectTo({ url: '/pages/study/index' })
    return
  }
  await reviewStore.start(filter, query?.fresh !== '1')
  const todayMode = Array.isArray(query?.today) ? query.today[0] : query?.today
  if (todayMode === 'all' || todayMode === 'wrong') {
    const count = await reviewStore.startTodayReview(todayMode === 'wrong')
    if (!count) {
      await reviewStore.finishSession()
      uni.showToast({
        title: todayMode === 'wrong' ? '今天还没有背错的知识' : '今天还没有复习记录',
        icon: 'none',
      })
    }
  }
})

async function rateCard(value: ReviewRating): Promise<void> {
  if (rating.value) return
  rating.value = true
  try {
    await reviewStore.rate(value)
  } catch (error) {
    uni.showToast({ title: (error as Error).message, icon: 'none' })
  } finally {
    rating.value = false
  }
}

async function startBatchRecall(): Promise<void> {
  if (startingRecall.value) return
  startingRecall.value = true
  try {
    await reviewStore.beginRecall()
  } catch (error) {
    uni.showToast({ title: (error as Error).message, icon: 'none' })
  } finally {
    startingRecall.value = false
  }
}

async function undoLastRating(): Promise<void> {
  try {
    if (!(await reviewStore.undoLast())) {
      uni.showToast({ title: '没有可撤销的评分', icon: 'none' })
    }
  } catch (error) {
    uni.showToast({ title: (error as Error).message, icon: 'none' })
  }
}

async function startNextSection(): Promise<void> {
  if (continuing.value) return
  continuing.value = true
  try {
    const count = await reviewStore.startNextSection()
    if (!count) uni.showToast({ title: '当前范围内没有下一小节', icon: 'none' })
  } catch (error) {
    uni.showToast({ title: (error as Error).message, icon: 'none' })
  } finally {
    continuing.value = false
  }
}

async function reviewWrongCards(): Promise<void> {
  if (continuing.value) return
  continuing.value = true
  try {
    const count = await reviewStore.startTodayReview(true)
    if (!count) {
      uni.showToast({ title: '今天还没有背错的知识', icon: 'none' })
    }
  } catch (error) {
    uni.showToast({ title: (error as Error).message, icon: 'none' })
  } finally {
    continuing.value = false
  }
}

async function goBack(): Promise<void> {
  if (reviewStore.finished) await reviewStore.finishSession()
  uni.navigateBack()
}
</script>

<template>
  <view class="review-page safe-top">
    <view class="review-header">
      <button class="close-button" aria-label="退出复习" @click="goBack">×</button>
      <view class="progress-copy">
        <view class="progress-meta">
          <text class="progress-label">{{ progressLabel }}</text>
          <text class="progress-count">
            {{ Math.min(reviewStore.completed + 1, reviewStore.total) }} / {{ reviewStore.total }}
          </text>
        </view>
        <view class="progress-track">
          <view class="progress-fill" :style="{ width: `${progress}%` }" />
        </view>
      </view>
      <view class="header-space" />
    </view>

    <view v-if="reviewStore.loading" class="loading-copy">正在准备今日复习…</view>

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
        :loading="continuing"
        :can-undo="reviewStore.canUndo"
        back-label="完成并返回"
        @undo="undoLastRating"
        @next-section="startNextSection"
        @review="reviewWrongCards"
        @back="goBack"
      />
    </EmptyState>

    <view v-else-if="reviewStore.currentCard" class="card-stage">
      <view v-if="reviewStore.resumed" class="resume-notice">已恢复上次复习进度</view>
      <text class="breadcrumb">{{ breadcrumb }}</text>

      <LearningSectionPrompt
        v-if="reviewStore.sectionPrompt"
        :title="reviewStore.currentSectionTitle"
        :count="reviewStore.learningBatch.length"
        :loading="startingRecall"
        @preview="reviewStore.previewSection"
        @skip="startBatchRecall"
      />

      <LearningPreviewPanel
        v-else-if="reviewStore.learning"
        :cards="reviewStore.learningBatch"
        :title="reviewStore.currentSectionTitle"
        :loading="startingRecall"
        @begin="startBatchRecall"
      />

      <ReviewQuestionPanel
        v-else
        :card="reviewStore.currentCard"
        :context-cards="reviewStore.contextCards"
        :context-revealed="reviewStore.contextRevealed"
        :revealed="reviewStore.revealed"
        :practice="reviewStore.sessionMode === 'practice'"
        :rating="rating"
        :can-undo="reviewStore.canUndo"
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
  justify-content: space-between;
}

.progress-label {
  color: var(--color-muted);
  font-size: 21rpx;
}

.progress-count {
  color: var(--color-primary);
  font-size: 23rpx;
  font-weight: 720;
}

.progress-track {
  width: 100%;
  height: 8rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #e4e7e3;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
  transition: width 180ms ease;
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

.breadcrumb {
  display: block;
  margin-bottom: 18rpx;
  color: var(--color-muted);
  font-size: 23rpx;
  text-align: center;
}

</style>
