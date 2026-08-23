<script setup lang="ts">
import type { KnowledgeCard } from '@/types/card'

const importanceLabels = ['', '一般', '重要', '重点']

defineProps<{ card: KnowledgeCard; parentQuestion?: string }>()

defineEmits<{
  edit: []
  toggle: []
  remove: []
}>()
</script>

<template>
  <view class="knowledge-card surface" :class="{ suspended: card.status === 'suspended' }">
    <view class="card-topline">
      <text class="importance">{{ importanceLabels[card.importance] }}知识</text>
      <text v-if="card.status === 'suspended'" class="status">已暂停</text>
    </view>
    <text class="question">{{ card.question }}</text>
    <text class="answer-preview">{{ card.answer }}</text>
    <view v-if="card.parentCardId || card.connection" class="connection-row">
      <text class="connection-label">脉络</text>
      <text class="connection-copy">
        {{ card.connection || (parentQuestion ? `承接：${parentQuestion}` : '已关联前置知识') }}
      </text>
    </view>
    <view v-if="card.tags.length" class="tag-row">
      <text v-for="tag in card.tags" :key="tag" class="tag"># {{ tag }}</text>
    </view>
    <view class="card-actions">
      <button class="text-button" size="mini" aria-label="编辑知识卡" @click="$emit('edit')">编辑</button>
      <button class="text-button" size="mini" aria-label="切换知识卡状态" @click="$emit('toggle')">
        {{ card.status === 'suspended' ? '恢复' : '暂停' }}
      </button>
      <button class="text-button remove" size="mini" aria-label="删除知识卡" @click="$emit('remove')">删除</button>
    </view>
  </view>
</template>

<style scoped>
.knowledge-card {
  margin-bottom: 18rpx;
  padding: 28rpx;
  border-left: 4rpx solid #c9dcd2;
}

.suspended {
  border-left-color: #d9c5b8;
  opacity: 0.72;
}

.card-topline {
  display: flex;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.importance,
.status {
  color: var(--color-muted);
  font-size: 22rpx;
}

.status {
  color: var(--color-accent);
}

.question,
.answer-preview {
  display: block;
}

.question {
  font-size: 30rpx;
  font-weight: 720;
  line-height: 1.55;
}

.answer-preview {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 12rpx;
  color: var(--color-muted);
  font-size: 25rpx;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 18rpx;
}

.connection-row {
  display: flex;
  margin-top: 16rpx;
  padding: 14rpx 16rpx;
  gap: 12rpx;
  border-left: 3rpx solid var(--color-primary);
  border-radius: 8rpx;
  background: var(--color-primary-soft);
}

.connection-label {
  flex: 0 0 auto;
  color: var(--color-primary);
  font-size: 20rpx;
  font-weight: 720;
}

.connection-copy {
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-muted);
  font-size: 21rpx;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tag {
  padding: 7rpx 13rpx;
  border-radius: 999rpx;
  border: 1rpx solid #d8e2dc;
  background: #f1f5f2;
  color: #4f6d5c;
  font-size: 21rpx;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 18rpx;
  border-top: 1rpx solid var(--color-line);
  padding-top: 10rpx;
}

.remove {
  color: var(--color-danger);
}
</style>
