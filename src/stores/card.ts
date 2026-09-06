import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { deleteCard, getCards, setCardSuspended } from '@/services/cardService'
import type { KnowledgeCard } from '@/types/card'

export const useCardStore = defineStore('cards', () => {
  const cards = shallowRef<KnowledgeCard[]>([])
  const loading = ref(false)
  let loadRequest = 0

  async function load(subjectId?: string): Promise<void> {
    const request = ++loadRequest
    loading.value = true
    try {
      const result = await getCards(subjectId)
      if (request === loadRequest) cards.value = result
    } finally {
      if (request === loadRequest) loading.value = false
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
