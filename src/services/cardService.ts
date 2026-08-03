import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage, setStorage } from '@/storage/storage'
import type { KnowledgeCard, KnowledgeCardInput } from '@/types/card'
import type { ReviewLog, ReviewState } from '@/types/review'
import { generateId } from '@/utils/id'
import { ensurePresetKnowledge } from './presetKnowledgeService'

export async function getCards(subjectId?: string): Promise<KnowledgeCard[]> {
  await ensurePresetKnowledge()
  const cards = (await getStorage<KnowledgeCard[]>(STORAGE_KEYS.cards)) ?? []
  return subjectId ? cards.filter((card) => card.subjectId === subjectId) : cards
}

function normalizeInput(input: KnowledgeCardInput): KnowledgeCardInput {
  const question = input.question.trim()
  const answer = input.answer.trim()
  if (!question || !answer) throw new Error('问题和答案不能为空')
  return {
    ...input,
    question,
    answer,
    tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    note: input.note?.trim() || undefined,
    importance: input.importance ?? 2,
  }
}

export async function createCard(input: KnowledgeCardInput): Promise<KnowledgeCard> {
  const cards = await getCards()
  const normalized = normalizeInput(input)
  const now = Date.now()
  const card: KnowledgeCard = {
    ...normalized,
    id: generateId('card'),
    tags: normalized.tags ?? [],
    importance: normalized.importance ?? 2,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  await setStorage(STORAGE_KEYS.cards, [...cards, card])
  return card
}

export async function updateCard(id: string, input: KnowledgeCardInput): Promise<KnowledgeCard> {
  const cards = await getCards()
  const current = cards.find((card) => card.id === id)
  if (!current) throw new Error('知识卡不存在')
  const normalized = normalizeInput(input)
  const updated: KnowledgeCard = {
    ...current,
    ...normalized,
    tags: normalized.tags ?? [],
    importance: normalized.importance ?? 2,
    updatedAt: Date.now(),
  }
  await setStorage(
    STORAGE_KEYS.cards,
    cards.map((card) => (card.id === id ? updated : card)),
  )
  return updated
}

export async function deleteCard(id: string): Promise<void> {
  const [cards, states, logs] = await Promise.all([
    getCards(),
    getStorage<ReviewState[]>(STORAGE_KEYS.reviewStates).then((value) => value ?? []),
    getStorage<ReviewLog[]>(STORAGE_KEYS.reviewLogs).then((value) => value ?? []),
  ])
  await Promise.all([
    setStorage(STORAGE_KEYS.cards, cards.filter((card) => card.id !== id)),
    setStorage(STORAGE_KEYS.reviewStates, states.filter((state) => state.cardId !== id)),
    setStorage(STORAGE_KEYS.reviewLogs, logs.filter((log) => log.cardId !== id)),
  ])
}

export async function setCardSuspended(id: string, suspended: boolean): Promise<void> {
  const cards = await getCards()
  if (!cards.some((card) => card.id === id)) throw new Error('知识卡不存在')
  await setStorage(
    STORAGE_KEYS.cards,
    cards.map((card) =>
      card.id === id
        ? { ...card, status: suspended ? 'suspended' : 'active', updatedAt: Date.now() }
        : card,
    ),
  )
}

export async function searchCards(query: string): Promise<KnowledgeCard[]> {
  const normalized = query.trim().toLocaleLowerCase()
  const cards = await getCards()
  if (!normalized) return cards
  return cards.filter((card) =>
    [card.question, card.answer, card.note ?? '', ...card.tags]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalized),
  )
}
