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
import { getCards, orderCardsByKnowledgePath } from './cardService'

export const LEARNING_PREVIEW_BATCH_SIZE = 8

export interface ReviewQueueOptions {
  includeDueCards?: boolean
  newCardLimit?: number
}

export async function getReviewStates(): Promise<ReviewState[]> {
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

export function buildLearningPreviewBatch(
  queue: KnowledgeCard[],
  startIndex: number,
  newCardIds: Iterable<string>,
  previewedCardIds: Iterable<string>,
  limit = LEARNING_PREVIEW_BATCH_SIZE,
): KnowledgeCard[] {
  const first = queue[startIndex]
  if (!first || limit <= 0) return []

  const newIds = new Set(newCardIds)
  const previewedIds = new Set(previewedCardIds)
  if (!newIds.has(first.id) || previewedIds.has(first.id)) return []

  const batch: KnowledgeCard[] = []
  for (let index = startIndex; index < queue.length && batch.length < limit; index += 1) {
    const card = queue[index]
    if (
      !card ||
      card.subjectId !== first.subjectId ||
      card.chapterId !== first.chapterId ||
      !newIds.has(card.id) ||
      previewedIds.has(card.id)
    ) {
      break
    }
    batch.push(card)
  }
  return batch
}

export async function buildReviewQueue(
  now = Date.now(),
  filter: ReviewFilter = {},
  options: ReviewQueueOptions = {},
): Promise<KnowledgeCard[]> {
  const [cards, states, logs, settings] = await Promise.all([
    getCards(),
    getReviewStates(),
    getReviewLogs(),
    getStorage<Settings>(STORAGE_KEYS.settings),
  ])
  const activeCards = cards.filter(
    (card) => card.status === 'active' && matchesFilter(card, filter),
  )
  const stateByCard = new Map(states.map((state) => [state.cardId, state]))
  const dueCards =
    options.includeDueCards === false
      ? []
      : orderCardsByKnowledgePath(
          activeCards
            .filter((card) => {
              const state = stateByCard.get(card.id)
              return state && state.dueAt <= now
            })
            .sort(
              (first, second) =>
                stateByCard.get(first.id)!.dueAt - stateByCard.get(second.id)!.dueAt,
            ),
          cards,
        )
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
  const remainingNewCardLimit =
    options.newCardLimit === undefined
      ? Math.max(0, normalizedSettings.dailyNewCards - studiedNewCardsToday)
      : Math.max(0, Math.floor(options.newCardLimit))
  const newCards = orderCardsByKnowledgePath(
    activeCards
      .filter((card) => !stateByCard.has(card.id))
      .sort((first, second) => first.createdAt - second.createdAt),
    cards,
  ).slice(0, remainingNewCardLimit)
  return [...dueCards, ...newCards]
}

export async function buildTodayReviewQueue(
  now = Date.now(),
  filter: ReviewFilter = {},
  wrongOnly = false,
): Promise<KnowledgeCard[]> {
  const [cards, logs] = await Promise.all([getCards(), getReviewLogs()])
  const today = startOfDay(now)
  const activityByCard = new Map<string, { firstReviewedAt: number; wasWrong: boolean }>()

  for (const log of logs) {
    if (startOfDay(log.reviewedAt) !== today) continue
    const previous = activityByCard.get(log.cardId)
    activityByCard.set(log.cardId, {
      firstReviewedAt: Math.min(previous?.firstReviewedAt ?? log.reviewedAt, log.reviewedAt),
      wasWrong: Boolean(previous?.wasWrong) || log.rating <= 2,
    })
  }

  return cards
    .filter((card) => {
      const activity = activityByCard.get(card.id)
      return (
        card.status === 'active' &&
        matchesFilter(card, filter) &&
        Boolean(activity) &&
        (!wrongOnly || activity?.wasWrong)
      )
    })
    .sort((first, second) => {
      const firstActivity = activityByCard.get(first.id)!
      const secondActivity = activityByCard.get(second.id)!
      if (firstActivity.wasWrong !== secondActivity.wasWrong) {
        return firstActivity.wasWrong ? -1 : 1
      }
      return firstActivity.firstReviewedAt - secondActivity.firstReviewedAt
    })
}

export function shouldRepeatInCurrentSession(state: ReviewState, _reviewedAt: number): boolean {
  if (!state.fsrsData || typeof state.fsrsData !== 'object') return false
  const fsrsState = (state.fsrsData as Record<string, unknown>).state
  return fsrsState === 1 || fsrsState === 3
}

export async function previewCard(cardId: string, now = Date.now()): Promise<ReviewPreview[]> {
  const [states, settingsValue] = await Promise.all([
    getReviewStates(),
    getStorage<Settings>(STORAGE_KEYS.settings),
  ])
  const state = states.find((item) => item.cardId === cardId) ?? createReviewState(cardId, now)
  return previewReview(state, now, normalizeSettings(settingsValue))
}

export async function commitReview(
  card: KnowledgeCard,
  rating: ReviewRating,
  now = Date.now(),
  session?: ReviewSession | ((commit: ReviewCommit) => ReviewSession),
): Promise<ReviewCommit> {
  const [states, logs, settingsValue] = await Promise.all([
    getReviewStates(),
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
    const nextSession = typeof session === 'function' ? session(commit) : session
    mutations.push({
      type: 'set',
      key: STORAGE_KEYS.reviewSession,
      value: { ...nextSession, lastCommit: commit },
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
  const [states, logs] = await Promise.all([getReviewStates(), getReviewLogs()])
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
    !session.filter ||
    (session.previewedCardIds !== undefined &&
      (!Array.isArray(session.previewedCardIds) ||
        !session.previewedCardIds.every((cardId) => typeof cardId === 'string'))) ||
    (session.retryDueAtByCardId !== undefined &&
      (!session.retryDueAtByCardId ||
        typeof session.retryDueAtByCardId !== 'object' ||
        Array.isArray(session.retryDueAtByCardId) ||
        !Object.values(session.retryDueAtByCardId).every(
          (dueAt) => typeof dueAt === 'number' && Number.isFinite(dueAt),
        )))
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
