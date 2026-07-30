<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import ReviewButtons from '@/components/ReviewButtons.vue'
import { useReviewStore } from '@/stores/review'
import { getChapters, getSubjects } from '@/services/subjectService'
import type { ReviewRating } from '@/types/review'
import type { Chapter, Subject } from '@/types/subject'

const reviewStore = useReviewStore()
const subjects = ref<Subject[]>([])
const chapters = ref<Chapter[]>([])
const rating = ref(false)

const progress = computed(() =>
  reviewStore.total ? Math.round((reviewStore.completed / reviewStore.total) * 100) : 0,
)
const breadcrumb = computed(() => {
  const card = reviewStore.currentCard
  if (!card) return ''
  const subject = subjects.value.find((item) => item.id === card.subjectId)?.name ?? '未命名科目'
  const chapter = chapters.value.find((item) => item.id === card.chapterId)?.name
  return chapter ? `${subject} · ${chapter}` : `${subject} · 未分类`
})

onLoad(async () => {
  ;[subjects.value, chapters.value] = await Promise.all([getSubjects(), getChapters()])
  await reviewStore.start()
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

function goBack(): void {
  uni.navigateBack()
}
</script>

<template>
  <view class="review-page safe-top">
    <view class="review-header">
      <button class="close-button" @click="goBack">×</button>
      <view class="progress-copy">
        <text class="progress-count">
          {{ Math.min(reviewStore.completed + 1, reviewStore.total) }} / {{ reviewStore.total }}
        </text>
        <view class="progress-track">
          <view class="progress-fill" :style="{ width: `${progress}%` }" />
        </view>
      </view>
      <view class="header-space" />
    </view>

    <view v-if="reviewStore.loading" class="loading-copy">正在准备今日复习…</view>

    <EmptyState
      v-else-if="reviewStore.finished"
      title="今天的复习已经完成"
      :description="reviewStore.total ? `完成了 ${reviewStore.total} 张知识卡` : '当前没有到期卡片或新卡。'"
    >
      <button class="primary-button finish-button" @click="goBack">返回首页</button>
    </EmptyState>

    <view v-else-if="reviewStore.currentCard" class="card-stage">
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
      <ReviewButtons
        v-else
        :previews="reviewStore.previews"
        :class="{ disabled: rating }"
        @rate="rateCard"
      />
    </view>
  </view>
</template>

<style scoped>
.review-page {
  width: 100%;
  max-width: 920rpx;
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
  background: #e9ede9;
  color: #5f6c65;
  font-size: 44rpx;
  font-weight: 350;
}

.progress-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}

.progress-count {
  color: #65716a;
  font-size: 23rpx;
  font-weight: 650;
}

.progress-track {
  width: 100%;
  height: 8rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #dfe6e1;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: #3e795f;
  transition: width 180ms ease;
}

.header-space {
  width: 66rpx;
}

.loading-copy {
  padding: 180rpx 0;
  color: #7d8781;
  text-align: center;
}

.finish-button {
  margin-top: 30rpx;
}

.card-stage {
  padding-top: 28rpx;
}

.breadcrumb {
  display: block;
  margin-bottom: 18rpx;
  color: #738078;
  font-size: 23rpx;
  text-align: center;
}

.review-card {
  min-height: 610rpx;
  padding: 48rpx 38rpx;
}

.card-kicker {
  display: block;
  color: #5c796b;
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
  font-weight: 760;
  line-height: 1.65;
}

.answer-block {
  margin-top: 44rpx;
}

.divider {
  width: 100%;
  height: 1rpx;
  margin-bottom: 40rpx;
  background: #e4e9e5;
}

.review-answer {
  margin-top: 24rpx;
  color: #34433b;
  font-size: 30rpx;
  line-height: 1.8;
}

.note-block {
  margin-top: 32rpx;
  padding: 22rpx;
  border-radius: 16rpx;
  background: #f3f5f2;
}

.note-label,
.note-copy {
  display: block;
}

.note-label {
  color: #78827c;
  font-size: 21rpx;
}

.note-copy {
  margin-top: 9rpx;
  color: #57635c;
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
</style>
