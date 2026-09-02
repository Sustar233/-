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
  getReviewQueueProgress,
  getReviewStates,
  matchesReviewFilter,
  reviewFiltersEqual,
  saveReviewSession,
  shouldRepeatInCurrentSession,
  undoReview,
} from '@/services/reviewService'
import { getChapters } from '@/services/subjectService'
import type { KnowledgeCard } from '@/types/card'
import type {
  ReviewCommit,
  ReviewFilter,
  ReviewMode,
  ReviewRating,
  ReviewSession,
} from '@/types/review'
import { startOfDay } from '@/utils/date'

interface StudyContinuation {
  cards: KnowledgeCard[]
  filter: ReviewFilter
  kind: 'chapter' | 'section'
}

export const useReviewStore = defineStore('review', () => {
  const queue = ref<KnowledgeCard[]>([])
  const currentIndex = ref(0)
  const revealed = ref(false)
  const loading = ref(false)
  const activeFilter = ref<ReviewFilter>({})
  const startedAt = ref(0)
  const lastCommit = ref<ReviewCommit>()
  const resumed = ref(false)
  const learning = ref(false)
  const sectionPrompt = ref(false)
  const contextRevealed = ref(false)
  const contextCards = ref<KnowledgeCard[]>([])
  const allCards = ref<KnowledgeCard[]>([])
  const newCardIds = ref<string[]>([])
  const previewedCardIds = ref<string[]>([])
  const learningBatch = ref<KnowledgeCard[]>([])
  const seenCardIds = ref<string[]>([])
  const forgottenCardIds = ref<string[]>([])
  const previousForgottenCardIds = ref<string[]>([])
  const sessionMode = ref<ReviewMode>('scheduled')
  const nextStudy = ref<StudyContinuation>()

  const currentCard = computed(() => queue.value[currentIndex.value] ?? null)
  const queueProgress = computed(() =>
    getReviewQueueProgress(
      queue.value.map((card) => card.id),
      currentIndex.value,
    ),
  )
  const progressCurrent = computed(() => queueProgress.value.current)
  const total = computed(() => queueProgress.value.total)
  const finished = computed(() => !loading.value && currentIndex.value >= queue.value.length)
  const canUndo = computed(() => Boolean(lastCommit.value))
  const sessionCardCount = computed(() => total.value)
  const forgottenCount = computed(() => forgottenCardIds.value.length)
  const progressWidths = computed(() => {
    if (!total.value) return { remembered: '0%', forgotten: '0%' }
    const forgotten = Math.min(forgottenCount.value, total.value)
    const remembered = Math.min(queueProgress.value.completed, total.value - forgotten)
    return {
      remembered: `${(remembered / total.value) * 100}%`,
      forgotten: `${(forgotten / total.value) * 100}%`,
    }
  })
  const nextStudyLabel = computed(() =>
    nextStudy.value?.kind === 'chapter'
      ? '学习下一章'
      : nextStudy.value?.kind === 'section'
        ? '学习下一小节'
        : '',
  )
  const isReinforcement = computed(() => {
    const card = currentCard.value
    return Boolean(
      card && queue.value.slice(0, currentIndex.value).some((item) => item.id === card.id),
    )
  })
  const currentSectionTitle = computed(
    () => learningBatch.value[0]?.sectionTitle ?? currentCard.value?.sectionTitle ?? '本节知识',
  )
  const canMarkCurrentEasy = computed(() => {
    const card = currentCard.value
    return Boolean(
      card && sessionMode.value === 'scheduled' && !seenCardIds.value.includes(card.id),
    )
  })

  function prepareCurrent(): void {
    nextStudy.value = undefined
    revealed.value = false
    contextRevealed.value = false
    const card = currentCard.value
    contextCards.value = card ? getKnowledgeContext(card, allCards.value) : []
    learningBatch.value = buildLearningPreviewBatch(
      queue.value,
      currentIndex.value,
      newCardIds.value,
      previewedCardIds.value,
    )
    sectionPrompt.value = learningBatch.value.length > 0
    learning.value = false
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
      forgottenCardIds: [...forgottenCardIds.value],
      previousForgottenCardIds: [...previousForgottenCardIds.value],
      lastCommit: lastCommit.value,
    }
  }

  async function persist(): Promise<void> {
    await saveReviewSession(sessionSnapshot())
  }

  function currentStudyChapterId(): string | undefined {
    const newIds = new Set(newCardIds.value)
    return (
      queue.value.find((card) => newIds.has(card.id))?.chapterId ??
      activeFilter.value.chapterId ??
      queue.value.find((card) => card.chapterId)?.chapterId
    )
  }

  async function refreshStudyContinuation(): Promise<void> {
    nextStudy.value = undefined
    if (currentIndex.value < queue.value.length || !activeFilter.value.subjectId) return

    const now = Date.now()
    const currentChapterId = currentStudyChapterId()
    const sameScopeCards = await buildReviewQueue(now, activeFilter.value, {
      includeDueCards: false,
    })
    if (sameScopeCards.length) {
      nextStudy.value = {
        cards: sameScopeCards,
        filter: { ...activeFilter.value },
        kind:
          currentChapterId &&
          sameScopeCards[0]?.chapterId &&
          sameScopeCards[0].chapterId !== currentChapterId
            ? 'chapter'
            : 'section',
      }
      return
    }

    if (!currentChapterId || activeFilter.value.uncategorizedOnly) return
    const chapters = await getChapters(activeFilter.value.subjectId)
    const currentChapterIndex = chapters.findIndex((chapter) => chapter.id === currentChapterId)
    if (currentChapterIndex < 0) return

    for (const chapter of chapters.slice(currentChapterIndex + 1)) {
      const filter: ReviewFilter = {
        ...activeFilter.value,
        chapterId: chapter.id,
        uncategorizedOnly: undefined,
      }
      const cards = await buildReviewQueue(now, filter, { includeDueCards: false })
      if (!cards.length) continue
      nextStudy.value = { cards, filter, kind: 'chapter' }
      return
    }
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
      seenCardIds.value = [...reviewedCardIds]
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
        if (
          restoredQueue.length === existing.cardIds.length &&
          restoredQueue.every(
            (card) => card.status === 'active' && matchesReviewFilter(card, existing.filter),
          )
        ) {
          queue.value = restoredQueue
          currentIndex.value = Math.min(existing.currentIndex, restoredQueue.length)
          activeFilter.value = { ...existing.filter }
          sessionMode.value = existing.mode ?? 'scheduled'
          startedAt.value = existing.startedAt
          lastCommit.value = existing.lastCommit
          previewedCardIds.value = [...(existing.previewedCardIds ?? [])]
          forgottenCardIds.value = [
            ...new Set((existing.forgottenCardIds ?? []).filter((cardId) => cardById.has(cardId))),
          ]
          previousForgottenCardIds.value = [
            ...new Set(
              (existing.previousForgottenCardIds ?? []).filter((cardId) => cardById.has(cardId)),
            ),
          ]
          prepareCurrent()
          if (currentIndex.value >= queue.value.length) await refreshStudyContinuation()
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
      forgottenCardIds.value = []
      previousForgottenCardIds.value = []
      prepareCurrent()
      resumed.value = false
      await persist()
    } finally {
      loading.value = false
    }
  }

  function reveal(): void {
    if (!currentCard.value) return
    revealed.value = true
    resumed.value = false
  }

  function previewSection(): void {
    if (!learningBatch.value.length) return
    sectionPrompt.value = false
    learning.value = true
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
      sectionPrompt.value = false
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
    if (!card) return
    const reviewedAt = Date.now()
    const nextQueue = [...queue.value]
    const session = sessionSnapshot()
    const previousForgotten = [...forgottenCardIds.value]
    const nextForgotten =
      rating === 1
        ? [...new Set([...previousForgotten, card.id])]
        : previousForgotten.filter((cardId) => cardId !== card.id)
    const commit = sessionMode.value === 'practice' ? commitPracticeReview : commitReview
    lastCommit.value = await commit(card, rating, reviewedAt, (reviewCommit) => {
      if (shouldRepeatInCurrentSession(reviewCommit.nextState, reviewCommit.log.rating)) {
        nextQueue.push(card)
      }
      return {
        ...session,
        cardIds: nextQueue.map((item) => item.id),
        currentIndex: currentIndex.value + 1,
        forgottenCardIds: nextForgotten,
        previousForgottenCardIds: previousForgotten,
      }
    })
    queue.value = nextQueue
    forgottenCardIds.value = nextForgotten
    previousForgottenCardIds.value = previousForgotten
    if (!seenCardIds.value.includes(card.id)) seenCardIds.value = [...seenCardIds.value, card.id]
    currentIndex.value += 1
    prepareCurrent()
    if (currentIndex.value >= queue.value.length) await refreshStudyContinuation()
    resumed.value = false
  }

  async function undoLast(): Promise<boolean> {
    if (!lastCommit.value) return false
    const commit = lastCommit.value
    const restoredQueue = [...queue.value]
    if (shouldRepeatInCurrentSession(commit.nextState, commit.log.rating)) {
      const repeatedIndex = restoredQueue.map((card) => card.id).lastIndexOf(commit.cardId)
      if (repeatedIndex >= currentIndex.value) restoredQueue.splice(repeatedIndex, 1)
    }
    const restoredSession: ReviewSession = {
      ...sessionSnapshot(),
      cardIds: restoredQueue.map((card) => card.id),
      currentIndex: Math.max(0, currentIndex.value - 1),
      forgottenCardIds: [...previousForgottenCardIds.value],
      previousForgottenCardIds: [],
      lastCommit: undefined,
    }
    await undoReview(commit, restoredSession)
    queue.value = restoredQueue
    if (!commit.previousState) {
      seenCardIds.value = seenCardIds.value.filter((cardId) => cardId !== commit.cardId)
    }
    currentIndex.value = Math.max(0, currentIndex.value - 1)
    forgottenCardIds.value = [...previousForgottenCardIds.value]
    previousForgottenCardIds.value = []
    lastCommit.value = undefined
    prepareCurrent()
    learning.value = false
    learningBatch.value = []
    revealed.value = true
    resumed.value = false
    return true
  }

  async function startNextStudy(): Promise<number> {
    if (!finished.value) return 0
    loading.value = true
    try {
      const now = Date.now()
      await refreshStudyContinuation()
      const continuation = nextStudy.value
      if (!continuation) return 0
      const [cards, states] = await Promise.all([getCards(), getReviewStates()])

      allCards.value = cards
      activeFilter.value = { ...continuation.filter }
      sessionMode.value = 'scheduled'
      const reviewedCardIds = new Set(states.map((state) => state.cardId))
      seenCardIds.value = [...reviewedCardIds]
      newCardIds.value = cards
        .filter((card) => !reviewedCardIds.has(card.id))
        .map((card) => card.id)
      queue.value = continuation.cards
      currentIndex.value = 0
      startedAt.value = now
      previewedCardIds.value = []
      forgottenCardIds.value = []
      previousForgottenCardIds.value = []
      lastCommit.value = undefined
      prepareCurrent()
      resumed.value = false
      await persist()
      return continuation.cards.length
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
      nextStudy.value = undefined
      sessionMode.value = 'practice'
      currentIndex.value = 0
      startedAt.value = now
      lastCommit.value = undefined
      previewedCardIds.value = reviewQueue.map((card) => card.id)
      forgottenCardIds.value = []
      previousForgottenCardIds.value = []
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
    sectionPrompt.value = false
    learning.value = false
    learningBatch.value = []
    previewedCardIds.value = []
    forgottenCardIds.value = []
    previousForgottenCardIds.value = []
    seenCardIds.value = []
    sessionMode.value = 'scheduled'
    contextRevealed.value = false
    contextCards.value = []
    nextStudy.value = undefined
  }

  return {
    queue,
    currentIndex,
    revealed,
    loading,
    activeFilter,
    resumed,
    sectionPrompt,
    learning,
    contextRevealed,
    contextCards,
    learningBatch,
    sessionMode,
    isReinforcement,
    currentSectionTitle,
    canMarkCurrentEasy,
    currentCard,
    progressCurrent,
    total,
    forgottenCount,
    progressWidths,
    sessionCardCount,
    finished,
    canUndo,
    nextStudyLabel,
    start,
    previewSection,
    beginRecall,
    showContext,
    reveal,
    rate,
    undoLast,
    startNextStudy,
    startTodayReview,
    finishSession,
  }
})
