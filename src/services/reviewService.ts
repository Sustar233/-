import { applyReview, createReviewState, previewReview } from '@/scheduler/fsrs'
import { STORAGE_KEYS } from '@/storage/keys'
import {
  getStorage,
  removeStorage,
  setStorage,
  setStorageBatch,
  type StorageMutation,
} from '@/storage/storage'
import type { KnowledgeCard } from '@/types/card'
import type {
  ReviewCommit,
  ReviewFilter,
  ReviewLog,
  ReviewPreview,
  ReviewRating,
  ReviewSession,
  ReviewState,
} from '@/types/review'
import type { Settings } from '@/types/settings'
import { normalizeSettings } from '@/types/settings'
import { startOfDay } from '@/utils/date'
import { generateId } from '@/utils/id'
import { getCards } from './cardService'

async function getStates(): Promise<ReviewState[]> {
  return (await getStorage<ReviewState[]>(STORAGE_KEYS.reviewStates)) ?? []
}

export async function getReviewLogs(): Promise<ReviewLog[]> {
  return (await getStorage<ReviewLog[]>(STORAGE_KEYS.reviewLogs)) ?? []
}

function matchesFilter(card: KnowledgeCard, filter: ReviewFilter): boolean {
  if (filter.subjectId && card.subjectId !== filter.subjectId) return false
  if (filter.uncategorizedOnly && card.chapterId) return false
  if (filter.chapterId && card.chapterId !== filter.chapterId) return false
  if (filter.tag && !card.tags.includes(filter.tag)) return false
  return true
}

export function reviewFiltersEqual(first: ReviewFilter, second: ReviewFilter): boolean {
  return (
    first.subjectId === second.subjectId &&
    first.chapterId === second.chapterId &&
    Boolean(first.uncategorizedOnly) === Boolean(second.uncategorizedOnly) &&
    first.tag === second.tag
  )
}

export async function buildReviewQueue(
  now = Date.now(),
  filter: ReviewFilter = {},
): Promise<KnowledgeCard[]> {
  const [cards, states, logs, settings] = await Promise.all([
    getCards(),
    getStates(),
    getReviewLogs(),
    getStorage<Settings>(STORAGE_KEYS.settings),
  ])
  const activeCards = cards.filter(
    (card) => card.status === 'active' && matchesFilter(card, filter),
  )
  const stateByCard = new Map(states.map((state) => [state.cardId, state]))
  const dueCards = activeCards
    .filter((card) => {
      const state = stateByCard.get(card.id)
      return state && state.dueAt <= now
    })
    .sort((first, second) => stateByCard.get(first.id)!.dueAt - stateByCard.get(second.id)!.dueAt)
  const firstReviewByCard = new Map<string, number>()
  for (const log of logs) {
    const firstReviewAt = firstReviewByCard.get(log.cardId)
    if (firstReviewAt === undefined || log.reviewedAt < firstReviewAt) {
      firstReviewByCard.set(log.cardId, log.reviewedAt)
    }
  }
  const today = startOfDay(now)
  const studiedNewCardsToday = [...firstReviewByCard.values()].filter(
    (reviewedAt) => startOfDay(reviewedAt) === today,
  ).length
  const normalizedSettings = normalizeSettings(settings)
  const remainingNewCardLimit = Math.max(
    0,
    normalizedSettings.dailyNewCards - studiedNewCardsToday,
  )
  const newCards = activeCards
    .filter((card) => !stateByCard.has(card.id))
    .sort((first, second) => first.createdAt - second.createdAt)
    .slice(0, remainingNewCardLimit)
  return [...dueCards, ...newCards]
}

export async function previewCard(cardId: string, now = Date.now()): Promise<ReviewPreview[]> {
  const [states, settingsValue] = await Promise.all([
    getStates(),
    getStorage<Settings>(STORAGE_KEYS.settings),
  ])
  const state = states.find((item) => item.cardId === cardId) ?? createReviewState(cardId, now)
  return previewReview(state, now, normalizeSettings(settingsValue))
}

export async function commitReview(
  card: KnowledgeCard,
  rating: ReviewRating,
  now = Date.now(),
  session?: ReviewSession,
): Promise<ReviewCommit> {
  const [states, logs, settingsValue] = await Promise.all([
    getStates(),
    getReviewLogs(),
    getStorage<Settings>(STORAGE_KEYS.settings),
  ])
  const previousState = states.find((state) => state.cardId === card.id)
  const current = previousState ?? createReviewState(card.id, now)
  const next = applyReview(current, rating, now, normalizeSettings(settingsValue))
  const log: ReviewLog = {
    id: generateId('review'),
    cardId: card.id,
    subjectId: card.subjectId,
    rating,
    reviewedAt: now,
  }
  const commit: ReviewCommit = { cardId: card.id, previousState, nextState: next, log }
  const mutations: StorageMutation[] = [
    { type: 'set', key: STORAGE_KEYS.reviewStates, value: [
      ...states.filter((state) => state.cardId !== card.id),
      next,
    ] },
    { type: 'set', key: STORAGE_KEYS.reviewLogs, value: [...logs, log] },
  ]
  if (session) {
    mutations.push({
      type: 'set',
      key: STORAGE_KEYS.reviewSession,
      value: { ...session, lastCommit: commit },
    })
  }
  await setStorageBatch(mutations)
  return commit
}

export async function reviewCard(
  card: KnowledgeCard,
  rating: ReviewRating,
  now = Date.now(),
): Promise<ReviewState> {
  return (await commitReview(card, rating, now)).nextState
}

export async function undoReview(commit: ReviewCommit, session?: ReviewSession): Promise<void> {
  const [states, logs] = await Promise.all([getStates(), getReviewLogs()])
  if (!logs.some((log) => log.id === commit.log.id)) {
    throw new Error('上一次评分已无法撤销')
  }

  const restoredStates = commit.previousState
    ? [
        ...states.filter((state) => state.cardId !== commit.cardId),
        commit.previousState,
      ]
    : states.filter((state) => state.cardId !== commit.cardId)

  const mutations: StorageMutation[] = [
    { type: 'set', key: STORAGE_KEYS.reviewStates, value: restoredStates },
    {
      type: 'set',
      key: STORAGE_KEYS.reviewLogs,
      value: logs.filter((log) => log.id !== commit.log.id),
    },
  ]
  if (session) {
    mutations.push({ type: 'set', key: STORAGE_KEYS.reviewSession, value: session })
  }
  await setStorageBatch(mutations)
}

export async function getReviewSession(): Promise<ReviewSession | null> {
  const session = await getStorage<ReviewSession>(STORAGE_KEYS.reviewSession)
  if (
    !session ||
    session.version !== 1 ||
    !Array.isArray(session.cardIds) ||
    !Number.isInteger(session.currentIndex) ||
    session.currentIndex < 0 ||
    typeof session.startedAt !== 'number' ||
    !session.filter
  ) {
    return null
  }
  return session
}

export async function saveReviewSession(session: ReviewSession): Promise<void> {
  await setStorage(STORAGE_KEYS.reviewSession, session)
}

export async function clearReviewSession(): Promise<void> {
  await removeStorage(STORAGE_KEYS.reviewSession)
}
