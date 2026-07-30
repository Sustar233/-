<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  hint?: string
}>()
</script>

<template>
  <view class="stat-card surface">
    <view class="stat-accent" />
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

.stat-accent {
  position: absolute;
  top: 0;
  left: 24rpx;
  width: 42rpx;
  height: 4rpx;
  border-radius: 0 0 999rpx 999rpx;
  background: var(--color-accent);
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
  font-weight: 800;
}

.stat-hint {
  margin-top: 7rpx;
  color: var(--color-subtle);
  font-size: 20rpx;
}
</style>
