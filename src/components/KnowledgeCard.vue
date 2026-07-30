<script setup lang="ts">
import type { KnowledgeCard } from '@/types/card'

const importanceLabels = ['', '一般', '重要', '重点']

defineProps<{ card: KnowledgeCard }>()

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
  border-left: 5rpx solid #d8e6de;
}

.suspended {
  border-left-color: #ddc4a3;
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
  color: #9c6026;
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

.tag {
  padding: 7rpx 13rpx;
  border-radius: 999rpx;
  border: 1rpx solid #d7e2db;
  background: #edf3ef;
  color: #466957;
  font-size: 21rpx;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 18rpx;
  border-top: 1rpx solid #eee8de;
  padding-top: 10rpx;
}

.remove {
  color: var(--color-danger);
}
</style>
