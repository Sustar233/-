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
  padding: 26rpx;
}

.stat-label,
.stat-value,
.stat-hint {
  display: block;
}

.stat-label {
  color: #78827c;
  font-size: 23rpx;
}

.stat-value {
  margin-top: 12rpx;
  font-size: 42rpx;
  font-weight: 780;
}

.stat-hint {
  margin-top: 7rpx;
  color: #9aa19d;
  font-size: 20rpx;
}
</style>
