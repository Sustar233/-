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
const progressLabel = computed(() => (isFocusedReview.value ? '路径学习' : '今日复习'))

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
      :title="isFocusedReview ? '本次路径学习已完成' : '今天的复习已经完成'"
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

      <view class="phase-track" :class="{ 'review-only': !reviewStore.currentIsNew }">
        <view class="phase-item" :class="{ active: reviewStore.learning, done: !reviewStore.learning }">
          <text class="phase-number">1</text>
          <text>理解</text>
        </view>
        <view class="phase-line" />
        <view
          class="phase-item"
          :class="{ active: !reviewStore.learning && !reviewStore.revealed, done: reviewStore.revealed }"
        >
          <text class="phase-number">2</text>
          <text>回忆</text>
        </view>
        <view class="phase-line" />
        <view class="phase-item" :class="{ active: reviewStore.revealed }">
          <text class="phase-number">3</text>
          <text>校准</text>
        </view>
      </view>

      <template v-if="reviewStore.learning">
        <view class="learning-notice surface">
          <text class="learning-label">新知识 · 先学后背</text>
          <text class="learning-copy">先弄清它从哪里来、与什么相关，再进入遮住答案的主动回忆。</text>
        </view>

        <view v-if="reviewStore.contextCards.length" class="context-panel surface">
          <view class="context-heading">
            <text class="context-title">
              {{ reviewStore.currentCard.parentCardId ? '前置知识路径' : '章节上下文' }}
            </text>
            <text class="context-count">{{ reviewStore.contextCards.length }} 个节点</text>
          </view>
          <view
            v-for="(contextCard, index) in reviewStore.contextCards"
            :key="contextCard.id"
            class="context-node"
          >
            <view class="node-rail">
              <text class="node-dot">{{ index + 1 }}</text>
              <view v-if="index < reviewStore.contextCards.length - 1" class="node-line" />
            </view>
            <view class="node-copy">
              <text class="node-question">{{ contextCard.question }}</text>
              <text class="node-answer">{{ contextCard.answer }}</text>
            </view>
          </view>
        </view>

        <view class="review-card learning-card surface">
          <text class="card-kicker">当前知识</text>
          <text class="review-question">{{ reviewStore.currentCard.question }}</text>
          <view class="answer-block learning-answer">
            <view class="divider" />
            <text class="card-kicker">理解答案</text>
            <text class="review-answer">{{ reviewStore.currentCard.answer }}</text>
            <view v-if="reviewStore.currentCard.connection" class="connection-block">
              <text class="connection-label">知识连接</text>
              <text class="connection-copy">{{ reviewStore.currentCard.connection }}</text>
            </view>
            <view v-if="reviewStore.currentCard.note" class="note-block">
              <text class="note-label">备注</text>
              <text class="note-copy">{{ reviewStore.currentCard.note }}</text>
            </view>
          </view>
        </view>

        <button class="primary-button reveal-button" @click="reviewStore.beginRecall">
          我已理解，开始回忆
        </button>
      </template>

      <template v-else>
        <view class="review-card surface">
          <text class="card-kicker">问题</text>
          <text class="review-question">{{ reviewStore.currentCard.question }}</text>

          <view v-if="reviewStore.contextRevealed" class="inline-context">
            <text class="inline-context-label">脉络提示</text>
            <view
              v-for="contextCard in reviewStore.contextCards"
              :key="contextCard.id"
              class="inline-context-item"
            >
              <text class="inline-context-question">{{ contextCard.question }}</text>
              <text class="inline-context-answer">{{ contextCard.answer }}</text>
            </view>
          </view>

          <view v-if="reviewStore.revealed" class="answer-block">
            <view class="divider" />
            <text class="card-kicker">标准答案</text>
            <text class="review-answer">{{ reviewStore.currentCard.answer }}</text>
            <view v-if="reviewStore.currentCard.connection" class="connection-block">
              <text class="connection-label">知识连接</text>
              <text class="connection-copy">{{ reviewStore.currentCard.connection }}</text>
            </view>
            <view v-if="reviewStore.currentCard.note" class="note-block">
              <text class="note-label">备注</text>
              <text class="note-copy">{{ reviewStore.currentCard.note }}</text>
            </view>
          </view>
        </view>

        <button
          v-if="!reviewStore.revealed && reviewStore.contextCards.length && !reviewStore.contextRevealed"
          class="secondary-button context-button"
          @click="reviewStore.showContext"
        >
          想不起上文？查看脉络提示
        </button>
        <text v-if="!reviewStore.revealed && reviewStore.contextRevealed" class="hint-advice">
          已使用提示；评分时请如实选择“重来”或“困难”。
        </text>
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
      </template>
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
  background: rgba(167, 184, 197, 0.18);
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--color-accent) 0%, var(--color-primary) 100%);
  box-shadow: 0 0 14rpx rgba(103, 216, 197, 0.38);
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
  border: 1rpx solid rgba(103, 216, 197, 0.32);
  border-radius: 14rpx;
  background: rgba(54, 143, 132, 0.14);
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

.phase-track {
  display: flex;
  max-width: 600rpx;
  margin: 0 auto 24rpx;
  align-items: center;
  justify-content: center;
}

