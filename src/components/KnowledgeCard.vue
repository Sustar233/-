<script setup lang="ts">
import type { KnowledgeCard } from '@/types/card'

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
      <text class="importance">重要度 {{ card.importance }}</text>
      <text v-if="card.status === 'suspended'" class="status">已暂停</text>
    </view>
    <text class="question">{{ card.question }}</text>
    <text class="answer-preview">{{ card.answer }}</text>
    <view v-if="card.tags.length" class="tag-row">
      <text v-for="tag in card.tags" :key="tag" class="tag"># {{ tag }}</text>
    </view>
    <view class="card-actions">
      <button class="text-button" size="mini" @click="$emit('edit')">编辑</button>
      <button class="text-button" size="mini" @click="$emit('toggle')">
        {{ card.status === 'suspended' ? '恢复' : '暂停' }}
      </button>
      <button class="text-button remove" size="mini" @click="$emit('remove')">删除</button>
    </view>
  </view>
</template>

<style scoped>
.knowledge-card {
  margin-bottom: 18rpx;
  padding: 28rpx;
}

.suspended {
  opacity: 0.68;
}

.card-topline {
  display: flex;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.importance,
.status {
  color: #6e7a73;
  font-size: 22rpx;
}

.status {
  color: #aa6c2d;
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
  color: #69736d;
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
  background: #f0f4f1;
  color: #527060;
  font-size: 21rpx;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 18rpx;
}

.remove {
  color: #a9443d;
}
</style>
