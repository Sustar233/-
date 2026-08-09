<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label: string
  value: string | number
  hint?: string
  variant?: 'card' | 'orbit'
}>(), {
  variant: 'card',
})

const symbol = computed(() => {
  if (props.label.includes('重来')) return '↺'
  if (props.label.includes('新')) return '◇'
  if (props.label.includes('连续')) return '✦'
  return '✓'
})
</script>

<template>
  <view class="stat-card" :class="[variant, { surface: variant === 'card' }]">
    <view v-if="variant === 'card'" class="stat-accent" />
    <view v-else class="stat-orb"><text>{{ symbol }}</text></view>
    <text class="stat-label">{{ label }}</text>
    <text class="stat-value">{{ value }}</text>
    <text v-if="hint" class="stat-hint">{{ hint }}</text>
  </view>
</template>

<style scoped>
.stat-card {
  position: relative;
  min-width: 0;
  padding: 26rpx;
  overflow: hidden;
}

.stat-card.orbit {
  display: flex;
  min-height: 184rpx;
  padding: 20rpx 8rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
}

.stat-card.orbit:not(:first-child) {
  border-left: 1rpx solid rgba(215, 173, 102, 0.22);
}

.stat-orb {
  display: flex;
  width: 58rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(103, 216, 197, 0.48);
  border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, rgba(118, 231, 211, 0.42), rgba(18, 82, 85, 0.72));
  color: #b8f2e5;
  box-shadow: 0 0 22rpx rgba(73, 191, 176, 0.18);
}

.orbit .stat-label {
  margin-top: 13rpx;
  color: #d9d5c5;
  font-size: 21rpx;
}

.orbit .stat-value {
  margin-top: 4rpx;
  color: #f4d9a3;
  font-size: 38rpx;
}

.orbit .stat-hint {
  display: none;
}

.stat-accent {
  position: absolute;
  top: 0;
  left: 24rpx;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 16rpx rgba(215, 173, 102, 0.74);
}

.stat-label,
.stat-value,
.stat-hint {
  display: block;
}

.stat-label {
  color: var(--color-muted);
  font-size: 23rpx;
}

.stat-value {
  margin-top: 12rpx;
  color: var(--color-text);
  font-size: 42rpx;
  font-family: "Times New Roman", serif;
  font-weight: 600;
}

.stat-hint {
  margin-top: 7rpx;
  color: var(--color-subtle);
  font-size: 20rpx;
}
</style>
