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
    <view class="constellation-mark" aria-hidden="true">
      <view class="constellation-line line-one" />
      <view class="constellation-line line-two" />
      <view class="constellation-line line-three" />
      <text class="constellation-star star-one">✦</text>
      <text class="constellation-star star-two">✧</text>
      <text class="constellation-star star-three">✦</text>
      <text class="constellation-star star-four">·</text>
    </view>
    <view class="brand-row">
      <view class="brand-lockup">
        <view class="brand-seal">舟</view>
        <view>
          <text class="brand">苦作舟</text>
          <text class="tagline">学海无涯 · 苦作舟以渡</text>
        </view>
      </view>
      <text class="today-mark">每日精进</text>
    </view>

    <view class="review-hero surface">
      <view class="hero-constellation" aria-hidden="true">
        <view class="hero-star-node hero-node-one" />
        <view class="hero-star-node hero-node-two" />
        <view class="hero-star-node hero-node-three" />
        <view class="hero-star-line hero-line-one" />
        <view class="hero-star-line hero-line-two" />
      </view>
      <view class="hero-cloud" aria-hidden="true">
        <view class="cloud-lobe cloud-lobe-one" />
        <view class="cloud-lobe cloud-lobe-two" />
        <view class="cloud-lobe cloud-lobe-three" />
        <view class="cloud-lobe cloud-lobe-four" />
      </view>
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
    <view class="progress-panel surface">
      <view class="stat-grid">
        <StatCard variant="orbit" label="已复习" :value="summary.todayReviews" hint="次回答" />
        <StatCard variant="orbit" label="新学习" :value="summary.todayNewCards" hint="张新卡" />
        <StatCard variant="orbit" label="重来" :value="summary.todayAgain" hint="次遗忘" />
        <StatCard variant="orbit" label="连续" :value="`${summary.streakDays} 天`" hint="学习节奏" />
      </view>
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
  position: relative;
  padding-bottom: 70rpx;
}

.constellation-mark {
  position: absolute;
  z-index: 0;
  top: 24rpx;
  right: 26rpx;
  width: 250rpx;
  height: 150rpx;
  opacity: 0.68;
  pointer-events: none;
}

.constellation-line {
  position: absolute;
  height: 1rpx;
  transform-origin: left center;
  background: linear-gradient(90deg, rgba(215, 173, 102, 0.76), rgba(215, 173, 102, 0.12));
}

.line-one { top: 48rpx; left: 34rpx; width: 108rpx; transform: rotate(17deg); }
.line-two { top: 80rpx; left: 131rpx; width: 82rpx; transform: rotate(-28deg); }
.line-three { top: 63rpx; left: 70rpx; width: 72rpx; transform: rotate(64deg); }

.constellation-star {
  position: absolute;
  color: var(--color-accent);
  text-shadow: 0 0 14rpx rgba(255, 213, 138, 0.55);
}

.star-one { top: 34rpx; left: 23rpx; }
.star-two { top: 63rpx; left: 129rpx; }
.star-three { top: 21rpx; right: 14rpx; }
.star-four { top: 116rpx; left: 116rpx; }

.brand-row {
  display: flex;
  position: relative;
  z-index: 1;
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
  color: #f6e5be;
  font-size: 50rpx;
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 7rpx;
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
  border: 1rpx solid rgba(230, 154, 116, 0.72);
  background: #842f35;
  color: #ffd8b4;
  font-family: "STKaiti", "KaiTi", serif;
  font-size: 34rpx;
  font-weight: 700;
  box-shadow: 0 8rpx 20rpx rgba(0, 6, 18, 0.3);
}

.today-mark {
  flex: 0 0 auto;
  padding: 9rpx 14rpx;
  border: 1rpx solid rgba(215, 173, 102, 0.45);
  border-radius: 999rpx;
  color: var(--color-accent);
  font-size: 19rpx;
  letter-spacing: 1rpx;
}

.review-hero {
  position: relative;
  padding: 38rpx;
  overflow: hidden;
  border-color: rgba(215, 173, 102, 0.56);
  background:
    radial-gradient(circle at 76% 26%, rgba(100, 167, 195, 0.12) 0, transparent 34%),
    linear-gradient(145deg, rgba(11, 38, 65, 0.98), rgba(6, 24, 43, 0.98));
  color: #f8e8c5;
  box-shadow: 0 22rpx 50rpx rgba(0, 6, 18, 0.38);
}

