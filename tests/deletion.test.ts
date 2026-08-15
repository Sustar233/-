import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { deleteCard } from '../src/services/cardService'
import { deleteSubject } from '../src/services/subjectService'
import { STORAGE_KEYS } from '../src/storage/keys'
import { setStorage } from '../src/storage/storage'
import type { KnowledgeCard } from '../src/types/card'
import { installStorageMock, readStored, resetStorage } from './helpers/storageMock'

installStorageMock()
beforeEach(resetStorage)

const baseCard: KnowledgeCard = {
  id: 'card_1',
  subjectId: 'subject_1',
  chapterId: 'chapter_1',
  question: 'Q',
  answer: 'A',
  tags: [],
  importance: 2,
  status: 'active',
  createdAt: 1,
  updatedAt: 1,
}

async function seed(): Promise<void> {
  await Promise.all([
    setStorage(STORAGE_KEYS.subjects, [
      { id: 'subject_1', name: 'S1', createdAt: 1, updatedAt: 1 },
      { id: 'subject_2', name: 'S2', createdAt: 1, updatedAt: 1 },
    ]),
    setStorage(STORAGE_KEYS.chapters, [
      { id: 'chapter_1', subjectId: 'subject_1', name: 'C1', createdAt: 1, updatedAt: 1 },
    ]),
    setStorage(STORAGE_KEYS.cards, [
      baseCard,
      { ...baseCard, id: 'card_2', subjectId: 'subject_2', chapterId: undefined },
    ]),
    setStorage(STORAGE_KEYS.reviewStates, [
      { cardId: 'card_1', dueAt: 1, fsrsData: {} },
      { cardId: 'card_2', dueAt: 1, fsrsData: {} },
    ]),
    setStorage(STORAGE_KEYS.reviewLogs, [
      { id: 'log_1', cardId: 'card_1', subjectId: 'subject_1', rating: 1, reviewedAt: 1 },
      { id: 'log_2', cardId: 'card_2', subjectId: 'subject_2', rating: 3, reviewedAt: 1 },
    ]),
  ])
}

test('deleting a card removes its state and logs only', async () => {
  await seed()
  await deleteCard('card_1')

  assert.deepEqual(readStored<KnowledgeCard[]>(STORAGE_KEYS.cards)?.map((card) => card.id), ['card_2'])
  assert.deepEqual(
    readStored<Array<{ cardId: string }>>(STORAGE_KEYS.reviewStates)?.map((state) => state.cardId),
    ['card_2'],
  )
  assert.deepEqual(
    readStored<Array<{ cardId: string }>>(STORAGE_KEYS.reviewLogs)?.map((log) => log.cardId),
    ['card_2'],
  )
})

test('deleting a prerequisite keeps dependent cards and clears their broken link', async () => {
  await seed()
  const cards = readStored<KnowledgeCard[]>(STORAGE_KEYS.cards) ?? []
  await setStorage(STORAGE_KEYS.cards, [
    ...cards,
    { ...baseCard, id: 'card_child', parentCardId: 'card_1' },
  ])

  await deleteCard('card_1')

  const child = readStored<KnowledgeCard[]>(STORAGE_KEYS.cards)?.find(
    (card) => card.id === 'card_child',
  )
  assert.ok(child)
  assert.equal(child.parentCardId, undefined)
})

test('deleting a subject cascades chapters, cards, states and logs', async () => {
  await seed()
  await deleteSubject('subject_1')

  assert.deepEqual(readStored<Array<{ id: string }>>(STORAGE_KEYS.subjects)?.map((item) => item.id), [
    'subject_2',
  ])
  assert.deepEqual(readStored<unknown[]>(STORAGE_KEYS.chapters), [])
  assert.deepEqual(readStored<KnowledgeCard[]>(STORAGE_KEYS.cards)?.map((item) => item.id), ['card_2'])
  assert.deepEqual(
    readStored<Array<{ cardId: string }>>(STORAGE_KEYS.reviewStates)?.map((item) => item.cardId),
    ['card_2'],
  )
  assert.deepEqual(
    readStored<Array<{ cardId: string }>>(STORAGE_KEYS.reviewLogs)?.map((item) => item.cardId),
    ['card_2'],
  )
})
