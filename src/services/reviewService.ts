import { applyReview, createReviewState } from '@/scheduler/fsrs'
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
  ReviewRating,
  ReviewSession,
  ReviewState,
} from '@/types/review'
import type { Settings } from '@/types/settings'
import { normalizeSettings } from '@/types/settings'
import { addDays, startOfDay } from '@/utils/date'
import { generateId } from '@/utils/id'
import { getCards, orderCardsByKnowledgePath } from './cardService'

export const LEGACY_STUDY_SECTION_SIZE = 8
export const FORGOT_RETRY_MS = 10 * 60_000

const REMEMBER_INTERVAL_DAYS = [1, 2] as const

export interface ReviewQueueOptions {
  includeDueCards?: boolean
}

export interface ReviewQueueData {
  cards: KnowledgeCard[]
  states: ReviewState[]
}

export interface ReviewQueueProgress {
  completed: number
  current: number
  remaining: number
  total: number
}

export function getReviewQueueProgress(
  cardIds: readonly string[],
  currentIndex: number,
): ReviewQueueProgress {
  const safeIndex = Math.min(Math.max(0, currentIndex), cardIds.length)
  const total = new Set(cardIds).size
  const remaining = new Set(cardIds.slice(safeIndex)).size
  const completed = Math.max(0, total - remaining)
  return {
    completed,
    current: remaining ? Math.min(total, completed + 1) : total,
    remaining,
    total,
  }
}

function withDueAt(state: ReviewState, dueAt: number): ReviewState {
  const fsrsData =
    state.fsrsData && typeof state.fsrsData === 'object' && !Array.isArray(state.fsrsData)
      ? { ...(state.fsrsData as Record<string, unknown>), due: new Date(dueAt).toISOString() }
      : state.fsrsData
  return { ...state, dueAt, fsrsData }
}

export function applyKnowledgeReview(
  current: ReviewState,
  rating: ReviewRating,
  now: number,
  settings: Settings,
): ReviewState {
  const scheduled = { ...current, ...applyReview(current, rating, now, settings) }
  const today = startOfDay(now)

  if (rating === 1) {
    return withDueAt(
      {
        ...scheduled,
        rememberedDayStreak: 0,
        lastRememberedDay: undefined,
        lastForgottenDay: today,
        masteredAt: undefined,
      },
      now + FORGOT_RETRY_MS,
    )
  }

  if (rating === 4) {
    return {
      ...scheduled,
      rememberedDayStreak: 3,
      lastRememberedDay: today,
      masteredAt: now,
    }
  }

  // Rating 2 remains readable for legacy data, but the simplified UI no longer emits it.
  if (rating !== 3) return scheduled

  const forgotToday = current.lastForgottenDay === today
  const alreadyRememberedToday = current.lastRememberedDay === today
  const previousStreak = Math.min(3, Math.max(0, current.rememberedDayStreak ?? 0))
  const rememberedDayStreak = forgotToday
    ? 0
    : alreadyRememberedToday
      ? previousStreak
      : Math.min(3, previousStreak + 1)
  const rememberedState: ReviewState = {
    ...scheduled,
    rememberedDayStreak,
    lastRememberedDay: forgotToday ? current.lastRememberedDay : today,
    masteredAt: rememberedDayStreak >= 3 ? now : undefined,
  }

  if (rememberedDayStreak >= 3) return rememberedState
  const intervalDays = REMEMBER_INTERVAL_DAYS[rememberedDayStreak >= 2 ? 1 : 0]
  return withDueAt(rememberedState, addDays(now, intervalDays))
}

export async function getReviewStates(): Promise<ReviewState[]> {
  return (await getStorage<ReviewState[]>(STORAGE_KEYS.reviewStates)) ?? []
}

export async function getReviewLogs(): Promise<ReviewLog[]> {
  return (await getStorage<ReviewLog[]>(STORAGE_KEYS.reviewLogs)) ?? []
}

export function matchesReviewFilter(card: KnowledgeCard, filter: ReviewFilter): boolean {
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
  legacySectionSize = LEGACY_STUDY_SECTION_SIZE,
): KnowledgeCard[] {
  const first = queue[startIndex]
  if (!first || legacySectionSize <= 0) return []

  const newIds = new Set(newCardIds)
  const previewedIds = new Set(previewedCardIds)
  if (!newIds.has(first.id) || previewedIds.has(first.id)) return []

  const batch: KnowledgeCard[] = []
  for (let index = startIndex; index < queue.length; index += 1) {
    const card = queue[index]
    const sameSection = first.sectionId
      ? card?.sectionId === first.sectionId
      : Boolean(
          card &&
            !card.sectionId &&
            card.subjectId === first.subjectId &&
            card.chapterId === first.chapterId &&
            batch.length < legacySectionSize,
        )
    if (
      !card ||
      !sameSection ||
      !newIds.has(card.id) ||
      previewedIds.has(card.id)
    ) {
      break
    }
    batch.push(card)
  }
  return batch
}

function studySectionKeys(cards: KnowledgeCard[]): Map<string, string> {
  const keys = new Map<string, string>()
  const legacyGroups = new Map<string, KnowledgeCard[]>()

  for (const card of cards) {
    if (card.sectionId) {
      keys.set(card.id, `explicit:${card.subjectId}:${card.sectionId}`)
      continue
    }
    const scope = `${card.subjectId}:${card.chapterId ?? 'uncategorized'}`
    const group = legacyGroups.get(scope)
    if (group) group.push(card)
    else legacyGroups.set(scope, [card])
  }

  for (const [scope, group] of legacyGroups) {
    group
      .sort((first, second) => first.createdAt - second.createdAt)
      .forEach((card, index) => {
        keys.set(card.id, `legacy:${scope}:${Math.floor(index / LEGACY_STUDY_SECTION_SIZE)}`)
      })
  }
  return keys
}

