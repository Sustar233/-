<script setup lang="ts">
import type { ReviewPreview, ReviewRating } from '@/types/review'

const props = defineProps<{ previews: ReviewPreview[] }>()
const emit = defineEmits<{ rate: [rating: ReviewRating] }>()

const options: Array<{ rating: ReviewRating; label: string; className: string }> = [
  { rating: 1, label: '重来', className: 'again' },
  { rating: 2, label: '困难', className: 'hard' },
  { rating: 3, label: '记住', className: 'good' },
  { rating: 4, label: '简单', className: 'easy' },
]

function intervalFor(rating: ReviewRating): string {
  return props.previews.find((item) => item.rating === rating)?.intervalLabel ?? '—'
}
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
      <text class="rating-interval">{{ intervalFor(option.rating) }}</text>
    </button>
  </view>
</template>

<style scoped>
.review-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
}

.rating-button {
  display: flex;
  min-width: 0;
  height: 112rpx;
  padding: 16rpx 6rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 8rpx 18rpx rgba(43, 48, 43, 0.1);
}

.again { background: #a8473f; }
.hard { background: #a56a29; }
.good { background: #1f5a49; }
.easy { background: #3d6781; }

.rating-label,
.rating-interval {
  display: block;
}

.rating-label {
  font-size: 26rpx;
  font-weight: 750;
}

.rating-interval {
  margin-top: 8rpx;
  font-size: 19rpx;
  opacity: 0.88;
}
</style>
