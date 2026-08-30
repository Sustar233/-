<script setup lang="ts">
defineProps<{
  title: string
  count: number
  loading: boolean
}>()

const emit = defineEmits<{
  preview: []
  skip: []
}>()
</script>

<template>
  <view class="section-prompt surface">
    <text class="prompt-kicker">下一小节</text>
    <text class="section-title">{{ title }}</text>
    <text class="section-meta">共 {{ count }} 个知识点</text>
    <text class="prompt-question">是否先看一遍本节知识？</text>
    <button class="primary-button prompt-action" :disabled="loading" @click="emit('preview')">
      先预览
    </button>
    <button
      class="secondary-button prompt-action"
      :loading="loading"
      :disabled="loading"
      @click="emit('skip')"
    >
      直接背记
    </button>
  </view>
</template>

<style scoped>
.section-prompt {
  display: flex;
  min-height: 520rpx;
  padding: 52rpx 36rpx;
  align-items: center;
  flex-direction: column;
  text-align: center;
}

.prompt-kicker,
.section-title,
.section-meta,
.prompt-question {
  display: block;
}

.prompt-kicker {
  color: var(--color-primary);
  font-size: 21rpx;
  font-weight: 720;
}

.section-title {
  margin-top: 16rpx;
  color: var(--color-text);
  font-size: 38rpx;
  font-weight: 780;
}

.section-meta {
  margin-top: 12rpx;
  color: var(--color-muted);
  font-size: 22rpx;
}

.prompt-question {
  margin: 54rpx 0 8rpx;
  color: var(--color-text);
  font-size: 26rpx;
}

.prompt-action {
  width: 100%;
  max-width: 520rpx;
  margin-top: 16rpx;
}
</style>
