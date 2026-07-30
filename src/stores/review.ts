import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { buildReviewQueue, previewCard, reviewCard } from '@/services/reviewService'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewPreview, ReviewRating } from '@/types/review'

export const useReviewStore = defineStore('review', () => {
  const queue = ref<KnowledgeCard[]>([])
  const currentIndex = ref(0)
  const revealed = ref(false)
  const previews = ref<ReviewPreview[]>([])
  const loading = ref(false)

  const currentCard = computed(() => queue.value[currentIndex.value] ?? null)
  const completed = computed(() => currentIndex.value)
  const total = computed(() => queue.value.length)
  const finished = computed(() => !loading.value && currentIndex.value >= queue.value.length)

  async function start(): Promise<void> {
    loading.value = true
    try {
      queue.value = await buildReviewQueue()
      currentIndex.value = 0
      revealed.value = false
      previews.value = []
    } finally {
      loading.value = false
    }
  }

  async function reveal(): Promise<void> {
    if (!currentCard.value) return
    previews.value = await previewCard(currentCard.value.id)
    revealed.value = true
  }

  async function rate(rating: ReviewRating): Promise<void> {
    if (!currentCard.value) return
    await reviewCard(currentCard.value, rating)
    currentIndex.value += 1
    revealed.value = false
    previews.value = []
  }

  return {
    queue,
    currentIndex,
    revealed,
    previews,
    loading,
    currentCard,
    completed,
    total,
    finished,
    start,
    reveal,
    rate,
  }
})
