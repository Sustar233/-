<script setup lang="ts">
import { computed, ref } from 'vue'
import type { KnowledgeCard } from '@/types/card'

const importanceLabels = ['', '一般', '重要', '非常重要']

const props = defineProps<{ card: KnowledgeCard; mastered?: boolean }>()
const noteVisible = ref(false)
const hasNote = computed(() => Boolean(props.card.connection || props.card.note))

defineEmits<{
  edit: []
  toggle: []
  restore: []
  remove: []
}>()
</script>

<template>
  <view
    class="knowledge-card surface"
    :class="{ suspended: card.status === 'suspended', mastered }"
  >
    <view class="card-topline">
      <text class="importance">{{ importanceLabels[card.importance] }}知识</text>
      <text v-if="mastered" class="status mastered-status">已掌握</text>
      <text v-else-if="card.status === 'suspended'" class="status">已暂停</text>
    </view>
    <text class="question">{{ card.question }}</text>
    <text class="answer-preview">{{ card.answer }}</text>
    <view v-if="card.tags.length" class="tag-row">
      <text v-for="tag in card.tags" :key="tag" class="tag"># {{ tag }}</text>
    </view>
    <view v-if="hasNote && noteVisible" class="note-panel">
      <text v-if="card.connection" class="note-copy">章节：{{ card.connection }}</text>
      <text v-if="card.note" class="note-copy">备注：{{ card.note }}</text>
    </view>
    <button
      v-if="hasNote"
      class="text-button note-toggle"
      size="mini"
      @click="noteVisible = !noteVisible"
    >
      {{ noteVisible ? '收起路径' : '路径' }}
    </button>
    <view class="card-actions">
      <button class="text-button" size="mini" aria-label="编辑知识卡" @click="$emit('edit')">编辑</button>
      <button
        v-if="mastered"
        class="text-button"
        size="mini"
        aria-label="恢复学习知识卡"
        @click="$emit('restore')"
      >
        恢复学习
      </button>
      <button v-else class="text-button" size="mini" aria-label="切换知识卡状态" @click="$emit('toggle')">
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

.mastered {
  border-left-color: #a8c9b7;
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

.mastered-status {
  color: var(--color-primary);
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

.note-toggle {
  margin: 16rpx 0 0 auto;
  padding-right: 0;
  text-align: right;
}

.note-panel {
  margin-top: 10rpx;
  padding: 16rpx;
  border: 1rpx solid var(--color-line);
  border-radius: 10rpx;
  background: var(--color-surface-strong);
}

.note-copy {
  display: block;
  color: var(--color-muted);
  font-size: 21rpx;
  line-height: 1.6;
}

.note-copy + .note-copy {
  margin-top: 10rpx;
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
