import { defineStore } from 'pinia'
import { ref } from 'vue'
import { deleteCard, getCards, setCardSuspended } from '@/services/cardService'
import type { KnowledgeCard } from '@/types/card'

export const useCardStore = defineStore('cards', () => {
  const cards = ref<KnowledgeCard[]>([])
  const loading = ref(false)

  async function load(subjectId?: string): Promise<void> {
    loading.value = true
    try {
      cards.value = await getCards(subjectId)
    } finally {
      loading.value = false
    }
  }

  async function remove(id: string, subjectId?: string): Promise<void> {
    await deleteCard(id)
    await load(subjectId)
  }

  async function setSuspended(id: string, suspended: boolean, subjectId?: string): Promise<void> {
    await setCardSuspended(id, suspended)
    await load(subjectId)
  }

  return { cards, loading, load, remove, setSuspended }
})