.phase-item {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8rpx;
  color: var(--color-subtle);
  font-size: 20rpx;
}

.phase-number {
  display: flex;
  width: 34rpx;
  height: 34rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(120, 139, 156, 0.45);
  border-radius: 50%;
  font-size: 18rpx;
}

.phase-item.active {
  color: var(--color-primary);
  font-weight: 720;
}

.phase-item.active .phase-number {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.phase-item.done {
  color: var(--color-accent);
}

.phase-item.done .phase-number {
  border-color: rgba(215, 173, 102, 0.7);
  background: var(--color-accent-soft);
}

.phase-line {
  width: 46rpx;
  height: 1rpx;
  margin: 0 12rpx;
  background: var(--color-line);
}

.review-only .phase-item:first-child {
  opacity: 0.62;
}

.learning-notice {
  margin-bottom: 20rpx;
  padding: 22rpx 24rpx;
  border-left: 5rpx solid var(--color-primary);
}

.learning-label,
.learning-copy {
  display: block;
}

.learning-label {
  color: var(--color-primary);
  font-size: 23rpx;
  font-weight: 750;
}

.learning-copy {
  margin-top: 8rpx;
  color: var(--color-muted);
  font-size: 22rpx;
  line-height: 1.65;
}

.context-panel {
  margin-bottom: 20rpx;
  padding: 26rpx 24rpx 18rpx;
}

.context-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22rpx;
}

.context-title {
  color: var(--color-accent);
  font-size: 25rpx;
  font-weight: 740;
}

.context-count {
  color: var(--color-subtle);
  font-size: 20rpx;
}

.context-node {
  display: flex;
  gap: 16rpx;
}

.node-rail {
  display: flex;
  width: 34rpx;
  flex: 0 0 34rpx;
  align-items: center;
  flex-direction: column;
}

.node-dot {
  display: flex;
  width: 30rpx;
  height: 30rpx;
  flex: 0 0 30rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(215, 173, 102, 0.62);
  border-radius: 50%;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-size: 17rpx;
}

.node-line {
  width: 1rpx;
  min-height: 50rpx;
  flex: 1;
  background: rgba(215, 173, 102, 0.38);
}

.node-copy {
  min-width: 0;
  padding-bottom: 22rpx;
}

.node-question,
.node-answer {
  display: block;
}

.node-question {
  color: var(--color-text);
  font-size: 23rpx;
  font-weight: 680;
  line-height: 1.5;
}

.node-answer {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 6rpx;
  color: var(--color-muted);
  font-size: 21rpx;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.review-card {
  min-height: 570rpx;
  padding: 48rpx 38rpx;
  border-top: 6rpx solid var(--color-accent);
  background:
    radial-gradient(circle at 86% 12%, rgba(215, 173, 102, 0.12) 0, transparent 24%),
    linear-gradient(145deg, rgba(12, 39, 65, 0.98), rgba(7, 27, 48, 0.98));
}

.learning-card {
  min-height: 0;
  border-top-color: var(--color-primary);
}

.learning-answer {
  margin-top: 34rpx;
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

.connection-block {
  margin-top: 28rpx;
  padding: 20rpx 22rpx;
  border-left: 4rpx solid var(--color-primary);
  border-radius: 16rpx;
  background: var(--color-primary-soft);
}

.connection-label,
.connection-copy {
  display: block;
}

.connection-label {
  color: var(--color-primary);
  font-size: 21rpx;
}

.connection-copy {
  margin-top: 8rpx;
  color: #dce8e3;
  font-size: 24rpx;
  line-height: 1.65;
}

.inline-context {
  margin-top: 32rpx;
  padding: 22rpx;
  border: 1rpx solid rgba(103, 216, 197, 0.28);
  border-radius: 16rpx;
  background: rgba(54, 143, 132, 0.1);
}

.inline-context-label {
  display: block;
  margin-bottom: 16rpx;
  color: var(--color-primary);
  font-size: 21rpx;
  font-weight: 740;
}

.inline-context-item + .inline-context-item {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid rgba(103, 216, 197, 0.16);
}

.inline-context-question,
.inline-context-answer {
  display: block;
}

.inline-context-question {
  color: var(--color-text);
  font-size: 22rpx;
  font-weight: 680;
  line-height: 1.5;
}

.inline-context-answer {
  margin-top: 7rpx;
  color: var(--color-muted);
  font-size: 21rpx;
  line-height: 1.55;
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
  color: #e3e9e5;
  font-size: 30rpx;
  line-height: 1.8;
}

.note-block {
  margin-top: 32rpx;
  padding: 22rpx;
  border-radius: 16rpx;
  border-left: 4rpx solid var(--color-accent);
  background: rgba(215, 173, 102, 0.1);
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
  color: var(--color-muted);
  font-size: 24rpx;
  line-height: 1.65;
}

.reveal-button {
  width: 100%;
  margin-top: 26rpx;
}

.context-button {
  width: 100%;
  margin-top: 22rpx;
}

.hint-advice {
  display: block;
  margin-top: 18rpx;
  color: var(--color-accent);
  font-size: 21rpx;
  line-height: 1.55;
  text-align: center;
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
