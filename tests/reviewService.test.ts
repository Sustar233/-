import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { applyReview, createReviewState } from '../src/scheduler/fsrs'
import {
  buildLearningPreviewBatch,
  buildReviewQueue,
  buildTodayReviewQueue,
  clearReviewSession,
  commitReview,
  getReviewSession,
  reviewCard,
  saveReviewSession,
  shouldRepeatInCurrentSession,
  undoReview,
} from '../src/services/reviewService'
import { STORAGE_KEYS } from '../src/storage/keys'
import { setStorage } from '../src/storage/storage'
import type { KnowledgeCard } from '../src/types/card'
import { installStorageMock, readStored, resetStorage } from './helpers/storageMock'

installStorageMock()
beforeEach(resetStorage)

function card(id: string, createdAt: number): KnowledgeCard {
  return {
    id,
    subjectId: 'subject_1',
    question: `Question ${id}`,
    answer: `Answer ${id}`,
    tags: [],
    importance: 2,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
  }
}

test('review queue puts due cards before old-to-new limited new cards', async () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const due = card('due', now - 30_000)
  const newOld = card('new-old', now - 20_000)
  const newRecent = card('new-recent', now - 10_000)
  const dueState = createReviewState(due.id, now - 60_000)
  dueState.dueAt = now - 1

  await Promise.all([
    setStorage(STORAGE_KEYS.cards, [newRecent, due, newOld]),
    setStorage(STORAGE_KEYS.reviewStates, [dueState]),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 1 }),
  ])

  const queue = await buildReviewQueue(now)
  assert.deepEqual(
    queue.map((item) => item.id),
    ['due', 'new-old'],
  )
})

test('review queue places a prerequisite before its dependent card', async () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const prerequisite = card('prerequisite', now + 2)
  const dependent = {
    ...card('dependent', now + 1),
    parentCardId: prerequisite.id,
  }

  await Promise.all([
    setStorage(STORAGE_KEYS.cards, [dependent, prerequisite]),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 20 }),
  ])

  assert.deepEqual(
    (await buildReviewQueue(now, { subjectId: 'subject_1' })).map((item) => item.id),
    ['prerequisite', 'dependent'],
  )
})

test('learning preview batches consecutive new cards from one chapter', () => {
  const cards = Array.from({ length: 10 }, (_, index) => ({
    ...card(`chapter-card-${index + 1}`, index),
    chapterId: 'chapter_1',
  }))
  const otherChapter = { ...card('other-chapter', 11), chapterId: 'chapter_2' }
  const queue = [...cards, otherChapter]
  const newCardIds = queue.map((item) => item.id)

  assert.deepEqual(
    buildLearningPreviewBatch(queue, 0, newCardIds, []).map((item) => item.id),
    cards.slice(0, 8).map((item) => item.id),
  )
  assert.deepEqual(
    buildLearningPreviewBatch(queue, 8, newCardIds, cards.slice(0, 8).map((item) => item.id)).map(
      (item) => item.id,
    ),
    cards.slice(8).map((item) => item.id),
  )
  assert.deepEqual(
    buildLearningPreviewBatch(queue, 10, newCardIds, []).map((item) => item.id),
    [otherChapter.id],
  )
})

test('FSRS learning steps repeat in the current session, including across midnight', () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const initial = createReviewState('card_1', now)

  assert.equal(shouldRepeatInCurrentSession(applyReview(initial, 1, now), now), true)
  assert.equal(shouldRepeatInCurrentSession(applyReview(initial, 2, now), now), true)
  assert.equal(shouldRepeatInCurrentSession(applyReview(initial, 3, now), now), true)
  assert.equal(shouldRepeatInCurrentSession(applyReview(initial, 4, now), now), false)

  const nearMidnight = new Date(2026, 6, 30, 23, 59, 30).getTime()
  const midnightInitial = createReviewState('midnight-card', nearMidnight)
  assert.equal(
    shouldRepeatInCurrentSession(applyReview(midnightInitial, 1, nearMidnight), nearMidnight),
    true,
  )
})

test('explicit new-card limit loads another batch without due cards', async () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const due = card('due', now - 100)
  const dueState = createReviewState(due.id, now - 1000)
  dueState.dueAt = now - 1
  const newCards = Array.from({ length: 25 }, (_, index) => card(`new-${index + 1}`, index))
  await Promise.all([
    setStorage(STORAGE_KEYS.cards, [due, ...newCards]),
    setStorage(STORAGE_KEYS.reviewStates, [dueState]),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 0 }),
  ])

  const queue = await buildReviewQueue(now, {}, { includeDueCards: false, newCardLimit: 20 })
  assert.equal(queue.length, 20)
  assert.equal(queue.some((item) => item.id === due.id), false)
})

