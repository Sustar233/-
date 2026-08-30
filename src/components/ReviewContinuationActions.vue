<script setup lang="ts">
withDefaults(
  defineProps<{
    loading: boolean
    canUndo?: boolean
    backLabel?: string
    nextLabel?: string
  }>(),
  {
    canUndo: false,
    backLabel: '返回',
    nextLabel: '',
  },
)

const emit = defineEmits<{
  undo: []
  nextStudy: []
  review: []
  back: []
}>()
</script>

<template>
  <view class="continuation-actions">
    <button
      v-if="nextLabel"
      class="primary-button"
      :loading="loading"
      :disabled="loading"
      @click="emit('nextStudy')"
    >
      {{ nextLabel }}
    </button>
    <button class="secondary-button" :disabled="loading" @click="emit('review')">复习</button>
    <button class="text-button" :disabled="loading" @click="emit('back')">{{ backLabel }}</button>
    <button
      v-if="canUndo"
      class="text-button undo-button"
      :disabled="loading"
      @click="emit('undo')"
    >
      撤销
    </button>
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

.undo-button {
  align-self: flex-end;
  padding: 4rpx 6rpx;
  color: var(--color-subtle);
  font-size: 20rpx;
  opacity: 0.72;
}
</style>
