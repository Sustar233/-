import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage, setStorage, setStorageBatch } from '@/storage/storage'
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
    parentCardId: input.parentCardId?.trim() || undefined,
    connection: input.connection?.trim() || undefined,
    importance: input.importance ?? 2,
  }
}

function validateParentCard(
  cards: KnowledgeCard[],
  input: KnowledgeCardInput,
  currentCardId?: string,
): void {
  if (!input.parentCardId) return
  if (input.parentCardId === currentCardId) throw new Error('知识卡不能关联自身')
  const parent = cards.find((card) => card.id === input.parentCardId)
  if (!parent) throw new Error('选择的前置知识不存在')
  if (parent.subjectId !== input.subjectId) throw new Error('前置知识必须属于同一科目')

  const cardById = new Map(cards.map((card) => [card.id, card]))
  const visited = new Set<string>()
  let cursor: KnowledgeCard | undefined = parent
  while (cursor) {
    if (cursor.id === currentCardId) throw new Error('前置关系不能形成循环')
    if (visited.has(cursor.id)) throw new Error('现有知识路径中存在循环，请先修正')
    visited.add(cursor.id)
    cursor = cursor.parentCardId ? cardById.get(cursor.parentCardId) : undefined
  }
}

export async function createCard(input: KnowledgeCardInput): Promise<KnowledgeCard> {
  const cards = await getCards()
  const normalized = normalizeInput(input)
  validateParentCard(cards, normalized)
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
  validateParentCard(cards, normalized, id)
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
  await setStorageBatch([
    {
      type: 'set',
      key: STORAGE_KEYS.cards,
      value: cards
        .filter((card) => card.id !== id)
        .map((card) =>
          card.parentCardId === id
            ? { ...card, parentCardId: undefined, updatedAt: Date.now() }
            : card,
        ),
    },
    {
      type: 'set',
      key: STORAGE_KEYS.reviewStates,
      value: states.filter((state) => state.cardId !== id),
    },
    {
      type: 'set',
      key: STORAGE_KEYS.reviewLogs,
      value: logs.filter((log) => log.cardId !== id),
    },
    { type: 'remove', key: STORAGE_KEYS.reviewSession },
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
    [card.question, card.answer, card.connection ?? '', card.note ?? '', ...card.tags]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalized),
  )
}

export function getKnowledgeContext(
  card: KnowledgeCard,
  cards: KnowledgeCard[],
  maxDepth = 3,
): KnowledgeCard[] {
  const cardById = new Map(cards.map((item) => [item.id, item]))
  const path: KnowledgeCard[] = []
  const visited = new Set([card.id])
  let parentId = card.parentCardId

  // Older data has no explicit links. Nearby earlier cards in the same chapter are
  // a useful, conservative fallback until the user builds a custom path.
  if (!parentId && card.chapterId) {
    return cards
      .filter(
        (item) =>
          item.id !== card.id &&
          item.subjectId === card.subjectId &&
          item.chapterId === card.chapterId &&
          item.createdAt < card.createdAt,
      )
      .sort((first, second) => first.createdAt - second.createdAt)
      .slice(-maxDepth)
  }

  while (parentId && path.length < maxDepth && !visited.has(parentId)) {
    const parent = cardById.get(parentId)
    if (!parent || parent.subjectId !== card.subjectId) break
    visited.add(parent.id)
    path.unshift(parent)
    parentId = parent.parentCardId
  }
  return path
}

export function orderCardsByKnowledgePath(
  cards: KnowledgeCard[],
  allCards: KnowledgeCard[] = cards,
): KnowledgeCard[] {
  const included = new Map(cards.map((card) => [card.id, card]))
  const allById = new Map(allCards.map((card) => [card.id, card]))
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const ordered: KnowledgeCard[] = []

  function visit(card: KnowledgeCard): void {
    if (visited.has(card.id)) return
    if (visiting.has(card.id)) return
    visiting.add(card.id)
    if (card.parentCardId) {
      const parent = allById.get(card.parentCardId)
      const includedParent = parent ? included.get(parent.id) : undefined
      if (includedParent) visit(includedParent)
    }
    visiting.delete(card.id)
    visited.add(card.id)
    ordered.push(card)
  }

  cards.forEach(visit)
  return ordered
}
