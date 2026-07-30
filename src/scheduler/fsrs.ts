import { createEmptyCard, fsrs, type Card, type CardInput, type Grade } from 'ts-fsrs'
import type { ReviewPreview, ReviewRating, ReviewState } from '@/types/review'
import { formatInterval } from '@/utils/date'

interface StoredFsrsCard extends Omit<Card, 'due' | 'last_review'> {
  due: string
  last_review?: string
}

const scheduler = fsrs({ enable_fuzz: false })

function serializeCard(card: Card): StoredFsrsCard {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString(),
  }
}

function restoreCard(data: unknown): CardInput {
  if (!data || typeof data !== 'object') {
    throw new Error('复习状态已损坏')
  }

  const card = data as Partial<StoredFsrsCard>
  if (!card.due || typeof card.reps !== 'number' || typeof card.state === 'undefined') {
    throw new Error('复习状态缺少必要字段')
  }
  return card as CardInput
}

export function createReviewState(cardId: string, now = Date.now()): ReviewState {
  const card = createEmptyCard(new Date(now))
  return {
    cardId,
    dueAt: card.due.getTime(),
    fsrsData: serializeCard(card),
  }
}

export function previewReview(state: ReviewState, now = Date.now()): ReviewPreview[] {
  const result = scheduler.repeat(restoreCard(state.fsrsData), new Date(now))
  return ([1, 2, 3, 4] as ReviewRating[]).map((rating) => {
    const dueAt = result[rating].card.due.getTime()
    return {
      rating,
      dueAt,
      intervalLabel: formatInterval(now, dueAt),
    }
  })
}

export function applyReview(
  state: ReviewState,
  rating: ReviewRating,
  now = Date.now(),
): ReviewState {
  const result = scheduler.next(restoreCard(state.fsrsData), new Date(now), rating as Grade)
  return {
    cardId: state.cardId,
    dueAt: result.card.due.getTime(),
    fsrsData: serializeCard(result.card),
    lastReviewAt: now,
  }
}
