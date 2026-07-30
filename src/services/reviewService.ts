import { applyReview, createReviewState, previewReview } from '@/scheduler/fsrs'
import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage, setStorage } from '@/storage/storage'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewLog, ReviewPreview, ReviewRating, ReviewState } from '@/types/review'
import type { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/types/settings'
import { generateId } from '@/utils/id'
import { getCards } from './cardService'

async function getStates(): Promise<ReviewState[]> {
  return (await getStorage<ReviewState[]>(STORAGE_KEYS.reviewStates)) ?? []
}

export async function getReviewLogs(): Promise<ReviewLog[]> {
  return (await getStorage<ReviewLog[]>(STORAGE_KEYS.reviewLogs)) ?? []
}

export async function buildReviewQueue(now = Date.now()): Promise<KnowledgeCard[]> {
  const [cards, states, settings] = await Promise.all([
    getCards(),
    getStates(),
    getStorage<Settings>(STORAGE_KEYS.settings).then((value) => value ?? DEFAULT_SETTINGS),
  ])
  const activeCards = cards.filter((card) => card.status === 'active')
  const stateByCard = new Map(states.map((state) => [state.cardId, state]))
  const dueCards = activeCards
    .filter((card) => {
      const state = stateByCard.get(card.id)
      return state && state.dueAt <= now
    })
    .sort((first, second) => stateByCard.get(first.id)!.dueAt - stateByCard.get(second.id)!.dueAt)
  const newCards = activeCards
    .filter((card) => !stateByCard.has(card.id))
    .sort((first, second) => first.createdAt - second.createdAt)
    .slice(0, Math.max(0, settings.dailyNewCards))
  return [...dueCards, ...newCards]
}

export async function previewCard(cardId: string, now = Date.now()): Promise<ReviewPreview[]> {
  const states = await getStates()
  const state = states.find((item) => item.cardId === cardId) ?? createReviewState(cardId, now)
  return previewReview(state, now)
}

export async function reviewCard(
  card: KnowledgeCard,
  rating: ReviewRating,
  now = Date.now(),
): Promise<ReviewState> {
  const [states, logs] = await Promise.all([getStates(), getReviewLogs()])
  const current = states.find((state) => state.cardId === card.id) ?? createReviewState(card.id, now)
  const next = applyReview(current, rating, now)
  const log: ReviewLog = {
    id: generateId('review'),
    cardId: card.id,
    subjectId: card.subjectId,
    rating,
    reviewedAt: now,
  }
  await Promise.all([
    setStorage(STORAGE_KEYS.reviewStates, [
      ...states.filter((state) => state.cardId !== card.id),
      next,
    ]),
    setStorage(STORAGE_KEYS.reviewLogs, [...logs, log]),
  ])
  return next
}
