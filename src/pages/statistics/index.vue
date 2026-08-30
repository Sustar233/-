<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import LoadErrorState from '@/components/LoadErrorState.vue'
import StatCard from '@/components/StatCard.vue'
import { createEmptyStatistics, getStatistics } from '@/services/statisticsService'

const summary = ref(createEmptyStatistics())
const loading = ref(false)
const loadError = ref(false)

const maximumDayCount = computed(() =>
  Math.max(1, ...summary.value.last7Days.map((day) => day.count)),
)

async function refresh(): Promise<void> {
  loading.value = true
  loadError.value = false
  try {
    summary.value = await getStatistics()
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

onShow(refresh)

function barHeight(count: number): string {
  if (!count) return '10rpx'
  return `${Math.max(24, Math.round((count / maximumDayCount.value) * 220))}rpx`
}

function editWeakCard(cardId: string, subjectId: string): void {
  uni.navigateTo({
    url: `/pages/card-edit/index?subjectId=${encodeURIComponent(subjectId)}&cardId=${encodeURIComponent(cardId)}`,
  })
}
</script>

<template>
  <view class="page-shell">
    <view class="page-heading">
      <text class="eyebrow">学习轨迹</text>
      <text class="page-title">学习统计</text>
      <text class="page-subtitle">看见节奏，也看见容易遗忘的知识。</text>
    </view>

    <LoadErrorState v-if="loadError" @retry="refresh" />

    <template v-else>
    <view class="stat-grid">
      <StatCard label="今日复习" :value="summary.todayReviews" hint="次回答" />
      <StatCard label="今日新卡" :value="summary.todayNewCards" hint="首次学习" />
      <StatCard label="已掌握" :value="summary.masteredCards" hint="张知识卡" />
      <StatCard label="连续学习" :value="`${summary.streakDays} 天`" hint="有记录的天数" />
    </view>

    <view class="section-heading">
      <text class="section-title">最近 7 天</text>
      <text class="muted">复习次数</text>
    </view>
    <view class="chart surface">
      <view v-for="day in summary.last7Days" :key="day.day" class="bar-column">
        <text class="bar-value">{{ day.count }}</text>
        <view class="bar-track">
          <view
            class="bar"
            :class="{ empty: !day.count }"
            :style="{ height: barHeight(day.count) }"
          />
        </view>
        <text class="bar-label">{{ day.label }}</text>
      </view>
    </view>

    <view class="section-heading">
      <text class="section-title">容易遗忘</text>
      <text class="muted">最近 10 次评分</text>
    </view>
    <EmptyState
      v-if="!loading && !summary.weakCards.length"
      title="暂时没有薄弱卡片"
      description="每张卡至少复习 3 次后，才会参与薄弱度计算。"
    />
    <view
      v-for="(item, index) in summary.weakCards"
      :key="item.card.id"
      class="weak-card surface"
      @click="editWeakCard(item.card.id, item.card.subjectId)"
    >
      <text class="weak-rank">{{ index + 1 }}</text>
      <view class="weak-copy">
        <text class="weak-question">{{ item.card.question }}</text>
        <text class="weak-meta">薄弱分 {{ item.score }} · 最近复习 {{ item.reviewCount }} 次</text>
      </view>
      <text class="chevron">›</text>
    </view>
    </template>
  </view>
</template>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.chart {
  display: flex;
  height: 360rpx;
  padding: 30rpx 18rpx 22rpx;
  align-items: stretch;
  justify-content: space-between;
}

.bar-column {
  display: flex;
  width: 13%;
  flex-direction: column;
  align-items: center;
}

.bar-value {
  height: 32rpx;
  color: var(--color-muted);
  font-size: 19rpx;
}

.bar-track {
  display: flex;
  width: 100%;
  flex: 1;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 42rpx;
  border-radius: 8rpx 8rpx 3rpx 3rpx;
  background: var(--color-primary);
}

.bar.empty {
  background: #eceeeb;
}

.bar-label {
  margin-top: 12rpx;
  color: var(--color-muted);
  font-size: 18rpx;
}

.weak-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 15rpx;
  padding: 25rpx;
}

.weak-rank {
  display: flex;
  width: 48rpx;
  height: 48rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-weight: 760;
}

.weak-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 9rpx;
}

.weak-question {
  overflow: hidden;
  font-size: 27rpx;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weak-meta {
  color: var(--color-muted);
  font-size: 21rpx;
}

.chevron {
  color: var(--color-muted);
  font-size: 40rpx;
}
</style>
