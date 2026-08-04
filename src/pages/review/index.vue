<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import ReviewButtons from '@/components/ReviewButtons.vue'
import { useReviewStore } from '@/stores/review'
import { getChapters, getSubjects } from '@/services/subjectService'
import type { ReviewFilter, ReviewRating } from '@/types/review'
import type { Chapter, Subject } from '@/types/subject'

const reviewStore = useReviewStore()
const subjects = ref<Subject[]>([])
const chapters = ref<Chapter[]>([])
const rating = ref(false)

const isFocusedReview = computed(() =>
  Boolean(
    reviewStore.activeFilter.subjectId ||
      reviewStore.activeFilter.chapterId ||
      reviewStore.activeFilter.uncategorizedOnly ||
      reviewStore.activeFilter.tag,
  ),
)
const progressLabel = computed(() => (isFocusedReview.value ? '专项复习' : '今日复习'))

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
  return chapter ? `${subject} · ${chapter}` : `${subject} · 未分类`
})

onLoad(async (query) => {
  ;[subjects.value, chapters.value] = await Promise.all([getSubjects(), getChapters()])
  const filter: ReviewFilter = {
    subjectId: query?.subjectId ? String(query.subjectId) : undefined,
    chapterId: query?.chapterId ? String(query.chapterId) : undefined,
    uncategorizedOnly: query?.uncategorized === '1' || undefined,
    tag: query?.tag ? String(query.tag) : undefined,
  }
  await reviewStore.start(filter, query?.fresh !== '1')
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

async function skipCard(): Promise<void> {
  if (!(await reviewStore.skip())) {
    uni.showToast({ title: '当前只剩这一张卡片', icon: 'none' })
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
      :title="isFocusedReview ? '本次专项复习已完成' : '今天的复习已经完成'"
      :description="reviewStore.total ? `完成了 ${reviewStore.total} 张知识卡` : '当前没有到期卡片或新卡。'"
    >
      <view class="finish-actions">
        <button v-if="reviewStore.canUndo" class="secondary-button" @click="undoLastRating">
          撤销上次评分
        </button>
        <button class="primary-button" @click="goBack">完成并返回</button>
      </view>
    </EmptyState>

    <view v-else-if="reviewStore.currentCard" class="card-stage">
      <view v-if="reviewStore.resumed" class="resume-notice">已恢复上次复习进度</view>
      <text class="breadcrumb">{{ breadcrumb }}</text>
      <view class="review-card surface">
        <text class="card-kicker">问题</text>
        <text class="review-question">{{ reviewStore.currentCard.question }}</text>

        <view v-if="reviewStore.revealed" class="answer-block">
          <view class="divider" />
          <text class="card-kicker">标准答案</text>
          <text class="review-answer">{{ reviewStore.currentCard.answer }}</text>
          <view v-if="reviewStore.currentCard.note" class="note-block">
            <text class="note-label">备注</text>
            <text class="note-copy">{{ reviewStore.currentCard.note }}</text>
          </view>
        </view>
      </view>

      <button
        v-if="!reviewStore.revealed"
        class="primary-button reveal-button"
        @click="reviewStore.reveal"
      >
        显示答案
      </button>
      <view v-if="!reviewStore.revealed" class="session-actions">
        <button class="text-button" @click="skipCard">稍后再答</button>
        <button v-if="reviewStore.canUndo" class="text-button" @click="undoLastRating">
          撤销上次评分
        </button>
      </view>
      <ReviewButtons
        v-else
        :previews="reviewStore.previews"
        :class="{ disabled: rating }"
        @rate="rateCard"
      />
      <view v-if="reviewStore.revealed && reviewStore.canUndo" class="session-actions">
        <button class="text-button" @click="undoLastRating">撤销上次评分</button>
      </view>
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
  background: #ded8ce;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--color-accent) 0%, var(--color-primary) 100%);
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
  border: 1rpx solid #cbdad2;
  border-radius: 14rpx;
  background: #edf5f0;
  color: var(--color-primary);
  font-size: 22rpx;
  text-align: center;
}

.finish-actions {
  display: flex;
  width: 100%;
  max-width: 520rpx;
  margin-top: 30rpx;
  flex-direction: column;
  gap: 14rpx;
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

.review-card {
  min-height: 570rpx;
  padding: 48rpx 38rpx;
  border-top: 6rpx solid var(--color-accent);
}

.card-kicker {
  display: block;
  color: var(--color-primary);
  font-size: 21rpx;
  font-weight: 750;
  letter-spacing: 2rpx;
}

.review-question,
.review-answer {
  display: block;
  white-space: pre-wrap;
}

.review-question {
  margin-top: 28rpx;
  font-size: 38rpx;
  color: var(--color-text);
  font-weight: 780;
  line-height: 1.65;
}

.answer-block {
  margin-top: 44rpx;
}

.divider {
  width: 100%;
  height: 1rpx;
  margin-bottom: 40rpx;
  background: var(--color-line);
}

.review-answer {
  margin-top: 24rpx;
  color: #394139;
  font-size: 30rpx;
  line-height: 1.8;
}

.note-block {
  margin-top: 32rpx;
  padding: 22rpx;
  border-radius: 16rpx;
  border-left: 4rpx solid #d7b18f;
  background: #faf3eb;
}

.note-label,
.note-copy {
  display: block;
}

.note-label {
  color: var(--color-accent);
  font-size: 21rpx;
}

.note-copy {
  margin-top: 9rpx;
  color: #5e625b;
  font-size: 24rpx;
  line-height: 1.65;
}

.reveal-button {
  width: 100%;
  margin-top: 26rpx;
}

.disabled {
  margin-top: 24rpx;
  opacity: 0.55;
  pointer-events: none;
}

.review-buttons {
  margin-top: 24rpx;
}

.session-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  margin-top: 12rpx;
}
</style>
