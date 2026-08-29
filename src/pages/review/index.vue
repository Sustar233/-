<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import ReviewButtons from '@/components/ReviewButtons.vue'
import { useReviewStore } from '@/stores/review'
import { getChapters, getSubjects } from '@/services/subjectService'
import type { ReviewFilter, ReviewRating } from '@/types/review'
import type { Chapter, Subject } from '@/types/subject'
import { reviewFilterFromQuery } from '@/utils/reviewFilter'

const reviewStore = useReviewStore()
const subjects = ref<Subject[]>([])
const chapters = ref<Chapter[]>([])
const rating = ref(false)
const noteVisible = ref(false)
const startingRecall = ref(false)
const continuing = ref(false)
const clock = ref(Date.now())
let retryTimer: ReturnType<typeof setTimeout> | undefined

const isFocusedReview = computed(() =>
  Boolean(
    reviewStore.activeFilter.subjectId ||
      reviewStore.activeFilter.chapterId ||
      reviewStore.activeFilter.uncategorizedOnly ||
      reviewStore.activeFilter.tag,
  ),
)
const progressLabel = computed(() => {
  if (reviewStore.sessionMode === 'practice') return '主动练习'
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
  return chapter ? `${subject} · ${chapter}` : `${subject} · 未分类`
})
const waitingForRetry = computed(
  () => Boolean(reviewStore.currentRetryDueAt && reviewStore.currentRetryDueAt > clock.value),
)

onUnmounted(() => {
  if (retryTimer) clearTimeout(retryTimer)
})

watch(
  () => reviewStore.currentRetryDueAt,
  (dueAt) => {
    if (retryTimer) clearTimeout(retryTimer)
    clock.value = Date.now()
    if (!dueAt || dueAt <= clock.value) return
    retryTimer = setTimeout(() => {
      clock.value = Date.now()
    }, dueAt - clock.value + 50)
  },
  { immediate: true },
)

watch(
  () => reviewStore.currentCard?.id,
  () => {
    noteVisible.value = false
  },
)

