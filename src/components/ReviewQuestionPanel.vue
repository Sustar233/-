<script setup lang="ts">
import { ref, watch } from 'vue'
import ReviewButtons from '@/components/ReviewButtons.vue'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewRating } from '@/types/review'

const props = defineProps<{
  card: KnowledgeCard
  contextCards: KnowledgeCard[]
  contextRevealed: boolean
  revealed: boolean
  practice: boolean
  rating: boolean
  canUndo: boolean
}>()

const emit = defineEmits<{
  showContext: []
  reveal: []
  rate: [value: ReviewRating]
  undo: []
}>()

const noteVisible = ref(false)

watch(
  () => props.card.id,
  () => {
    noteVisible.value = false
  },
)
</script>

<template>
  <view class="question-panel">
    <view class="review-card surface">
      <text class="card-kicker">问题</text>
      <text class="review-question">{{ card.question }}</text>

      <view v-if="contextRevealed" class="inline-context">
        <text class="inline-context-label">脉络提示</text>
        <view v-for="contextCard in contextCards" :key="contextCard.id" class="inline-context-item">
          <text class="inline-context-question">{{ contextCard.question }}</text>
          <text class="inline-context-answer">{{ contextCard.answer }}</text>
        </view>
      </view>

      <view v-if="revealed" class="answer-block">
        <view class="divider" />
        <text class="card-kicker">标准答案</text>
        <text class="review-answer">{{ card.answer }}</text>
        <view v-if="(card.connection || card.note) && noteVisible" class="note-block">
          <view v-if="card.connection" class="note-item">
            <text class="note-label">知识关联</text>
            <text class="note-copy">{{ card.connection }}</text>
          </view>
          <view v-if="card.note" class="note-item">
            <text class="note-label">其他备注</text>
            <text class="note-copy">{{ card.note }}</text>
          </view>
        </view>
        <button
          v-if="card.connection || card.note"
          class="note-toggle"
          @click="noteVisible = !noteVisible"
        >
          {{ noteVisible ? '收起路径' : '路径' }}
        </button>
      </view>
    </view>

    <button
      v-if="!revealed && contextCards.length && !contextRevealed"
      class="secondary-button context-button"
      @click="emit('showContext')"
    >
      查看关联知识
    </button>
    <text v-if="!revealed && contextRevealed" class="hint-advice">
      已使用提示；评分时请如实选择“重来”或“困难”。
    </text>
    <button v-if="!revealed" class="primary-button reveal-button" @click="emit('reveal')">
      显示答案
    </button>
    <view v-if="!revealed && canUndo" class="session-actions">
      <button class="text-button undo-button" @click="emit('undo')">撤销</button>
    </view>
    <ReviewButtons v-if="revealed" :class="{ disabled: rating }" @rate="emit('rate', $event)" />
    <text v-if="revealed && practice" class="practice-note">
      主动练习只记录结果，不改变原复习时间。
    </text>
    <view v-if="revealed && canUndo" class="session-actions">
      <button class="text-button undo-button" @click="emit('undo')">撤销</button>
    </view>
  </view>
</template>

<style scoped>
.review-card {
  min-height: 570rpx;
  padding: 48rpx 38rpx;
  border-top: 4rpx solid var(--color-accent);
}

.card-kicker {
  display: block;
  color: var(--color-primary);
  font-size: 21rpx;
  font-weight: 750;
  letter-spacing: 2rpx;
}

.review-question,
.review-answer {
  display: block;
  white-space: pre-wrap;
}

.inline-context {
  margin-top: 32rpx;
  padding: 22rpx;
  border: 1rpx solid #d3e1da;
  border-radius: 16rpx;
  background: #f7faf8;
}

.inline-context-label {
  display: block;
  margin-bottom: 16rpx;
  color: var(--color-primary);
  font-size: 21rpx;
  font-weight: 740;
}

.inline-context-item + .inline-context-item {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid var(--color-line);
}

.inline-context-question,
.inline-context-answer {
  display: block;
}

.inline-context-question {
  color: var(--color-text);
  font-size: 22rpx;
  font-weight: 680;
  line-height: 1.5;
}

.inline-context-answer {
  margin-top: 7rpx;
  color: var(--color-muted);
  font-size: 21rpx;
  line-height: 1.55;
}

.review-question {
  margin-top: 28rpx;
  color: var(--color-text);
  font-size: 38rpx;
  font-weight: 780;
  line-height: 1.65;
}

.answer-block {
  margin-top: 44rpx;
}

.divider {
  width: 100%;
  height: 1rpx;
  margin-bottom: 40rpx;
  background: var(--color-line);
}

.review-answer {
  margin-top: 24rpx;
  color: var(--color-text);
  font-size: 30rpx;
  line-height: 1.8;
}

.note-toggle {
  margin: 20rpx 0 0 auto;
  padding: 10rpx 0;
  background: transparent;
  color: var(--color-subtle);
  font-size: 22rpx;
  text-align: right;
}

.note-block {
  margin-top: 8rpx;
  padding: 22rpx;
  border-left: 4rpx solid var(--color-accent);
  border-radius: 16rpx;
  background: var(--color-accent-soft);
}

.note-label,
.note-copy {
  display: block;
}

.note-item + .note-item {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid var(--color-line);
}

.note-label {
  color: var(--color-accent);
  font-size: 21rpx;
}

.note-copy {
  margin-top: 9rpx;
  color: var(--color-muted);
  font-size: 24rpx;
  line-height: 1.65;
}

.reveal-button,
.context-button {
  width: 100%;
  margin-top: 26rpx;
}

.context-button {
  margin-top: 22rpx;
}

.hint-advice {
  display: block;
  margin-top: 18rpx;
  color: var(--color-accent);
  font-size: 21rpx;
  line-height: 1.55;
  text-align: center;
}

.disabled {
  margin-top: 24rpx;
  opacity: 0.55;
  pointer-events: none;
}

.review-buttons {
  margin-top: 24rpx;
}

.practice-note {
  display: block;
  margin-top: 16rpx;
  color: var(--color-subtle);
  font-size: 21rpx;
  text-align: center;
}

.session-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 8rpx;
}

.undo-button {
  padding: 4rpx 6rpx;
  color: var(--color-subtle);
  font-size: 20rpx;
  opacity: 0.72;
}
</style>
