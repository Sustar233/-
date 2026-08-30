<script setup lang="ts">
withDefaults(
  defineProps<{
    loading: boolean
    canUndo?: boolean
    backLabel?: string
  }>(),
  {
    canUndo: false,
    backLabel: '返回',
  },
)

const emit = defineEmits<{
  undo: []
  learnMore: []
  reviewWrong: []
  reviewToday: []
  back: []
}>()
</script>

<template>
  <view class="continuation-actions">
    <button v-if="canUndo" class="secondary-button" :disabled="loading" @click="emit('undo')">
      撤销上次评分
    </button>
    <button class="primary-button" :loading="loading" :disabled="loading" @click="emit('learnMore')">
      继续学习 20 张
    </button>
    <button class="secondary-button" :disabled="loading" @click="emit('reviewWrong')">
      复习今日错题
    </button>
    <button class="secondary-button" :disabled="loading" @click="emit('reviewToday')">
      复习今日知识
    </button>
    <button class="text-button" :disabled="loading" @click="emit('back')">{{ backLabel }}</button>
  </view>
</template>

<style scoped>
.continuation-actions {
  display: flex;
  width: 100%;
  max-width: 520rpx;
  margin-top: 30rpx;
  flex-direction: column;
  gap: 14rpx;
}
</style>
