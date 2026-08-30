import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useReviewStore } from '../src/stores/review'
import { STORAGE_KEYS } from '../src/storage/keys'
import { setStorage } from '../src/storage/storage'
import type { KnowledgeCard } from '../src/types/card'
import type { ReviewLog, ReviewSession, ReviewState } from '../src/types/review'
import { installStorageMock, readStored, resetStorage } from './helpers/storageMock'

installStorageMock()

beforeEach(() => {
  resetStorage()
  setActivePinia(createPinia())
})

function newCard(id: string, createdAt: number): KnowledgeCard {
  return {
    id,
    subjectId: 'subject_batch',
    chapterId: 'chapter_batch',
    question: `Question ${id}`,
    answer: `Answer ${id}`,
    tags: [],
    importance: 2,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
  }
}

test('a previewed new-card batch enters recall once and resumes without previewing again', async () => {
  const cards = Array.from({ length: 3 }, (_, index) => newCard(`new-${index + 1}`, index + 1))
  await Promise.all([
    setStorage(STORAGE_KEYS.cards, cards),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 20 }),
  ])

  const store = useReviewStore()
  await store.start({ subjectId: 'subject_batch' }, false)

  assert.equal(store.learning, true)
  assert.deepEqual(store.learningBatch.map((card) => card.id), cards.map((card) => card.id))
  assert.deepEqual(readStored(STORAGE_KEYS.reviewStates) ?? [], [])

  await store.beginRecall()

  assert.equal(store.learning, false)
  assert.deepEqual(
    readStored<ReviewSession>(STORAGE_KEYS.reviewSession)?.previewedCardIds,
    cards.map((card) => card.id),
  )
  assert.deepEqual(readStored(STORAGE_KEYS.reviewStates) ?? [], [])

  await store.rate(3)
  assert.equal(store.currentCard?.id, cards[1]?.id)
  assert.equal(store.learning, false)

  setActivePinia(createPinia())
  const resumedStore = useReviewStore()
  await resumedStore.start({ subjectId: 'subject_batch' }, true)
  assert.equal(resumedStore.currentCard?.id, cards[1]?.id)
  assert.equal(resumedStore.learning, false)
})

test('a learning-step rating stays in the session until its real due time', async () => {
  const target = newCard('retry-card', 1)
  await Promise.all([
    setStorage(STORAGE_KEYS.cards, [target]),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 20 }),
  ])

  const store = useReviewStore()
  await store.start({ subjectId: target.subjectId }, false)
  await store.beginRecall()
  await store.reveal()
  await store.rate(1)

  const session = readStored<ReviewSession>(STORAGE_KEYS.reviewSession)
  const retryDueAt = session?.retryDueAtByCardId?.[target.id]
  assert.equal(store.finished, false)
  assert.equal(store.currentCard?.id, target.id)
  assert.ok(retryDueAt)
  assert.ok(retryDueAt - Date.now() > 50_000)
  assert.ok(retryDueAt - Date.now() <= 61_000)
  assert.equal(store.currentRetryDueAt, retryDueAt)

  await store.undoLast()
  assert.equal(store.total, 1)
  assert.equal(store.currentIndex, 0)
  assert.equal(store.currentRetryDueAt, undefined)
})

test('a finished session can load another 20 new cards or review today\'s knowledge', async () => {
  const cards = Array.from({ length: 25 }, (_, index) => newCard(`batch-${index + 1}`, index + 1))
  await Promise.all([
    setStorage(STORAGE_KEYS.cards, cards),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 20 }),
  ])

  const store = useReviewStore()
  await store.start({ subjectId: 'subject_batch' }, false)
  while (!store.finished) {
    if (store.learning) await store.beginRecall()
    await store.reveal()
    await store.rate(4)
  }
  assert.equal(store.sessionCardCount, 20)

  const nextCount = await store.startMoreNewCards(20)
  assert.equal(nextCount, 5)
  assert.equal(store.learningBatch.length, 5)

  await store.beginRecall()
  while (!store.finished) {
    await store.reveal()
    await store.rate(4)
  }
  const scheduledStates = readStored<ReviewState[]>(STORAGE_KEYS.reviewStates)
  assert.equal(await store.startTodayReview(), 25)
  assert.equal(store.total, 25)
  assert.equal(store.currentIndex, 0)
  assert.equal(store.learning, false)
  assert.equal(store.sessionMode, 'practice')

  await store.reveal()
  await store.rate(1)
  assert.deepEqual(readStored<ReviewState[]>(STORAGE_KEYS.reviewStates), scheduledStates)
  assert.equal(
    readStored<ReviewLog[]>(STORAGE_KEYS.reviewLogs)?.at(-1)?.mode,
    'practice',
  )
})

test('continuing with new cards keeps a waiting learning-step card in the session', async () => {
  const cards = Array.from({ length: 3 }, (_, index) => newCard(`continue-${index + 1}`, index + 1))
  await Promise.all([
    setStorage(STORAGE_KEYS.cards, cards),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 1 }),
  ])

  const store = useReviewStore()
  await store.start({ subjectId: 'subject_batch' }, false)
  await store.beginRecall()
  await store.reveal()
  await store.rate(1)

  const retryDueAt = readStored<ReviewSession>(STORAGE_KEYS.reviewSession)
    ?.retryDueAtByCardId?.[cards[0]!.id]
  assert.ok(retryDueAt)
  assert.equal(store.currentCard?.id, cards[0]!.id)

  assert.equal(await store.startMoreNewCards(20), 2)
  assert.equal(store.currentCard?.id, cards[1]!.id)
  assert.deepEqual(
    store.queue.map((card) => card.id),
    [cards[0]!.id, cards[1]!.id, cards[2]!.id, cards[0]!.id],
  )
  assert.equal(
    readStored<ReviewSession>(STORAGE_KEYS.reviewSession)?.retryDueAtByCardId?.[cards[0]!.id],
    retryDueAt,
  )
})