onLoad(async (query) => {
  ;[subjects.value, chapters.value] = await Promise.all([getSubjects(), getChapters()])
  const filter: ReviewFilter = reviewFilterFromQuery(query)
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

async function learnMore(): Promise<void> {
  if (continuing.value) return
  continuing.value = true
  try {
    const count = await reviewStore.startMoreNewCards(20)
    if (!count) uni.showToast({ title: '当前范围内没有更多新卡', icon: 'none' })
  } catch (error) {
    uni.showToast({ title: (error as Error).message, icon: 'none' })
  } finally {
    continuing.value = false
  }
}

async function reviewToday(wrongOnly = false): Promise<void> {
  if (continuing.value) return
  continuing.value = true
  try {
    const count = await reviewStore.startTodayReview(wrongOnly)
    if (!count) {
      uni.showToast({
        title: wrongOnly ? '今天还没有背错的知识' : '今天还没有复习记录',
        icon: 'none',
      })
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
      <view class="finish-actions">
        <button v-if="reviewStore.canUndo" class="secondary-button" @click="undoLastRating">
          撤销上次评分
        </button>
        <button
          class="primary-button"
          :loading="continuing"
          :disabled="continuing"
          @click="learnMore"
        >
          继续学习 20 张
        </button>
        <button
          class="secondary-button"
          :disabled="continuing"
          @click="reviewToday(true)"
        >
          复习今日错题
        </button>
        <button
          class="secondary-button"
          :disabled="continuing"
          @click="reviewToday(false)"
        >
          复习今日知识
        </button>
        <button class="text-button" :disabled="continuing" @click="goBack">完成并返回</button>
      </view>
    </EmptyState>

    <view v-else-if="reviewStore.currentCard" class="card-stage">
      <view v-if="reviewStore.resumed" class="resume-notice">已恢复上次复习进度</view>
      <text class="breadcrumb">{{ breadcrumb }}</text>

      <view v-if="waitingForRetry" class="retry-wait surface">
        <text class="retry-label">当前卡片正在巩固间隔中</text>
        <text class="retry-note">
          到期后会自动再次出现；现在也可以继续学习后面的知识，或主动复习今天的内容。
        </text>
        <view class="retry-actions">
          <button
            class="primary-button"
            :loading="continuing"
            :disabled="continuing"
            @click="learnMore"
          >
            继续学习 20 张
          </button>
          <button class="secondary-button" :disabled="continuing" @click="reviewToday(true)">
            复习今日错题
          </button>
          <button class="secondary-button" :disabled="continuing" @click="reviewToday(false)">
            复习今日知识
          </button>
          <button class="text-button" :disabled="continuing" @click="goBack">暂时返回</button>
        </view>
      </view>

      <template v-else-if="reviewStore.learning">
        <view class="learning-notice surface">
          <text class="learning-label">新知识 · 先学后背</text>
          <button class="text-button skip-preview" :disabled="startingRecall" @click="startBatchRecall">
            跳过预览
          </button>
        </view>

        <view class="learning-list">
          <view
            v-for="(card, index) in reviewStore.learningBatch"
            :key="card.id"
            class="learning-item surface"
          >
            <text class="learning-index">{{ index + 1 }}</text>
            <view class="learning-copy">
              <text class="learning-question">{{ card.question }}</text>
              <text class="learning-answer">{{ card.answer }}</text>
            </view>
          </view>
        </view>

        <button
          class="primary-button reveal-button"
          :loading="startingRecall"
          :disabled="startingRecall"
          @click="startBatchRecall"
        >
          开始背记这 {{ reviewStore.learningBatch.length }} 个知识点
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
            <view
              v-if="(reviewStore.currentCard.connection || reviewStore.currentCard.note) && noteVisible"
              class="note-block"
            >
              <view v-if="reviewStore.currentCard.connection" class="note-item">
                <text class="note-label">知识关联</text>
                <text class="note-copy">{{ reviewStore.currentCard.connection }}</text>
              </view>
              <view v-if="reviewStore.currentCard.note" class="note-item">
                <text class="note-label">其他备注</text>
                <text class="note-copy">{{ reviewStore.currentCard.note }}</text>
              </view>
            </view>
            <button
              v-if="reviewStore.currentCard.connection || reviewStore.currentCard.note"
              class="note-toggle"
              @click="noteVisible = !noteVisible"
            >
              {{ noteVisible ? '收起路径' : '路径' }}
            </button>
          </view>
        </view>

        <button
          v-if="!reviewStore.revealed && reviewStore.contextCards.length && !reviewStore.contextRevealed"
          class="secondary-button context-button"
          @click="reviewStore.showContext"
        >
          查看上文提示
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
          <button v-if="reviewStore.canUndo" class="text-button" @click="undoLastRating">
            撤销上次评分
          </button>
        </view>
        <ReviewButtons
          v-else
          :previews="reviewStore.previews"
          :show-intervals="reviewStore.sessionMode !== 'practice'"
          :class="{ disabled: rating }"
          @rate="rateCard"
        />
        <text
          v-if="reviewStore.revealed && reviewStore.sessionMode === 'practice'"
          class="practice-note"
        >
          主动练习只记录结果，不改变原复习时间。
        </text>
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

.finish-actions {
  display: flex;
  width: 100%;
  max-width: 520rpx;
  margin-top: 30rpx;
  flex-direction: column;
  gap: 14rpx;
}

.retry-wait {
  display: flex;
  min-height: 460rpx;
  padding: 54rpx 36rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
}

.retry-label,
.retry-note {
  display: block;
}

.retry-label {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: 760;
}

.retry-note {
  max-width: 520rpx;
  margin-top: 18rpx;
  color: var(--color-subtle);
  font-size: 22rpx;
  line-height: 1.65;
}

.retry-actions {
  display: flex;
  width: 100%;
  max-width: 520rpx;
  margin-top: 32rpx;
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

.learning-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding: 22rpx 24rpx;
  border-left: 5rpx solid var(--color-primary);
}

.learning-label {
  display: block;
}

.learning-label {
  color: var(--color-primary);
  font-size: 23rpx;
  font-weight: 750;
}

.skip-preview {
  padding: 4rpx 0;
  color: var(--color-subtle);
  font-size: 21rpx;
}

.learning-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.learning-item {
  display: flex;
  gap: 18rpx;
  padding: 26rpx;
}

.learning-index {
  display: flex;
  width: 38rpx;
  height: 38rpx;
  flex: 0 0 38rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 19rpx;
  font-weight: 720;
}

.learning-copy {
  min-width: 0;
  flex: 1;
}

.learning-question,
.learning-answer {
  display: block;
  white-space: pre-wrap;
}

.learning-question {
  color: var(--color-text);
  font-size: 27rpx;
  font-weight: 720;
  line-height: 1.55;
}

.learning-answer {
  margin-top: 12rpx;
  color: var(--color-muted);
  font-size: 24rpx;
  line-height: 1.7;
}

.review-card {
  min-height: 570rpx;
  padding: 48rpx 38rpx;
  border-top: 4rpx solid var(--color-accent);
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

.inline-context {
  margin-top: 32rpx;
  padding: 22rpx;
  border: 1rpx solid #d3e1da;
  border-radius: 16rpx;
  background: #f7faf8;
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
  border-top: 1rpx solid var(--color-line);
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
  color: var(--color-text);
  font-size: 30rpx;
  line-height: 1.8;
}

.note-toggle {
  margin: 20rpx 0 0 auto;
  padding: 10rpx 0;
  background: transparent;
  color: var(--color-subtle);
  font-size: 22rpx;
  text-align: right;
}

.note-block {
  margin-top: 8rpx;
  padding: 22rpx;
  border-radius: 16rpx;
  border-left: 4rpx solid var(--color-accent);
  background: var(--color-accent-soft);
}

.note-label,
.note-copy {
  display: block;
}

.note-item + .note-item {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid var(--color-line);
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

.practice-note {
  display: block;
  margin-top: 16rpx;
  color: var(--color-subtle);
  font-size: 21rpx;
  text-align: center;
}

.session-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  margin-top: 12rpx;
}
</style>
