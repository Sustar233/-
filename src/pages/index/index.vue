<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import StatCard from '@/components/StatCard.vue'
import { getCards } from '@/services/cardService'
import { buildReviewQueue } from '@/services/reviewService'
import { getStatistics, type StatisticsSummary } from '@/services/statisticsService'
import { getSubjects } from '@/services/subjectService'
import type { KnowledgeCard } from '@/types/card'
import type { Subject } from '@/types/subject'

const subjects = ref<Subject[]>([])
const cards = ref<KnowledgeCard[]>([])
const dueCount = ref(0)
const loading = ref(false)
const summary = ref<StatisticsSummary>({
  todayReviews: 0,
  todayNewCards: 0,
  todayAgain: 0,
  streakDays: 0,
  last7Days: [],
  weakCards: [],
})

const recentSubjects = computed(() =>
  [...subjects.value].sort((first, second) => second.updatedAt - first.updatedAt).slice(0, 3),
)

async function refresh(): Promise<void> {
  loading.value = true
  try {
    const [subjectData, cardData, queue, statistics] = await Promise.all([
      getSubjects(),
      getCards(),
      buildReviewQueue(),
      getStatistics(),
    ])
    subjects.value = subjectData
    cards.value = cardData
    dueCount.value = queue.length
    summary.value = statistics
  } finally {
    loading.value = false
  }
}

onShow(refresh)

function cardCount(subjectId: string): number {
  return cards.value.filter((card) => card.subjectId === subjectId).length
}

function startReview(): void {
  if (!dueCount.value) {
    uni.showToast({ title: '今天的复习已经完成', icon: 'none' })
    return
  }
  uni.navigateTo({ url: '/pages/review/index' })
}

function openSubject(id: string): void {
  uni.navigateTo({ url: `/pages/subject/index?id=${encodeURIComponent(id)}` })
}

function openLibrary(): void {
  uni.switchTab({ url: '/pages/library/index' })
}
</script>

<template>
  <view class="page-shell safe-top home-page">
    <view class="brand-row">
      <view>
        <text class="brand">RecallLab</text>
        <text class="tagline">把重要知识，记得更久</text>
      </view>
      <view class="brand-dot" />
    </view>

    <view class="review-hero surface">
      <text class="hero-label">今日待复习</text>
      <view class="hero-number-row">
        <text class="hero-number">{{ dueCount }}</text>
        <text class="hero-unit">张</text>
      </view>
      <text class="hero-note">
        {{ dueCount ? '到期卡片优先，新卡随后进入队列' : '今天的复习已经完成。' }}
      </text>
      <button class="hero-button" :disabled="loading" @click="startReview">
        {{ dueCount ? '开始复习' : '今日已完成' }}
      </button>
    </view>

    <view class="section-heading">
      <text class="section-title">今天</text>
      <text class="muted">保持一点进展</text>
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
      <button class="secondary-button empty-action" @click="openLibrary">
        打开知识库
      </button>
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
  align-items: center;
  justify-content: space-between;
  margin: 10rpx 2rpx 34rpx;
}

.brand,
.tagline {
  display: block;
}

.brand {
  font-size: 47rpx;
  font-weight: 850;
  letter-spacing: -1rpx;
}

.tagline {
  margin-top: 7rpx;
  color: #7d8781;
  font-size: 23rpx;
}

.brand-dot {
  width: 20rpx;
  height: 20rpx;
  border: 7rpx solid #d9e8e0;
  border-radius: 50%;
  background: #2e6a52;
}

.review-hero {
  padding: 38rpx;
  overflow: hidden;
  background: #204f3e;
  color: #ffffff;
}

.hero-label,
.hero-note {
  display: block;
}

.hero-label {
  color: #c9dcd3;
  font-size: 24rpx;
  font-weight: 650;
}

.hero-number-row {
  display: flex;
  align-items: baseline;
  margin-top: 8rpx;
}

.hero-number {
  font-size: 94rpx;
  font-weight: 850;
  line-height: 1.05;
}

.hero-unit {
  margin-left: 12rpx;
  color: #c9dcd3;
  font-size: 25rpx;
}

.hero-note {
  margin-top: 12rpx;
  color: #bdd2c8;
  font-size: 22rpx;
}

.hero-button {
  width: 100%;
  margin-top: 32rpx;
  padding: 25rpx;
  background: #f4f8f5;
  color: #204f3e;
  font-weight: 750;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.section-link {
  color: #356a53;
  font-size: 24rpx;
}

.recent-subject {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 16rpx;
  padding: 24rpx 26rpx;
}

.recent-mark {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 19rpx;
  background: #e7f0eb;
  color: #2c664f;
  font-weight: 800;
}

.recent-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 7rpx;
}

.recent-name {
  font-size: 28rpx;
  font-weight: 720;
}

.recent-count {
  color: #828b86;
  font-size: 22rpx;
}

.chevron {
  color: #9ba49f;
  font-size: 42rpx;
}

.empty-action {
  margin-top: 26rpx;
}
</style>
