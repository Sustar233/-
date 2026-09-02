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

  assert.equal(store.sectionPrompt, true)
  assert.equal(store.learning, false)
  assert.deepEqual(store.learningBatch.map((card) => card.id), cards.map((card) => card.id))
  assert.deepEqual(readStored(STORAGE_KEYS.reviewStates) ?? [], [])

  store.previewSection()
  assert.equal(store.sectionPrompt, false)
  assert.equal(store.learning, true)
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

test('forgot moves to the section tail immediately and remains until remembered', async () => {
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

  assert.equal(store.finished, false)
  assert.equal(store.currentCard?.id, target.id)
  assert.equal(store.total, 1)
  assert.equal(store.progressCurrent, 1)
  assert.equal(store.isReinforcement, true)
  assert.equal(store.forgottenCount, 1)
  assert.deepEqual(store.progressWidths, { remembered: '0%', forgotten: '100%' })

  await store.reveal()
  await store.rate(1)
  assert.equal(store.total, 1)
  assert.equal(store.progressCurrent, 1)

  await store.reveal()
  await store.rate(3)
  assert.equal(store.finished, true)
  assert.equal(store.forgottenCount, 0)
  assert.deepEqual(store.progressWidths, { remembered: '100%', forgotten: '0%' })

  await store.undoLast()
  assert.equal(store.total, 1)
  assert.equal(store.currentIndex, 2)
  assert.equal(store.forgottenCount, 1)
  assert.deepEqual(store.progressWidths, { remembered: '0%', forgotten: '100%' })
})

test('forgotten progress survives a session resume and keeps the total card count fixed', async () => {
  const cards = [newCard('forgotten-card', 1), newCard('pending-card', 2)]
  await Promise.all([
    setStorage(STORAGE_KEYS.cards, cards),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 20 }),
  ])

  const store = useReviewStore()
  await store.start({ subjectId: 'subject_batch' }, false)
  await store.beginRecall()
  await store.reveal()
  await store.rate(1)

  assert.equal(store.total, 2)
  assert.deepEqual(store.progressWidths, { remembered: '0%', forgotten: '50%' })

  setActivePinia(createPinia())
  const resumedStore = useReviewStore()
  await resumedStore.start({ subjectId: 'subject_batch' }, true)
  assert.equal(resumedStore.total, 2)
  assert.equal(resumedStore.forgottenCount, 1)
  assert.deepEqual(resumedStore.progressWidths, { remembered: '0%', forgotten: '50%' })
})

test('simple is available only on first sight and undo restores that state', async () => {
  const target = newCard('simple-card', 1)
  await Promise.all([
    setStorage(STORAGE_KEYS.cards, [target]),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 20 }),
  ])

  const store = useReviewStore()
  await store.start({ subjectId: target.subjectId }, false)
  await store.beginRecall()
  assert.equal(store.canMarkCurrentEasy, true)

  await store.reveal()
  await store.rate(4)
  assert.equal(readStored<ReviewState[]>(STORAGE_KEYS.reviewStates)?.[0]?.masteredAt !== undefined, true)
  assert.equal(store.finished, true)

  await store.undoLast()
  assert.equal(store.currentCard?.id, target.id)
  assert.equal(store.canMarkCurrentEasy, true)
  assert.deepEqual(readStored(STORAGE_KEYS.reviewStates), [])
})

test('a finished section can load the next section or review today\'s knowledge', async () => {
  const cards = Array.from({ length: 10 }, (_, index) => ({
    ...newCard(`batch-${index + 1}`, index + 1),
    sectionId: index < 5 ? 'section_1' : 'section_2',
    sectionTitle: index < 5 ? '第一节' : '第二节',
  }))
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
  assert.equal(store.sessionCardCount, 5)
  assert.equal(store.nextStudyLabel, '学习下一小节')

  const nextCount = await store.startNextStudy()
  assert.equal(nextCount, 5)
  assert.equal(store.learningBatch.length, 5)

  await store.beginRecall()
  while (!store.finished) {
    await store.reveal()
    await store.rate(4)
  }
  assert.equal(store.nextStudyLabel, '')
  const scheduledStates = readStored<ReviewState[]>(STORAGE_KEYS.reviewStates)
  assert.equal(await store.startTodayReview(), 10)
  assert.equal(store.total, 10)
  assert.equal(store.currentIndex, 0)
  assert.equal(store.learning, false)
  assert.equal(store.sessionMode, 'practice')

  await store.reveal()
  await store.rate(1)
  assert.equal(store.total, 10)
  assert.deepEqual(readStored<ReviewState[]>(STORAGE_KEYS.reviewStates), scheduledStates)
  assert.equal(
    readStored<ReviewLog[]>(STORAGE_KEYS.reviewLogs)?.at(-1)?.mode,
    'practice',
  )
})

test('a chapter-scoped session continues into the next chapter without an empty action', async () => {
  const first = {
    ...newCard('chapter-one-card', 1),
    chapterId: 'chapter_1',
    sectionId: 'section_1',
    sectionTitle: '第一节',
  }
  const second = {
    ...newCard('chapter-two-card', 2),
    chapterId: 'chapter_2',
    sectionId: 'section_2',
    sectionTitle: '第二节',
  }
  await Promise.all([
    setStorage(STORAGE_KEYS.subjects, [
      { id: first.subjectId, name: '测试知识库', createdAt: 1, updatedAt: 1 },
    ]),
    setStorage(STORAGE_KEYS.chapters, [
      { id: 'chapter_1', subjectId: first.subjectId, name: '第一章', createdAt: 1, updatedAt: 1 },
      { id: 'chapter_2', subjectId: first.subjectId, name: '第二章', createdAt: 2, updatedAt: 2 },
    ]),
    setStorage(STORAGE_KEYS.cards, [first, second]),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 20 }),
    setStorage(STORAGE_KEYS.presetKnowledgeDismissed, true),
  ])

  const store = useReviewStore()
  await store.start({ subjectId: first.subjectId, chapterId: 'chapter_1' }, false)
  await store.beginRecall()
  await store.reveal()
  await store.rate(4)

  assert.equal(store.finished, true)
  assert.equal(store.nextStudyLabel, '学习下一章')
  assert.equal(await store.startNextStudy(), 1)
  assert.equal(store.activeFilter.chapterId, 'chapter_2')
  assert.equal(store.currentCard?.id, second.id)
})

test('the next section stays locked until every forgotten card is remembered', async () => {
  const cards = Array.from({ length: 3 }, (_, index) => ({
    ...newCard(`continue-${index + 1}`, index + 1),
    sectionId: index < 2 ? 'section_1' : 'section_2',
    sectionTitle: index < 2 ? '第一节' : '第二节',
  }))
  await Promise.all([
    setStorage(STORAGE_KEYS.cards, cards),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 20 }),
  ])

  const store = useReviewStore()
  await store.start({ subjectId: 'subject_batch' }, false)
  await store.beginRecall()
  await store.reveal()
  await store.rate(1)

  assert.equal(store.currentCard?.id, cards[1]!.id)
  assert.deepEqual(store.queue.map((card) => card.id), [cards[0]!.id, cards[1]!.id, cards[0]!.id])
  assert.equal(await store.startNextStudy(), 0)

  await store.reveal()
  await store.rate(3)
  await store.reveal()
  await store.rate(3)
  assert.equal(store.finished, true)

  assert.equal(await store.startNextStudy(), 1)
  assert.equal(store.currentCard?.id, cards[2]!.id)
})
