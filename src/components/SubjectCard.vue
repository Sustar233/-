<script setup lang="ts">
import type { Subject } from '@/types/subject'

defineProps<{
  subject: Subject
  cardCount: number
  busy?: boolean
}>()

defineEmits<{
  open: []
  edit: []
  remove: []
}>()
</script>

<template>
  <view class="subject-card surface">
    <button class="subject-open" :disabled="busy" :aria-label="`打开科目：${subject.name}`" @click="$emit('open')">
    <view class="subject-mark">{{ subject.name.slice(0, 1) }}</view>
    <view class="subject-copy">
      <text class="subject-name">{{ subject.name }}</text>
      <text v-if="subject.description" class="subject-description">{{ subject.description }}</text>
      <text class="subject-count">{{ cardCount }} 张知识卡</text>
    </view>
    </button>
    <view class="subject-actions">
      <button class="text-button" size="mini" :disabled="busy" aria-label="编辑科目" @click="$emit('edit')">编辑</button>
      <button class="text-button remove" size="mini" :disabled="busy" aria-label="删除科目" @click="$emit('remove')">删除</button>
    </view>
  </view>
</template>

<style scoped>
.subject-card {
  display: flex;
  align-items: center;
  gap: 22rpx;
  margin-bottom: 18rpx;
  padding: 26rpx;
}

.subject-open {
  display: flex;
  align-items: center;
  gap: 22rpx;
  flex: 1;
  min-width: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text);
  text-align: left;
}

.subject-mark {
  display: flex;
  width: 84rpx;
  height: 84rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 34rpx;
  font-weight: 800;
}

.subject-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 7rpx;
}

.subject-name {
  overflow-wrap: anywhere;
  line-height: 1.5;
  font-size: 30rpx;
  font-weight: 760;
}

.subject-description,
.subject-count {
  overflow: hidden;
  color: var(--color-muted);
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subject-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.remove {
  color: var(--color-danger);
}
</style>
