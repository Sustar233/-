import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getCards, getKnowledgeContext } from '@/services/cardService'
import {
  buildLearningPreviewBatch,
  buildReviewQueue,
  buildTodayReviewQueue,
  clearReviewSession,
  commitPracticeReview,
  commitReview,
  getReviewSession,
  getReviewStates,
  previewCard,
  reviewFiltersEqual,
  saveReviewSession,
  shouldRepeatInCurrentSession,
  undoReview,
} from '@/services/reviewService'
import type { KnowledgeCard } from '@/types/card'
import type {
  ReviewCommit,
  ReviewFilter,
  ReviewMode,
  ReviewPreview,
  ReviewRating,
  ReviewSession,
} from '@/types/review'
import { startOfDay } from '@/utils/date'

export const useReviewStore = defineStore('review', () => {
  const queue = ref<KnowledgeCard[]>([])
  const currentIndex = ref(0)
  const revealed = ref(false)
  const previews = ref<ReviewPreview[]>([])
  const loading = ref(false)
  const activeFilter = ref<ReviewFilter>({})
  const startedAt = ref(0)
  const lastCommit = ref<ReviewCommit>()
  const resumed = ref(false)
  const learning = ref(false)
  const contextRevealed = ref(false)
  const contextCards = ref<KnowledgeCard[]>([])
  const allCards = ref<KnowledgeCard[]>([])
  const newCardIds = ref<string[]>([])
  const previewedCardIds = ref<string[]>([])
  const learningBatch = ref<KnowledgeCard[]>([])
  const retryDueAtByCardId = ref<Record<string, number>>({})
  const sessionMode = ref<ReviewMode>('scheduled')

  const currentCard = computed(() => queue.value[currentIndex.value] ?? null)
  const completed = computed(() => currentIndex.value)
  const total = computed(() => queue.value.length)
  const finished = computed(() => !loading.value && currentIndex.value >= queue.value.length)
  const canUndo = computed(() => Boolean(lastCommit.value))
  const sessionCardCount = computed(() => new Set(queue.value.map((card) => card.id)).size)
  const currentRetryDueAt = computed(() => {
    const card = currentCard.value
    return card ? retryDueAtByCardId.value[card.id] : undefined
  })

  function prepareCurrent(): void {
    revealed.value = false
    previews.value = []
    contextRevealed.value = false
    const card = currentCard.value
    contextCards.value = card ? getKnowledgeContext(card, allCards.value) : []
    learningBatch.value = buildLearningPreviewBatch(
      queue.value,
      currentIndex.value,
      newCardIds.value,
      previewedCardIds.value,
    )
    learning.value = learningBatch.value.length > 0
  }

  function sessionSnapshot(): ReviewSession {
    return {
      version: 1,
      cardIds: queue.value.map((card) => card.id),
      currentIndex: currentIndex.value,
      startedAt: startedAt.value,
      filter: { ...activeFilter.value },
      mode: sessionMode.value,
      previewedCardIds: [...previewedCardIds.value],
      retryDueAtByCardId: { ...retryDueAtByCardId.value },
      lastCommit: lastCommit.value,
    }
  }

  async function persist(): Promise<void> {
    await saveReviewSession(sessionSnapshot())
  }

  async function start(filter: ReviewFilter = {}, allowResume = true): Promise<void> {
    loading.value = true
    try {
      const now = Date.now()
      const cards = await getCards()
      const [existing, states] = await Promise.all([
        allowResume ? getReviewSession() : Promise.resolve(null),
        getReviewStates(),
      ])
      allCards.value = cards
      const reviewedCardIds = new Set(states.map((state) => state.cardId))
      newCardIds.value = cards
        .filter((card) => !reviewedCardIds.has(card.id))
        .map((card) => card.id)
      if (
        existing &&
        startOfDay(existing.startedAt) === startOfDay(now) &&
        reviewFiltersEqual(existing.filter, filter)
      ) {
        const cardById = new Map(cards.map((card) => [card.id, card]))
        const restoredQueue = existing.cardIds
          .map((id) => cardById.get(id))
          .filter((card): card is KnowledgeCard => Boolean(card))
        if (restoredQueue.length === existing.cardIds.length) {
          queue.value = restoredQueue
          currentIndex.value = Math.min(existing.currentIndex, restoredQueue.length)
          activeFilter.value = { ...existing.filter }
          sessionMode.value = existing.mode ?? 'scheduled'
          startedAt.value = existing.startedAt
          lastCommit.value = existing.lastCommit
          previewedCardIds.value = [...(existing.previewedCardIds ?? [])]
          retryDueAtByCardId.value = { ...(existing.retryDueAtByCardId ?? {}) }
          prepareCurrent()
          resumed.value = currentIndex.value > 0 || currentIndex.value < queue.value.length
          return
        }
      }

      queue.value = await buildReviewQueue(now, filter)
      currentIndex.value = 0
      activeFilter.value = { ...filter }
      sessionMode.value = 'scheduled'
      startedAt.value = now
      lastCommit.value = undefined
      previewedCardIds.value = []
      retryDueAtByCardId.value = {}
      prepareCurrent()
      resumed.value = false
      await persist()
    } finally {
      loading.value = false
    }
  }

  async function reveal(): Promise<void> {
    if (!currentCard.value) return
    if ((currentRetryDueAt.value ?? 0) > Date.now()) return
    previews.value =
      sessionMode.value === 'practice' ? [] : await previewCard(currentCard.value.id)
    revealed.value = true
    resumed.value = false
  }

  async function beginRecall(): Promise<void> {
    const previousPreviewedIds = [...previewedCardIds.value]
    previewedCardIds.value = [
      ...new Set([
        ...previewedCardIds.value,
        ...learningBatch.value.map((card) => card.id),
      ]),
    ]
    try {
      await persist()
      learning.value = false
      learningBatch.value = []
      contextRevealed.value = false
      resumed.value = false
    } catch (error) {
      previewedCardIds.value = previousPreviewedIds
      throw error
    }
  }

  function showContext(): void {
    contextRevealed.value = true
  }

  async function rate(rating: ReviewRating): Promise<void> {
    const card = currentCard.value
    if (!card || (currentRetryDueAt.value ?? 0) > Date.now()) return
    const reviewedAt = Date.now()
    const nextQueue = [...queue.value]
    const nextRetryDueAtByCardId = { ...retryDueAtByCardId.value }
    delete nextRetryDueAtByCardId[card.id]
    const session = sessionSnapshot()
    const commit = sessionMode.value === 'practice' ? commitPracticeReview : commitReview
    lastCommit.value = await commit(card, rating, reviewedAt, (reviewCommit) => {
      if (
        sessionMode.value === 'scheduled' &&
        shouldRepeatInCurrentSession(reviewCommit.nextState, reviewedAt)
      ) {
        nextQueue.push(card)
        nextRetryDueAtByCardId[card.id] = reviewCommit.nextState.dueAt
      }
      return {
        ...session,
        cardIds: nextQueue.map((item) => item.id),
        currentIndex: currentIndex.value + 1,
        retryDueAtByCardId: nextRetryDueAtByCardId,
      }
    })
    queue.value = nextQueue
    retryDueAtByCardId.value = nextRetryDueAtByCardId
    currentIndex.value += 1
    prepareCurrent()
    resumed.value = false
  }

  async function undoLast(): Promise<boolean> {
    if (!lastCommit.value) return false
    const commit = lastCommit.value
    const restoredQueue = [...queue.value]
    if (
      commit.log.mode !== 'practice' &&
      shouldRepeatInCurrentSession(commit.nextState, commit.log.reviewedAt)
    ) {
      const repeatedIndex = restoredQueue.map((card) => card.id).lastIndexOf(commit.cardId)
      if (repeatedIndex >= currentIndex.value) restoredQueue.splice(repeatedIndex, 1)
    }
    const restoredRetryDueAtByCardId = { ...retryDueAtByCardId.value }
    delete restoredRetryDueAtByCardId[commit.cardId]
    const restoredSession: ReviewSession = {
      ...sessionSnapshot(),
      cardIds: restoredQueue.map((card) => card.id),
      currentIndex: Math.max(0, currentIndex.value - 1),
      retryDueAtByCardId: restoredRetryDueAtByCardId,
      lastCommit: undefined,
    }
    await undoReview(commit, restoredSession)
    queue.value = restoredQueue
    retryDueAtByCardId.value = restoredRetryDueAtByCardId
    currentIndex.value = Math.max(0, currentIndex.value - 1)
    lastCommit.value = undefined
    prepareCurrent()
    previews.value =
      sessionMode.value === 'practice' ? [] : await previewCard(commit.cardId)
    learning.value = false
    learningBatch.value = []
    revealed.value = true
    resumed.value = false
    return true
  }

  async function startMoreNewCards(limit = 20): Promise<number> {
    loading.value = true
    try {
      const now = Date.now()
      const [cards, states] = await Promise.all([getCards(), getReviewStates()])
      const nextQueue = await buildReviewQueue(now, activeFilter.value, {
        includeDueCards: false,
        newCardLimit: limit,
      })
      if (!nextQueue.length) return 0

      allCards.value = cards
      sessionMode.value = 'scheduled'
      const reviewedCardIds = new Set(states.map((state) => state.cardId))
      newCardIds.value = cards
        .filter((card) => !reviewedCardIds.has(card.id))
        .map((card) => card.id)
      const preserveWaitingCards =
        !finished.value && (currentRetryDueAt.value ?? 0) > now
      if (preserveWaitingCards) {
        queue.value = [
          ...queue.value.slice(0, currentIndex.value),
          ...nextQueue,
          ...queue.value.slice(currentIndex.value),
        ]
      } else {
        queue.value = nextQueue
        currentIndex.value = 0
        startedAt.value = now
        previewedCardIds.value = []
        retryDueAtByCardId.value = {}
      }
      lastCommit.value = undefined
      prepareCurrent()
      resumed.value = false
      await persist()
      return nextQueue.length
    } finally {
      loading.value = false
    }
  }

  async function startTodayReview(wrongOnly = false): Promise<number> {
    loading.value = true
    const now = Date.now()
    try {
      const reviewQueue = await buildTodayReviewQueue(now, activeFilter.value, wrongOnly)
      if (!reviewQueue.length) return 0

      queue.value = reviewQueue
      sessionMode.value = 'practice'
      currentIndex.value = 0
      startedAt.value = now
      lastCommit.value = undefined
      previewedCardIds.value = reviewQueue.map((card) => card.id)
      retryDueAtByCardId.value = {}
      prepareCurrent()
      resumed.value = false
      await persist()
      return reviewQueue.length
    } finally {
      loading.value = false
    }
  }

  async function finishSession(): Promise<void> {
    await clearReviewSession()
    queue.value = []
    currentIndex.value = 0
    lastCommit.value = undefined
    revealed.value = false
    previews.value = []
    learning.value = false
    learningBatch.value = []
    previewedCardIds.value = []
    retryDueAtByCardId.value = {}
    sessionMode.value = 'scheduled'
    contextRevealed.value = false
    contextCards.value = []
  }

  return {
    queue,
    currentIndex,
    revealed,
    previews,
    loading,
    activeFilter,
    resumed,
    learning,
    contextRevealed,
    contextCards,
    learningBatch,
    sessionMode,
    currentRetryDueAt,
    currentCard,
    completed,
    total,
    sessionCardCount,
    finished,
    canUndo,
    start,
    beginRecall,
    showContext,
    reveal,
    rate,
    undoLast,
    startMoreNewCards,
    startTodayReview,
    finishSession,
  }
})
