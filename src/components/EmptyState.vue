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
    <text class="empty-title">{{ title }}</text>
    <text v-if="description" class="empty-description">{{ description }}</text>
    <slot />
  </view>
</template>

<style scoped>
.empty-state {
  display: flex;
  padding: 68rpx 32rpx;
  flex-direction: column;
  align-items: center;
  color: var(--color-muted);
  text-align: center;
}

.empty-title {
  color: var(--color-text);
  font-size: 29rpx;
  font-weight: 700;
}

.empty-description {
  max-width: 520rpx;
  margin-top: 12rpx;
  font-size: 25rpx;
  line-height: 1.65;
}
</style>