test('today review can include all reviewed cards or only cards answered incorrectly', async () => {
  const now = new Date(2026, 6, 30, 12).getTime()
  const correct = card('correct-today', now)
  const wrong = card('wrong-today', now + 1)
  const yesterday = card('reviewed-yesterday', now + 2)
  const inactive = { ...card('inactive-today', now + 3), status: 'archived' as const }

  await Promise.all([
    setStorage(STORAGE_KEYS.cards, [correct, wrong, yesterday, inactive]),
    setStorage(STORAGE_KEYS.reviewLogs, [
      {
        id: 'log-correct',
        cardId: correct.id,
        subjectId: correct.subjectId,
        rating: 3,
        reviewedAt: now,
      },
      {
        id: 'log-wrong',
        cardId: wrong.id,
        subjectId: wrong.subjectId,
        rating: 1,
        reviewedAt: now + 1,
      },
      {
        id: 'log-recovered',
        cardId: wrong.id,
        subjectId: wrong.subjectId,
        rating: 3,
        reviewedAt: now + 2,
      },
      {
        id: 'log-yesterday',
        cardId: yesterday.id,
        subjectId: yesterday.subjectId,
        rating: 1,
        reviewedAt: now - 86_400_000,
      },
      {
        id: 'log-inactive',
        cardId: inactive.id,
        subjectId: inactive.subjectId,
        rating: 1,
        reviewedAt: now,
      },
    ]),
  ])

  assert.deepEqual(
    (await buildTodayReviewQueue(now)).map((item) => item.id),
    [wrong.id, correct.id],
  )
  assert.deepEqual(
    (await buildTodayReviewQueue(now, {}, true)).map((item) => item.id),
    [wrong.id],
  )
})

test('rebuilding the queue does not refill new cards already studied today', async () => {
  const now = new Date(2026, 6, 30, 12).getTime()
  const cards = Array.from({ length: 5 }, (_, index) => card(`new-${index + 1}`, now + index))

  await Promise.all([
    setStorage(STORAGE_KEYS.cards, cards),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 3 }),
  ])

  assert.deepEqual(
    (await buildReviewQueue(now)).map((item) => item.id),
    ['new-1', 'new-2', 'new-3'],
  )

  await reviewCard(cards[0], 4, now)

  assert.deepEqual(
    (await buildReviewQueue(now)).map((item) => item.id),
    ['new-2', 'new-3'],
  )
})

test('reviewing a card saves its FSRS state and a compact log', async () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const target = card('card_1', now)
  await setStorage(STORAGE_KEYS.cards, [target])

  const state = await reviewCard(target, 3, now)
  const logs = readStored<Array<{ cardId: string; subjectId: string; rating: number }>>(
    STORAGE_KEYS.reviewLogs,
  )

  assert.equal(state.lastReviewAt, now)
  assert.ok(state.dueAt > now)
  assert.equal(logs?.length, 1)
  assert.deepEqual(
    { cardId: logs?.[0].cardId, subjectId: logs?.[0].subjectId, rating: logs?.[0].rating },
    { cardId: 'card_1', subjectId: 'subject_1', rating: 3 },
  )
})

test('reviewing a card commits its state, log, and session together', async () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const target = card('card_session', now)
  await setStorage(STORAGE_KEYS.cards, [target])
  const session = {
    version: 1 as const,
    cardIds: [target.id],
    currentIndex: 1,
    startedAt: now,
    filter: {},
  }

  const commit = await commitReview(target, 3, now, session)
  const storedSession = await getReviewSession()

  assert.equal(storedSession?.currentIndex, 1)
  assert.equal(storedSession?.lastCommit?.log.id, commit.log.id)
  assert.equal(storedSession?.lastCommit?.nextState.cardId, target.id)
})

test('review queue can be narrowed by subject, chapter, uncategorized cards, and tag', async () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const chapterCard = { ...card('chapter', now), chapterId: 'chapter_1', tags: ['重点'] }
  const uncategorizedCard = { ...card('uncategorized', now + 1), tags: ['重点'] }
  const otherSubjectCard = {
    ...card('other', now + 2),
    subjectId: 'subject_2',
    chapterId: 'chapter_2',
    tags: ['重点'],
  }
  await Promise.all([
    setStorage(STORAGE_KEYS.cards, [chapterCard, uncategorizedCard, otherSubjectCard]),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 20 }),
  ])

  assert.deepEqual(
    (await buildReviewQueue(now, { subjectId: 'subject_1', chapterId: 'chapter_1' })).map(
      (item) => item.id,
    ),
    ['chapter'],
  )
  assert.deepEqual(
    (
      await buildReviewQueue(now, {
        subjectId: 'subject_1',
        uncategorizedOnly: true,
        tag: '重点',
      })
    ).map((item) => item.id),
    ['uncategorized'],
  )
})

test('undo removes the exact log and restores the previous review state', async () => {
  const firstReviewAt = new Date('2026-07-30T08:00:00.000Z').getTime()
  const secondReviewAt = firstReviewAt + 86_400_000
  const target = card('card_undo', firstReviewAt)
  await setStorage(STORAGE_KEYS.cards, [target])
  const originalState = await reviewCard(target, 3, firstReviewAt)

  const commit = await commitReview(target, 1, secondReviewAt)
  await undoReview(commit)

  assert.deepEqual(readStored(STORAGE_KEYS.reviewStates), [originalState])
  const logs = readStored<Array<{ id: string }>>(STORAGE_KEYS.reviewLogs) ?? []
  assert.equal(logs.length, 1)
  assert.equal(logs.some((log) => log.id === commit.log.id), false)
})

test('review session can be persisted and cleared', async () => {
  const session = {
    version: 1 as const,
    cardIds: ['card_1', 'card_2'],
    currentIndex: 1,
    startedAt: Date.now(),
    filter: { subjectId: 'subject_1' },
    previewedCardIds: ['card_1'],
    retryDueAtByCardId: { card_2: Date.now() + 60_000 },
  }

  await saveReviewSession(session)
  assert.deepEqual(await getReviewSession(), session)
  await clearReviewSession()
  assert.equal(await getReviewSession(), null)
})
