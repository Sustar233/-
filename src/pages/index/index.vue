<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import LoadErrorState from '@/components/LoadErrorState.vue'
import LoadingState from '@/components/LoadingState.vue'
import StatCard from '@/components/StatCard.vue'
import { getDashboardSnapshot } from '@/services/dashboardService'
import { getReviewQueueProgress } from '@/services/reviewService'
import { createEmptyStatistics } from '@/services/statisticsService'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewSession } from '@/types/review'
import type { Subject } from '@/types/subject'
import { startOfDay } from '@/utils/date'
import { reviewRoute } from '@/utils/reviewFilter'

const subjects = ref<Subject[]>([])
const cards = ref<KnowledgeCard[]>([])
const dueCount = ref(0)
const resumableSession = ref<ReviewSession | null>(null)
const loading = ref(true)
const loadError = ref(false)
const summary = ref(createEmptyStatistics())
const todaySubjectIds = ref<string[]>([])

const recentSubjects = computed(() =>
  [...subjects.value].sort((first, second) => second.updatedAt - first.updatedAt).slice(0, 3),
)
const isResuming = computed(() => Boolean(resumableSession.value))
const hasStartedToday = computed(() => todaySubjectIds.value.length > 0)
const cardCounts = computed(() =>
  cards.value.reduce<Record<string, number>>((counts, card) => {
    counts[card.subjectId] = (counts[card.subjectId] ?? 0) + 1
    return counts
  }, {}),
)
const reviewCount = computed(() =>
  resumableSession.value
    ? getReviewQueueProgress(
        resumableSession.value.cardIds,
        resumableSession.value.currentIndex,
      ).remaining
    : dueCount.value,
)
const heroLabel = computed(() => {
  if (!hasStartedToday.value) return '今日学习'
  return isResuming.value ? '继续上次学习' : '今日待学习'
})
const heroButtonLabel = computed(() => {
  if (loading.value) return '正在准备…'
  if (!hasStartedToday.value) return '开始学习'
  if (isResuming.value) return '继续复习'
  return reviewCount.value ? '继续学习' : '今日已完成'
})

