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
      <button class="text-button" size="mini" @click.stop="$emit('edit')">编辑</button>
      <button class="text-button remove" size="mini" @click.stop="$emit('remove')">删除</button>
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

.subject-mark {
  display: flex;
  width: 84rpx;
  height: 84rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  background: #e5efea;
  color: #245b47;
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
  font-weight: 750;
}

.subject-description,
.subject-count {
  overflow: hidden;
  color: #818a84;
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subject-actions {
  display: flex;
  flex-direction: column;
}

.remove {
  color: #a9443d;
}
</style>
