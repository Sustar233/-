import { createEmptyCard, fsrs, type Card, type CardInput, type Grade } from 'ts-fsrs'
import type { ReviewPreview, ReviewRating, ReviewState } from '@/types/review'
import { DEFAULT_SETTINGS, type Settings } from '@/types/settings'
import { formatInterval } from '@/utils/date'

export interface StoredFsrsCard extends Omit<Card, 'due' | 'last_review'> {
  due: string
  last_review?: string
}

const INTEGER_FIELDS = [
  'elapsed_days',
  'scheduled_days',
  'learning_steps',
  'reps',
  'lapses',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function createScheduler(settings: Settings) {
  return fsrs({
    enable_fuzz: settings.enableFuzz,
    request_retention: settings.desiredRetention,
  })
}

function serializeCard(card: Card): StoredFsrsCard {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString(),
  }
}

export function parseStoredFsrsCard(data: unknown): CardInput {
  if (!isRecord(data)) {
    throw new Error('复习状态已损坏')
  }

  if (
    typeof data.due !== 'string' ||
    !Number.isFinite(Date.parse(data.due)) ||
    !isNonNegativeNumber(data.stability) ||
    !isNonNegativeNumber(data.difficulty) ||
    !INTEGER_FIELDS.every(
      (field) => isNonNegativeNumber(data[field]) && Number.isInteger(data[field]),
    ) ||
    typeof data.state !== 'number' ||
    !Number.isInteger(data.state) ||
    ![0, 1, 2, 3].includes(data.state) ||
    !(
      data.last_review === undefined ||
      data.last_review === null ||
      (typeof data.last_review === 'string' && Number.isFinite(Date.parse(data.last_review)))
    )
  ) {
    throw new Error('复习状态缺少必要字段')
  }

  return data as unknown as CardInput
}

export function isStoredFsrsCard(data: unknown): boolean {
  try {
    parseStoredFsrsCard(data)
    return true
  } catch {
    return false
  }
}

export function createReviewState(cardId: string, now = Date.now()): ReviewState {
  const card = createEmptyCard(new Date(now))
  return {
    cardId,
    dueAt: card.due.getTime(),
    fsrsData: serializeCard(card),
  }
}

export function previewReview(
  state: ReviewState,
  now = Date.now(),
  settings = DEFAULT_SETTINGS,
): ReviewPreview[] {
  const scheduler = createScheduler(settings)
  const result = scheduler.repeat(parseStoredFsrsCard(state.fsrsData), new Date(now))
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
  settings = DEFAULT_SETTINGS,
): ReviewState {
  const scheduler = createScheduler(settings)
  const result = scheduler.next(parseStoredFsrsCard(state.fsrsData), new Date(now), rating as Grade)
  return {
    cardId: state.cardId,
    dueAt: result.card.due.getTime(),
    fsrsData: serializeCard(result.card),
    lastReviewAt: now,
  }
}