async function refresh(): Promise<void> {
  loading.value = true
  loadError.value = false
  try {
    const now = Date.now()
    const snapshot = await getDashboardSnapshot(now)
    subjects.value = snapshot.subjects
    cards.value = snapshot.cards
    dueCount.value = snapshot.dueCount
    summary.value = snapshot.statistics
    todaySubjectIds.value = snapshot.todaySubjectIds
    resumableSession.value =
      snapshot.session &&
      startOfDay(snapshot.session.startedAt) === startOfDay(now) &&
      Boolean(snapshot.session.filter.subjectId) &&
      snapshot.session.currentIndex < snapshot.session.cardIds.length
        ? snapshot.session
        : null
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

onShow(refresh)

function startReview(): void {
  if (resumableSession.value) {
    uni.navigateTo({ url: reviewRoute(resumableSession.value.filter) })
    return
  }
  if (hasStartedToday.value && !reviewCount.value) {
    uni.showToast({ title: '今天的复习已经完成', icon: 'none' })
    return
  }
  openStudy()
}

function openSubject(id: string): void {
  uni.navigateTo({ url: `/pages/subject/index?id=${encodeURIComponent(id)}` })
}

function openLibrary(): void {
  uni.switchTab({ url: '/pages/library/index' })
}

function openStudy(): void {
  uni.navigateTo({ url: '/pages/study/index' })
}

function openTodayReview(): void {
  const todaySubjects = todaySubjectIds.value
    .map((id) => subjects.value.find((subject) => subject.id === id))
    .filter((subject): subject is Subject => Boolean(subject))
  if (!todaySubjects.length) {
    uni.showToast({ title: '今天还没有开始学习', icon: 'none' })
    return
  }
  const openSubjectReview = (subjectId: string): void => {
    uni.navigateTo({
      url: `/pages/review/index?fresh=1&today=all&subjectId=${encodeURIComponent(subjectId)}`,
    })
  }
  if (todaySubjects.length === 1) {
    openSubjectReview(todaySubjects[0]!.id)
    return
  }
  uni.showActionSheet({
    itemList: todaySubjects.map((subject) => subject.name),
    success: ({ tapIndex }) => {
      const subject = todaySubjects[tapIndex]
      if (subject) openSubjectReview(subject.id)
    },
  })
}
</script>

<template>
  <view class="page-shell safe-top home-page">
    <view class="brand-row">
      <text class="brand">苦作舟</text>
      <text class="tagline">把知识记得更久</text>
    </view>

    <LoadingState v-if="loading" label="正在准备今日学习…" />
    <LoadErrorState v-else-if="loadError" @retry="refresh" />

    <template v-else>
    <view class="home-overview">
    <view class="review-hero surface">
      <view class="hero-heading"><text class="hero-label">{{ heroLabel }}</text><text class="hero-badge">循序渐进 · 温故知新</text></view>
      <view class="hero-number-row">
        <text class="hero-number">{{ reviewCount }}</text>
        <text class="hero-unit">张</text>
      </view>
      <text class="hero-hint">{{ isResuming ? '从上次停下的地方，接着学。' : reviewCount ? '选择一个知识库，每次专注一个小节。' : '今天的内容已记住，让知识沉淀一下。' }}</text>
      <button class="primary-button hero-button" :disabled="loading" @click="startReview">
        {{ heroButtonLabel }}
      </button>
    </view>

    <view class="today-panel">
    <view class="section-heading">
      <text class="section-title">今天</text>
      <button class="text-button section-link" @click="openStudy">自定义学习 ›</button>
    </view>
    <view class="stat-grid">
      <StatCard label="已复习" :value="summary.todayReviews" hint="次回答" />
      <StatCard label="新学习" :value="summary.todayNewCards" hint="张新卡" />
      <StatCard label="已掌握" :value="summary.masteredCards" hint="张知识卡" />
      <StatCard label="连续" :value="`${summary.streakDays} 天`" hint="学习节奏" />
    </view>
    <view v-if="hasStartedToday" class="today-review-actions">
      <button class="secondary-button compact-action" @click="openTodayReview">再练一遍今日知识</button>
    </view>
    </view>
    </view>

    <view class="section-heading">
      <text class="section-title">最近知识库</text>
      <button class="text-button section-link" @click="openLibrary">查看全部 ›</button>
    </view>
    <EmptyState
      v-if="!loading && !recentSubjects.length"
      title="从第一个科目开始"
      description="到知识库创建科目，然后录入你的专业知识。"
    >
      <button class="secondary-button empty-action" @click="openLibrary">打开知识库</button>
    </EmptyState>
    <view class="recent-grid">
    <button
      v-for="subject in recentSubjects"
      :key="subject.id"
      class="recent-subject surface"
      :aria-label="`打开科目：${subject.name}`"
      @click="openSubject(subject.id)"
    >
      <view class="recent-mark">{{ subject.name.slice(0, 1) }}</view>
      <view class="recent-copy">
        <text class="recent-name">{{ subject.name }}</text>
        <text class="recent-count">{{ cardCounts[subject.id] ?? 0 }} 张知识卡</text>
      </view>
      <text class="chevron">›</text>
    </button>
    </view>
    </template>
  </view>
</template>

<style scoped>
.brand-row {
  display: flex;
  align-items: baseline;
  gap: 18rpx;
  margin: 8rpx 2rpx 30rpx;
}

.brand {
  color: var(--color-text);
  font-size: 44rpx;
  font-weight: 820;
}

.tagline {
  color: var(--color-muted);
  font-size: 22rpx;
}

.review-hero {
  display: flex;
  flex-direction: column;
  padding: 38rpx;
  border: 0;
  border-radius: 24rpx;
  background: linear-gradient(125deg, #1e493c, #32745e);
  color: #ffffff;
}

.hero-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.hero-badge {
  color: #d3e7db;
  font-size: 20rpx;
}
.hero-hint {
  display: block;
  margin-top: 18rpx;
  color: #d3e7db;
  font-size: 23rpx;
  line-height: 1.7;
}

.hero-label {
  color: #d3e7db;
  font-size: 24rpx;
  font-weight: 680;
}

.hero-number-row {
  display: flex;
  align-items: baseline;
  margin-top: 28rpx;
}

.hero-number {
  color: #ffffff;
  font-size: 88rpx;
  font-weight: 800;
  line-height: 1.1;
}

.hero-unit {
  margin-left: 10rpx;
  color: #d3e7db;
  font-size: 24rpx;
}

.hero-button {
  width: 100%;
  margin-top: 28rpx;
  background: #ffffff;
  color: var(--color-primary-dark);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14rpx;
}

.today-review-actions {
  margin-top: 14rpx;
}

.compact-action {
  width: 100%;
  padding-right: 12rpx;
  padding-left: 12rpx;
  font-size: 23rpx;
}

.section-link {
  color: var(--color-primary);
  font-size: 24rpx;
}

.recent-subject {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-bottom: 14rpx;
  padding: 24rpx;
  width: 100%;
  text-align: left;
  line-height: 1.5;
}

.recent-mark {
  display: flex;
  width: 68rpx;
  height: 68rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 760;
}

.recent-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.recent-name {
  overflow-wrap: anywhere;
  font-size: 28rpx;
  font-weight: 700;
}

.recent-count {
  color: var(--color-muted);
  font-size: 22rpx;
}

.chevron {
  color: var(--color-subtle);
  font-size: 38rpx;
}

.empty-action {
  margin-top: 24rpx;
}

@media (min-width: 900px) {
  .home-overview {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;
    align-items: stretch;
  }
  .today-panel .section-heading {
    margin: 0 2rpx 18rpx;
  }
  .review-hero { justify-content: space-between; }
  .recent-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
}
</style>
