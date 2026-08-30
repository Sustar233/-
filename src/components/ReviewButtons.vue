<script setup lang="ts">
import type { ReviewRating } from '@/types/review'

const emit = defineEmits<{ rate: [rating: ReviewRating] }>()

const options: Array<{ rating: ReviewRating; label: string; className: string }> = [
  { rating: 1, label: '忘了', className: 'again' },
  { rating: 3, label: '记住', className: 'good' },
]
</script>

<template>
  <view class="review-buttons">
    <button
      v-for="option in options"
      :key="option.rating"
      class="rating-button"
      :class="option.className"
      @click="emit('rate', option.rating)"
    >
      <text class="rating-label">{{ option.label }}</text>
    </button>
  </view>
</template>

<style scoped>
.review-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
}

.rating-button {
  display: flex;
  min-width: 0;
  height: 96rpx;
  padding: 16rpx 6rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1rpx solid var(--color-line);
  background: var(--color-surface);
}

.again { color: #a3453e; border-color: #e7c8c5; background: #fbf1ef; }
.good { color: var(--color-primary); border-color: #c7dbd1; background: var(--color-primary-soft); }

.rating-label {
  display: block;
  font-size: 26rpx;
  font-weight: 750;
}
</style>
