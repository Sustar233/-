<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
  }>(),
  { description: '' },
)
</script>

<template>
  <view class="empty-state">
    <view class="empty-symbol">✓</view>
    <text class="empty-title">{{ title }}</text>
    <text v-if="description" class="empty-description">{{ description }}</text>
    <slot />
  </view>
</template>

<style scoped>
.empty-state {
  display: flex;
  padding: 80rpx 36rpx;
  flex-direction: column;
  align-items: center;
  color: var(--color-muted);
  text-align: center;
}

.empty-symbol {
  display: flex;
  width: 92rpx;
  height: 92rpx;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(103, 216, 197, 0.3);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 42rpx;
  font-weight: 800;
}

.empty-title {
  color: var(--color-text);
  font-size: 31rpx;
  font-weight: 720;
}

.empty-description {
  max-width: 520rpx;
  margin-top: 12rpx;
  font-size: 25rpx;
  line-height: 1.65;
}
</style>
