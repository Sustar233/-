<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  hint?: string
}>()
</script>

<template>
  <view class="stat-card surface">
    <text class="stat-label">{{ label }}</text>
    <text class="stat-value">{{ value }}</text>
    <text v-if="hint" class="stat-hint">{{ hint }}</text>
  </view>
</template>

<style scoped>
.stat-card {
  min-width: 0;
  padding: 24rpx;
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
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: 760;
}

.stat-hint {
  margin-top: 7rpx;
  color: var(--color-subtle);
  font-size: 20rpx;
}
</style>
