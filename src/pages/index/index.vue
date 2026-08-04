<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import StatCard from '@/components/StatCard.vue'
import { getCards } from '@/services/cardService'
import { buildReviewQueue, getReviewSession } from '@/services/reviewService'
import { getStatistics, type StatisticsSummary } from '@/services/statisticsService'
import { getSubjects } from '@/services/subjectService'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewSession } from '@/types/review'
import type { Subject } from '@/types/subject'
import { startOfDay } from '@/utils/date'

const subjects = ref<Subject[]>([])
const cards = ref<KnowledgeCard[]>([])
const dueCount = ref(0)
const resumableSession = ref<ReviewSession | null>(null)
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
  const filter = resumableSession.value?.filter
  const parts: string[] = []
  if (filter?.subjectId) parts.push(`subjectId=${encodeURIComponent(filter.subjectId)}`)
  if (filter?.chapterId) parts.push(`chapterId=${encodeURIComponent(filter.chapterId)}`)
  if (filter?.uncategorizedOnly) parts.push('uncategorized=1')
  if (filter?.tag) parts.push(`tag=${encodeURIComponent(filter.tag)}`)
  uni.navigateTo({ url: `/pages/review/index${parts.length ? `?${parts.join('&')}` : ''}` })
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
      <view class="brand-lockup">
        <view class="brand-seal">舟</view>
        <view>
          <text class="brand">苦作舟</text>
          <text class="tagline">学海无涯，把知识记得更久</text>
        </view>
      </view>
      <text class="today-mark">每日精进</text>
    </view>

    <view class="review-hero surface">
      <view class="hero-topline">
        <text class="hero-label">{{ isResuming ? '继续上次复习' : '今日待复习' }}</text>
        <text class="hero-badge">{{ isResuming ? '进度已保存' : 'FSRS 智能排序' }}</text>
      </view>
      <view class="hero-number-row">
        <text class="hero-number">{{ reviewCount }}</text>
        <text class="hero-unit">张</text>
      </view>
      <text class="hero-note">
        {{ isResuming ? '从中断处继续，已完成的进度不会丢失' : reviewCount ? '到期卡片优先，新卡随后进入队列' : '今天的复习已经完成。' }}
      </text>
      <button class="hero-button" :disabled="loading" @click="startReview">
        {{ loading ? '正在准备…' : isResuming ? '继续复习' : reviewCount ? '开始今日复习' : '今日已完成' }}
      </button>
    </view>

    <view class="section-heading">
      <text class="section-title">今天</text>
      <text class="section-link" @click="openStudy">专项复习 ›</text>
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
  margin: 8rpx 2rpx 32rpx;
}

.brand-lockup {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 18rpx;
}

.brand,
.tagline {
  display: block;
}

.brand {
  color: var(--color-text);
  font-size: 46rpx;
  font-weight: 860;
  letter-spacing: 2rpx;
}

.tagline {
  margin-top: 7rpx;
  color: var(--color-muted);
  font-size: 22rpx;
}

.brand-seal {
  display: flex;
  width: 66rpx;
  height: 66rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx 18rpx 18rpx 6rpx;
  background: var(--color-accent);
  color: #fffaf3;
  font-family: "STKaiti", "KaiTi", serif;
  font-size: 34rpx;
  font-weight: 700;
  box-shadow: 0 8rpx 18rpx rgba(185, 104, 61, 0.2);
}

.today-mark {
  flex: 0 0 auto;
  padding: 9rpx 14rpx;
  border: 1rpx solid #e3cbb8;
  border-radius: 999rpx;
  color: var(--color-accent);
  font-size: 19rpx;
  letter-spacing: 1rpx;
}

.review-hero {
  position: relative;
  padding: 38rpx;
  overflow: hidden;
  border-color: rgba(255, 255, 255, 0.08);
  background: linear-gradient(145deg, #235e4d 0%, #174538 100%);
  color: #ffffff;
  box-shadow: 0 20rpx 44rpx rgba(23, 69, 56, 0.2);
}

.review-hero::after {
  position: absolute;
  top: -86rpx;
  right: -78rpx;
  width: 230rpx;
  height: 230rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  content: '';
}

.hero-topline {
  display: flex;
  position: relative;
  z-index: 1;
  align-items: center;
  justify-content: space-between;
}

.hero-label,
.hero-note {
  display: block;
}

.hero-label {
  color: #d6e6de;
  font-size: 24rpx;
  font-weight: 680;
}

.hero-badge {
  padding: 8rpx 13rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  color: #dcebe4;
  font-size: 18rpx;
}

.hero-number-row {
  display: flex;
  position: relative;
  z-index: 1;
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
  color: #d1e1d9;
  font-size: 25rpx;
}

.hero-note {
  position: relative;
  z-index: 1;
  margin-top: 12rpx;
  color: #c8dbd2;
  font-size: 22rpx;
}

.hero-button {
  position: relative;
  z-index: 1;
  width: 100%;
  margin-top: 32rpx;
  padding: 25rpx;
  background: #fffaf1;
  color: var(--color-primary-dark);
  font-weight: 780;
  box-shadow: 0 10rpx 26rpx rgba(11, 43, 34, 0.16);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.section-link {
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 650;
}

.recent-subject {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 16rpx;
  padding: 25rpx 26rpx;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.recent-mark {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 19rpx;
  background: var(--color-primary-soft);
  color: var(--color-primary);
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
  font-weight: 740;
}

.recent-count {
  color: var(--color-muted);
  font-size: 22rpx;
}

.chevron {
  color: #a29d94;
  font-size: 42rpx;
}

.empty-action {
  margin-top: 26rpx;
}

@media (max-width: 360px) {
  .today-mark {
    display: none;
  }
}
</style>
