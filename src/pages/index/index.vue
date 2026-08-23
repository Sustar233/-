<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import StatCard from '@/components/StatCard.vue'
import { getCards } from '@/services/cardService'
import { buildReviewQueue, getReviewSession } from '@/services/reviewService'
import { createEmptyStatistics, getStatistics } from '@/services/statisticsService'
import { getSubjects } from '@/services/subjectService'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewSession } from '@/types/review'
import type { Subject } from '@/types/subject'
import { startOfDay } from '@/utils/date'
import { reviewRoute } from '@/utils/reviewFilter'

const subjects = ref<Subject[]>([])
const cards = ref<KnowledgeCard[]>([])
const dueCount = ref(0)
const resumableSession = ref<ReviewSession | null>(null)
const loading = ref(false)
const summary = ref(createEmptyStatistics())

const recentSubjects = computed(() =>
  [...subjects.value].sort((first, second) => second.updatedAt - first.updatedAt).slice(0, 3),
)
const isResuming = computed(() => Boolean(resumableSession.value))
const reviewCount = computed(() =>
  resumableSession.value
    ? Math.max(0, resumableSession.value.cardIds.length - resumableSession.value.currentIndex)
    : dueCount.value,
)

async function refresh(): Promise<void> {
  loading.value = true
  try {
    const [subjectData, cardData, queue, statistics, session] = await Promise.all([
      getSubjects(),
      getCards(),
      buildReviewQueue(),
      getStatistics(),
      getReviewSession(),
    ])
    subjects.value = subjectData
    cards.value = cardData
    dueCount.value = queue.length
    summary.value = statistics
    resumableSession.value =
      session &&
      startOfDay(session.startedAt) === startOfDay(Date.now()) &&
      session.currentIndex < session.cardIds.length
        ? session
        : null
  } finally {
    loading.value = false
  }
}

onShow(refresh)

function cardCount(subjectId: string): number {
  return cards.value.filter((card) => card.subjectId === subjectId).length
}

function startReview(): void {
  if (!reviewCount.value) {
    uni.showToast({ title: '今天的复习已经完成', icon: 'none' })
    return
  }
  uni.navigateTo({ url: reviewRoute(resumableSession.value?.filter) })
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
</script>

<template>
  <view class="page-shell safe-top home-page">
    <view class="brand-row">
      <text class="brand">苦作舟</text>
      <text class="tagline">把知识记得更久</text>
    </view>

    <view class="review-hero surface">
      <text class="hero-label">{{ isResuming ? '继续上次复习' : '今日待复习' }}</text>
      <view class="hero-number-row">
        <text class="hero-number">{{ reviewCount }}</text>
        <text class="hero-unit">张</text>
      </view>
      <text class="hero-note">
        {{ isResuming ? '从中断处继续，已完成的进度不会丢失' : reviewCount ? '到期卡片优先；新知识先理解上下文，再进入回忆' : '今天的复习已经完成。' }}
      </text>
      <button class="primary-button hero-button" :disabled="loading" @click="startReview">
        {{ loading ? '正在准备…' : isResuming ? '继续复习' : reviewCount ? '开始今日复习' : '今日已完成' }}
      </button>
    </view>

    <view class="section-heading">
      <text class="section-title">今天</text>
      <text class="section-link" @click="openStudy">路径学习 ›</text>
    </view>
    <view class="stat-grid">
      <StatCard label="已复习" :value="summary.todayReviews" hint="次回答" />
      <StatCard label="新学习" :value="summary.todayNewCards" hint="张新卡" />
      <StatCard label="重来" :value="summary.todayAgain" hint="次遗忘" />
      <StatCard label="连续" :value="`${summary.streakDays} 天`" hint="学习节奏" />
    </view>

    <view class="section-heading">
      <text class="section-title">最近知识库</text>
      <text class="section-link" @click="openLibrary">查看全部</text>
    </view>
    <EmptyState
      v-if="!loading && !recentSubjects.length"
      title="从第一个科目开始"
      description="到知识库创建科目，然后录入你的专业知识。"
    >
      <button class="secondary-button empty-action" @click="openLibrary">打开知识库</button>
    </EmptyState>
    <view
      v-for="subject in recentSubjects"
      :key="subject.id"
      class="recent-subject surface"
      @click="openSubject(subject.id)"
    >
      <view class="recent-mark">{{ subject.name.slice(0, 1) }}</view>
      <view class="recent-copy">
        <text class="recent-name">{{ subject.name }}</text>
        <text class="recent-count">{{ cardCount(subject.id) }} 张知识卡</text>
      </view>
      <text class="chevron">›</text>
    </view>
  </view>
</template>

<style scoped>
.home-page {
  padding-bottom: 70rpx;
}

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
  padding: 34rpx;
}

.hero-label,
.hero-note {
  display: block;
}

.hero-label {
  color: var(--color-muted);
  font-size: 24rpx;
  font-weight: 680;
}

.hero-number-row {
  display: flex;
  align-items: baseline;
  margin-top: 6rpx;
}

.hero-number {
  color: var(--color-text);
  font-size: 88rpx;
  font-weight: 800;
  line-height: 1.1;
}

.hero-unit {
  margin-left: 10rpx;
  color: var(--color-muted);
  font-size: 24rpx;
}

.hero-note {
  margin-top: 8rpx;
  color: var(--color-muted);
  font-size: 22rpx;
  line-height: 1.55;
}

.hero-button {
  width: 100%;
  margin-top: 28rpx;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14rpx;
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
}

.recent-name {
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
</style>
