<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: '正在加载…' })
</script>

<template>
  <view class="loading-state surface" role="status" aria-live="polite">
    <view class="loading-dot" />
    <text>{{ label }}</text>
  </view>
</template>

<style scoped>
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 64rpx 24rpx;
  color: var(--color-muted);
}
.loading-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: var(--color-primary);
  animation: breathe 1s ease-in-out infinite alternate;
}
@keyframes breathe { to { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) {
  .loading-dot { animation: none; }
}
</style>
