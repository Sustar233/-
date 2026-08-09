import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getCards } from '@/services/cardService'
import {
  buildReviewQueue,
  clearReviewSession,
  commitReview,
  getReviewSession,
  previewCard,
  reviewFiltersEqual,
  saveReviewSession,
  undoReview,
} from '@/services/reviewService'
import type { KnowledgeCard } from '@/types/card'
import type {
  ReviewCommit,
  ReviewFilter,
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

  const currentCard = computed(() => queue.value[currentIndex.value] ?? null)
  const completed = computed(() => currentIndex.value)
  const total = computed(() => queue.value.length)
  const finished = computed(() => !loading.value && currentIndex.value >= queue.value.length)
  const canUndo = computed(() => Boolean(lastCommit.value))

  function sessionSnapshot(): ReviewSession {
    return {
      version: 1,
      cardIds: queue.value.map((card) => card.id),
      currentIndex: currentIndex.value,
      startedAt: startedAt.value,
      filter: { ...activeFilter.value },
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
      const existing = allowResume ? await getReviewSession() : null
      if (
        existing &&
        startOfDay(existing.startedAt) === startOfDay(now) &&
        reviewFiltersEqual(existing.filter, filter)
      ) {
        const cards = await getCards()
        const cardById = new Map(cards.map((card) => [card.id, card]))
        const restoredQueue = existing.cardIds
          .map((id) => cardById.get(id))
          .filter((card): card is KnowledgeCard => Boolean(card))
        if (restoredQueue.length === existing.cardIds.length) {
          queue.value = restoredQueue
          currentIndex.value = Math.min(existing.currentIndex, restoredQueue.length)
          activeFilter.value = { ...existing.filter }
          startedAt.value = existing.startedAt
          lastCommit.value = existing.lastCommit
          revealed.value = false
          previews.value = []
          resumed.value = currentIndex.value > 0 || currentIndex.value < queue.value.length
          return
        }
      }

      queue.value = await buildReviewQueue(now, filter)
      currentIndex.value = 0
      activeFilter.value = { ...filter }
      startedAt.value = now
      lastCommit.value = undefined
      revealed.value = false
      previews.value = []
      resumed.value = false
      await persist()
    } finally {
      loading.value = false
    }
  }

  async function reveal(): Promise<void> {
    if (!currentCard.value) return
    previews.value = await previewCard(currentCard.value.id)
    revealed.value = true
    resumed.value = false
  }

  async function rate(rating: ReviewRating): Promise<void> {
    if (!currentCard.value) return
    const nextSession: ReviewSession = {
      ...sessionSnapshot(),
      currentIndex: currentIndex.value + 1,
    }
    lastCommit.value = await commitReview(currentCard.value, rating, Date.now(), nextSession)
    currentIndex.value += 1
    revealed.value = false
    previews.value = []
    resumed.value = false
  }

  async function skip(): Promise<boolean> {
    if (!currentCard.value || queue.value.length - currentIndex.value <= 1) return false
    const reordered = [...queue.value]
    const [skipped] = reordered.splice(currentIndex.value, 1)
    reordered.push(skipped)
    queue.value = reordered
    revealed.value = false
    previews.value = []
    resumed.value = false
    await persist()
    return true
  }

  async function undoLast(): Promise<boolean> {
    if (!lastCommit.value) return false
    const commit = lastCommit.value
    const restoredSession: ReviewSession = {
      ...sessionSnapshot(),
      currentIndex: Math.max(0, currentIndex.value - 1),
      lastCommit: undefined,
    }
    await undoReview(commit, restoredSession)
    currentIndex.value = Math.max(0, currentIndex.value - 1)
    lastCommit.value = undefined
    previews.value = await previewCard(commit.cardId)
    revealed.value = true
    resumed.value = false
    return true
  }

  async function finishSession(): Promise<void> {
    await clearReviewSession()
    queue.value = []
    currentIndex.value = 0
    lastCommit.value = undefined
    revealed.value = false
    previews.value = []
  }

  return {
    queue,
    currentIndex,
    revealed,
    previews,
    loading,
    activeFilter,
    resumed,
    currentCard,
    completed,
    total,
    finished,
    canUndo,
    start,
    reveal,
    rate,
    skip,
    undoLast,
    finishSession,
  }
})