export function buildReviewQueueFromData(
  data: ReviewQueueData,
  now: number,
  filter: ReviewFilter = {},
  options: ReviewQueueOptions = {},
): KnowledgeCard[] {
  const { cards, states } = data
  const activeCards = cards.filter(
    (card) => card.status === 'active' && matchesReviewFilter(card, filter),
  )
  const stateByCard = new Map(states.map((state) => [state.cardId, state]))
  const dueCards =
    options.includeDueCards === false
      ? []
      : orderCardsByKnowledgePath(
          activeCards
            .filter((card) => {
              const state = stateByCard.get(card.id)
              return state && !state.masteredAt && state.dueAt <= now
            })
            .sort(
              (first, second) =>
                stateByCard.get(first.id)!.dueAt - stateByCard.get(second.id)!.dueAt,
            ),
          cards,
        )
  const orderedNewCards = orderCardsByKnowledgePath(
    activeCards
      .filter((card) => !stateByCard.has(card.id))
      .sort((first, second) => first.createdAt - second.createdAt),
    cards,
  )
  const sectionKeyByCard = studySectionKeys(cards)
  const nextSectionKey = orderedNewCards[0]
    ? sectionKeyByCard.get(orderedNewCards[0].id)
    : undefined
  const newCards = nextSectionKey
    ? orderedNewCards.filter((card) => sectionKeyByCard.get(card.id) === nextSectionKey)
    : []
  return [...dueCards, ...newCards]
}

export async function buildReviewQueue(
  now = Date.now(),
  filter: ReviewFilter = {},
  options: ReviewQueueOptions = {},
): Promise<KnowledgeCard[]> {
  const cards = await getCards()
  const states = await getReviewStates()
  return buildReviewQueueFromData({ cards, states }, now, filter, options)
}

export function buildTodayReviewQueueFromData(
  cards: KnowledgeCard[],
  logs: ReviewLog[],
  now: number,
  filter: ReviewFilter = {},
  wrongOnly = false,
): KnowledgeCard[] {
  const today = startOfDay(now)
  const activityByCard = new Map<string, { firstReviewedAt: number; wasWrong: boolean }>()

  for (const log of logs) {
    if (startOfDay(log.reviewedAt) !== today) continue
    const previous = activityByCard.get(log.cardId)
    activityByCard.set(log.cardId, {
      firstReviewedAt: Math.min(previous?.firstReviewedAt ?? log.reviewedAt, log.reviewedAt),
      wasWrong: Boolean(previous?.wasWrong) || log.rating === 1,
    })
  }

  return cards
    .filter((card) => {
      const activity = activityByCard.get(card.id)
      return (
        card.status === 'active' &&
        matchesReviewFilter(card, filter) &&
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

export async function buildTodayReviewQueue(
  now = Date.now(),
  filter: ReviewFilter = {},
  wrongOnly = false,
): Promise<KnowledgeCard[]> {
  const cards = await getCards()
  const logs = await getReviewLogs()
  return buildTodayReviewQueueFromData(cards, logs, now, filter, wrongOnly)
}

export function shouldRepeatInCurrentSession(
  _state: ReviewState,
  rating: ReviewRating,
): boolean {
  return rating === 1
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
  const next = applyKnowledgeReview(current, rating, now, normalizeSettings(settingsValue))
  const log: ReviewLog = {
    id: generateId('review'),
    cardId: card.id,
    subjectId: card.subjectId,
    rating,
    reviewedAt: now,
    mode: 'scheduled',
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

export async function commitPracticeReview(
  card: KnowledgeCard,
  rating: ReviewRating,
  now = Date.now(),
  session?: ReviewSession | ((commit: ReviewCommit) => ReviewSession),
): Promise<ReviewCommit> {
  const [states, logs] = await Promise.all([getReviewStates(), getReviewLogs()])
  const previousState = states.find((state) => state.cardId === card.id)
  const unchangedState = previousState ?? createReviewState(card.id, now)
  const log: ReviewLog = {
    id: generateId('review'),
    cardId: card.id,
    subjectId: card.subjectId,
    rating,
    reviewedAt: now,
    mode: 'practice',
  }
  const commit: ReviewCommit = {
    cardId: card.id,
    previousState,
    nextState: unchangedState,
    log,
  }
  const mutations: StorageMutation[] = [
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

export async function restoreMasteredCard(cardId: string, now = Date.now()): Promise<void> {
  const states = await getReviewStates()
  const current = states.find((state) => state.cardId === cardId)
  if (!current?.masteredAt) throw new Error('这张知识卡尚未标记为已掌握')
  const restored = createReviewState(cardId, now)
  await setStorage(
    STORAGE_KEYS.reviewStates,
    [...states.filter((state) => state.cardId !== cardId), restored],
  )
}

export async function undoReview(commit: ReviewCommit, session?: ReviewSession): Promise<void> {
  const [states, logs] = await Promise.all([getReviewStates(), getReviewLogs()])
  if (!logs.some((log) => log.id === commit.log.id)) {
    throw new Error('上一次评分已无法撤销')
  }

  const restoredStates =
    commit.log.mode === 'practice'
      ? states
      : commit.previousState
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
    (session.mode !== undefined && !['scheduled', 'practice'].includes(session.mode)) ||
    (session.previewedCardIds !== undefined &&
      (!Array.isArray(session.previewedCardIds) ||
        !session.previewedCardIds.every((cardId) => typeof cardId === 'string')))
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