.review-hero::before {
  position: absolute;
  top: -118rpx;
  right: -60rpx;
  width: 330rpx;
  height: 330rpx;
  border: 1rpx solid rgba(215, 173, 102, 0.28);
  border-radius: 50%;
  content: '';
}

.review-hero::after {
  position: absolute;
  top: 82rpx;
  right: 54rpx;
  color: rgba(238, 197, 122, 0.78);
  font-size: 34rpx;
  text-shadow: 0 0 16rpx rgba(238, 197, 122, 0.5);
  content: '✦';
}

.hero-constellation {
  position: absolute;
  z-index: 0;
  top: 84rpx;
  right: 38rpx;
  width: 190rpx;
  height: 96rpx;
  opacity: 0.68;
}

.hero-cloud {
  position: absolute;
  z-index: 0;
  right: -42rpx;
  bottom: -68rpx;
  width: 300rpx;
  height: 170rpx;
  opacity: 0.2;
  pointer-events: none;
}

.cloud-lobe {
  position: absolute;
  border: 1rpx solid rgba(226, 187, 117, 0.88);
  border-radius: 50%;
}

.cloud-lobe-one { bottom: 0; left: 0; width: 106rpx; height: 106rpx; }
.cloud-lobe-two { bottom: -6rpx; left: 72rpx; width: 154rpx; height: 154rpx; }
.cloud-lobe-three { right: 0; bottom: 8rpx; width: 112rpx; height: 112rpx; }
.cloud-lobe-four { right: 48rpx; bottom: -36rpx; width: 206rpx; height: 124rpx; }

.hero-star-node {
  position: absolute;
  width: 7rpx;
  height: 7rpx;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 14rpx rgba(238, 197, 122, 0.65);
}

.hero-node-one { top: 16rpx; left: 12rpx; }
.hero-node-two { top: 58rpx; left: 82rpx; }
.hero-node-three { top: 26rpx; right: 8rpx; }

.hero-star-line {
  position: absolute;
  height: 1rpx;
  transform-origin: left center;
  background: rgba(215, 173, 102, 0.52);
}

.hero-line-one { top: 20rpx; left: 17rpx; width: 80rpx; transform: rotate(31deg); }
.hero-line-two { top: 61rpx; left: 88rpx; width: 92rpx; transform: rotate(-24deg); }

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
  color: #efd6a4;
  font-size: 24rpx;
  font-family: var(--font-display);
  font-weight: 680;
}

.hero-badge {
  padding: 8rpx 13rpx;
  border: 1rpx solid rgba(215, 173, 102, 0.35);
  border-radius: 999rpx;
  background: rgba(215, 173, 102, 0.08);
  color: #dcc597;
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
  color: #f4d89e;
  font-size: 106rpx;
  font-family: "Times New Roman", serif;
  font-weight: 400;
  line-height: 1.05;
}

.hero-unit {
  margin-left: 12rpx;
  color: #e3c995;
  font-size: 25rpx;
}

.hero-note {
  position: relative;
  z-index: 1;
  margin-top: 12rpx;
  color: #aebdcc;
  font-size: 22rpx;
}

.hero-button {
  position: relative;
  z-index: 1;
  width: 100%;
  margin-top: 32rpx;
  padding: 25rpx;
  border: 1rpx solid rgba(148, 230, 213, 0.52);
  background: linear-gradient(135deg, #197b71 0%, #0b5753 100%);
  color: #fff0ce;
  font-weight: 780;
  box-shadow: 0 12rpx 28rpx rgba(0, 7, 18, 0.32);
  border-radius: 999rpx;
}

.progress-panel {
  position: relative;
  padding: 10rpx;
  overflow: hidden;
  border-color: rgba(215, 173, 102, 0.44);
  background:
    radial-gradient(circle at 12% 18%, rgba(36, 129, 121, 0.14) 0, transparent 26%),
    linear-gradient(145deg, rgba(11, 37, 62, 0.98), rgba(6, 25, 45, 0.98));
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
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
  border: 1rpx solid rgba(103, 216, 197, 0.34);
  background: linear-gradient(145deg, rgba(34, 118, 108, 0.58), rgba(12, 70, 70, 0.7));
  color: #a1eddd;
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
  color: var(--color-muted);
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
