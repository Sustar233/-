<script setup lang="ts">
import type { KnowledgeCard } from '@/types/card'

defineProps<{
  cards: KnowledgeCard[]
  loading: boolean
}>()

const emit = defineEmits<{
  begin: []
}>()
</script>

<template>
  <view class="learning-panel">
    <view class="learning-notice surface">
      <text class="learning-label">新知识 · 先学后背</text>
      <button class="text-button skip-preview" :disabled="loading" @click="emit('begin')">
        跳过预览
      </button>
    </view>

    <view class="learning-list">
      <view v-for="(card, index) in cards" :key="card.id" class="learning-item surface">
        <text class="learning-index">{{ index + 1 }}</text>
        <view class="learning-copy">
          <text class="learning-question">{{ card.question }}</text>
          <text class="learning-answer">{{ card.answer }}</text>
        </view>
      </view>
    </view>

    <button
      class="primary-button reveal-button"
      :loading="loading"
      :disabled="loading"
      @click="emit('begin')"
    >
      开始背记这 {{ cards.length }} 个知识点
    </button>
  </view>
</template>

<style scoped>
.learning-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding: 22rpx 24rpx;
  border-left: 5rpx solid var(--color-primary);
}

.learning-label {
  display: block;
  color: var(--color-primary);
  font-size: 23rpx;
  font-weight: 750;
}

.skip-preview {
  padding: 4rpx 0;
  color: var(--color-subtle);
  font-size: 21rpx;
}

.learning-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.learning-item {
  display: flex;
  gap: 18rpx;
  padding: 26rpx;
}

.learning-index {
  display: flex;
  width: 38rpx;
  height: 38rpx;
  flex: 0 0 38rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 19rpx;
  font-weight: 720;
}

.learning-copy {
  min-width: 0;
  flex: 1;
}

.learning-question,
.learning-answer {
  display: block;
  white-space: pre-wrap;
}

.learning-question {
  color: var(--color-text);
  font-size: 27rpx;
  font-weight: 720;
  line-height: 1.55;
}

.learning-answer {
  margin-top: 12rpx;
  color: var(--color-muted);
  font-size: 24rpx;
  line-height: 1.7;
}

.reveal-button {
  width: 100%;
  margin-top: 26rpx;
}
</style>
