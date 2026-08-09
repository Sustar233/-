<script setup lang="ts">
import type { Subject } from '@/types/subject'

defineProps<{
  subject: Subject
  cardCount: number
}>()

defineEmits<{
  open: []
  edit: []
  remove: []
}>()
</script>

<template>
  <view class="subject-card surface" @click="$emit('open')">
    <view class="subject-mark">{{ subject.name.slice(0, 1) }}</view>
    <view class="subject-copy">
      <text class="subject-name">{{ subject.name }}</text>
      <text v-if="subject.description" class="subject-description">{{ subject.description }}</text>
      <text class="subject-count">{{ cardCount }} 张知识卡</text>
    </view>
    <view class="subject-actions">
      <button class="text-button" size="mini" aria-label="编辑科目" @click.stop="$emit('edit')">编辑</button>
      <button class="text-button remove" size="mini" aria-label="删除科目" @click.stop="$emit('remove')">删除</button>
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
  transition: border-color 160ms ease, transform 160ms ease;
}

.subject-mark {
  display: flex;
  width: 84rpx;
  height: 84rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  border: 1rpx solid rgba(103, 216, 197, 0.32);
  background: linear-gradient(145deg, rgba(33, 119, 108, 0.58), rgba(11, 66, 68, 0.72));
  color: #a6ecdf;
  font-family: var(--font-display);
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
