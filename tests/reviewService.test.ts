import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { createReviewState } from '../src/scheduler/fsrs'
import {
  applyKnowledgeReview,
  buildLearningPreviewBatch,
  buildReviewQueue,
  buildTodayReviewQueue,
  clearReviewSession,
  commitPracticeReview,
  commitReview,
  FORGOT_RETRY_MS,
  getReviewSession,
  restoreMasteredCard,
  reviewCard,
  saveReviewSession,
  shouldRepeatInCurrentSession,
  undoReview,
} from '../src/services/reviewService'
import { STORAGE_KEYS } from '../src/storage/keys'
import { setStorage } from '../src/storage/storage'
import type { KnowledgeCard } from '../src/types/card'
import type { ReviewState } from '../src/types/review'
import { DEFAULT_SETTINGS } from '../src/types/settings'
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

test('review queue puts due cards before the next complete study section', async () => {
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
    ['due', 'new-old', 'new-recent'],
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

test('learning preview uses explicit sections and falls back to eight-card legacy sections', () => {
  const cards = Array.from({ length: 10 }, (_, index) => ({
    ...card(`chapter-card-${index + 1}`, index),
    chapterId: 'chapter_1',
    sectionId: index < 5 ? 'section_1' : 'section_2',
    sectionTitle: index < 5 ? '第一节' : '第二节',
  }))
  const otherChapter = { ...card('other-chapter', 11), chapterId: 'chapter_2' }
  const queue = [...cards, otherChapter]
  const newCardIds = queue.map((item) => item.id)

  assert.deepEqual(
    buildLearningPreviewBatch(queue, 0, newCardIds, []).map((item) => item.id),
    cards.slice(0, 5).map((item) => item.id),
  )
  assert.deepEqual(
    buildLearningPreviewBatch(queue, 5, newCardIds, cards.slice(0, 5).map((item) => item.id)).map(
      (item) => item.id,
    ),
    cards.slice(5).map((item) => item.id),
  )
  assert.deepEqual(
    buildLearningPreviewBatch(queue, 10, newCardIds, []).map((item) => item.id),
    [otherChapter.id],
  )

  const legacyCards = Array.from({ length: 10 }, (_, index) => ({
    ...card(`legacy-${index + 1}`, index),
    chapterId: 'legacy_chapter',
  }))
  assert.deepEqual(
    buildLearningPreviewBatch(
      legacyCards,
      0,
      legacyCards.map((item) => item.id),
      [],
    ).map((item) => item.id),
    legacyCards.slice(0, 8).map((item) => item.id),
  )
})

test('forgot repeats after ten minutes while remembered and simple leave the session', () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const initial = createReviewState('card_1', now)
  const forgotten = applyKnowledgeReview(initial, 1, now, DEFAULT_SETTINGS)
  const recovered = applyKnowledgeReview(
    forgotten,
    3,
    now + FORGOT_RETRY_MS,
    DEFAULT_SETTINGS,
  )

  assert.equal(forgotten.dueAt, now + FORGOT_RETRY_MS)
  assert.equal(forgotten.rememberedDayStreak, 0)
  assert.equal(shouldRepeatInCurrentSession(forgotten, 1), true)
  assert.equal(recovered.rememberedDayStreak, 0)
  assert.equal(shouldRepeatInCurrentSession(recovered, 3), false)
  assert.equal(shouldRepeatInCurrentSession(applyKnowledgeReview(initial, 4, now, DEFAULT_SETTINGS), 4), false)
})

test('three remembered reviews on different clean days automatically master a card', () => {
  const firstAt = new Date('2026-07-30T08:00:00.000Z').getTime()
  const initial = createReviewState('card_streak', firstAt)
  const first = applyKnowledgeReview(initial, 3, firstAt, DEFAULT_SETTINGS)
  const second = applyKnowledgeReview(first, 3, first.dueAt, DEFAULT_SETTINGS)
  const third = applyKnowledgeReview(second, 3, second.dueAt, DEFAULT_SETTINGS)

  assert.equal(first.rememberedDayStreak, 1)
  assert.equal(first.dueAt, firstAt + 86_400_000)
  assert.equal(second.rememberedDayStreak, 2)
  assert.equal(second.dueAt, first.dueAt + 2 * 86_400_000)
  assert.equal(third.rememberedDayStreak, 3)
  assert.equal(third.masteredAt, second.dueAt)
})

test('a forgotten day resets the streak and later recovery that day does not count', () => {
  const firstAt = new Date('2026-07-30T08:00:00.000Z').getTime()
  const initial = createReviewState('card_reset', firstAt)
  const first = applyKnowledgeReview(initial, 3, firstAt, DEFAULT_SETTINGS)
  const forgotten = applyKnowledgeReview(first, 1, first.dueAt, DEFAULT_SETTINGS)
  const recovered = applyKnowledgeReview(
    forgotten,
    3,
    forgotten.dueAt,
    DEFAULT_SETTINGS,
  )
  const nextDay = applyKnowledgeReview(
    recovered,
    3,
    recovered.dueAt,
    DEFAULT_SETTINGS,
  )

  assert.equal(forgotten.rememberedDayStreak, 0)
  assert.equal(recovered.rememberedDayStreak, 0)
  assert.equal(recovered.masteredAt, undefined)
  assert.equal(nextDay.rememberedDayStreak, 1)
})

test('requesting new knowledge loads one whole section without due cards', async () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const due = card('due', now - 100)
  const dueState = createReviewState(due.id, now - 1000)
  dueState.dueAt = now - 1
  const newCards = Array.from({ length: 10 }, (_, index) => ({
    ...card(`new-${index + 1}`, index),
    sectionId: index < 4 ? 'section_1' : 'section_2',
    sectionTitle: index < 4 ? '第一节' : '第二节',
  }))
  await Promise.all([
    setStorage(STORAGE_KEYS.cards, [due, ...newCards]),
    setStorage(STORAGE_KEYS.reviewStates, [dueState]),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 0 }),
  ])

  const queue = await buildReviewQueue(now, {}, { includeDueCards: false })
  assert.deepEqual(queue.map((item) => item.id), newCards.slice(0, 4).map((item) => item.id))
  assert.equal(queue.some((item) => item.id === due.id), false)
})

test('today review can include all reviewed cards or only cards answered incorrectly', async () => {
  const now = new Date(2026, 6, 30, 12).getTime()
  const correct = card('correct-today', now)
  const wrong = card('wrong-today', now + 1)
  const yesterday = card('reviewed-yesterday', now + 2)
  const difficult = card('difficult-today', now + 3)
  const inactive = { ...card('inactive-today', now + 4), status: 'archived' as const }

  await Promise.all([
    setStorage(STORAGE_KEYS.cards, [correct, wrong, yesterday, difficult, inactive]),
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
        id: 'log-difficult',
        cardId: difficult.id,
        subjectId: difficult.subjectId,
        rating: 2,
        reviewedAt: now + 3,
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
    [wrong.id, correct.id, difficult.id],
  )
  assert.deepEqual(
    (await buildTodayReviewQueue(now, {}, true)).map((item) => item.id),
    [wrong.id],
  )
})

test('rebuilding the queue continues the unfinished section without a daily card limit', async () => {
  const now = new Date(2026, 6, 30, 12).getTime()
  const cards = Array.from({ length: 10 }, (_, index) => card(`new-${index + 1}`, now + index))

  await Promise.all([
    setStorage(STORAGE_KEYS.cards, cards),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 3 }),
  ])

  assert.deepEqual(
    (await buildReviewQueue(now)).map((item) => item.id),
    ['new-1', 'new-2', 'new-3', 'new-4', 'new-5', 'new-6', 'new-7', 'new-8'],
  )

  await reviewCard(cards[0], 4, now)

  assert.deepEqual(
    (await buildReviewQueue(now)).map((item) => item.id),
    ['new-2', 'new-3', 'new-4', 'new-5', 'new-6', 'new-7', 'new-8'],
  )
})

test('next study sections are isolated per subject', async () => {
  const now = new Date(2026, 6, 30, 12).getTime()
  const subjectA = [card('a-1', now), card('a-2', now + 1)]
  const subjectB = [
    { ...card('b-1', now + 2), subjectId: 'subject_2' },
    { ...card('b-2', now + 3), subjectId: 'subject_2' },
  ]
  await Promise.all([
    setStorage(STORAGE_KEYS.cards, [...subjectA, ...subjectB]),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 1 }),
  ])

  await reviewCard(subjectA[0]!, 4, now)

  assert.deepEqual(
    (await buildReviewQueue(now, { subjectId: 'subject_1' })).map((item) => item.id),
    ['a-2'],
  )
  assert.deepEqual(
    (await buildReviewQueue(now, { subjectId: 'subject_2' })).map((item) => item.id),
    ['b-1', 'b-2'],
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

test('simple immediately masters a first-seen card and remains undoable', async () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const target = card('card_easy', now)
  await setStorage(STORAGE_KEYS.cards, [target])

  const commit = await commitReview(target, 4, now)
  assert.equal(commit.nextState.masteredAt, now)
  assert.equal((await buildReviewQueue(now + 1, { subjectId: target.subjectId })).length, 0)

  await undoReview(commit)
  assert.deepEqual(readStored(STORAGE_KEYS.reviewStates), [])
  assert.deepEqual(readStored(STORAGE_KEYS.reviewLogs), [])
})

test('a mastered card can be restored without becoming first-seen again', async () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const restoredAt = now + 86_400_000
  const target = card('card_restore', now)
  await setStorage(STORAGE_KEYS.cards, [target])
  await commitReview(target, 4, now)

  await restoreMasteredCard(target.id, restoredAt)
  const restored = readStored<ReviewState[]>(STORAGE_KEYS.reviewStates)?.[0]
  assert.equal(restored?.masteredAt, undefined)
  assert.equal(restored?.dueAt, restoredAt)
  assert.deepEqual(
    (await buildReviewQueue(restoredAt, { subjectId: target.subjectId })).map((item) => item.id),
    [target.id],
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

test('practice review records an answer without changing the FSRS state', async () => {
  const firstReviewAt = new Date('2026-07-30T08:00:00.000Z').getTime()
  const practiceAt = firstReviewAt + 30 * 60_000
  const target = card('card_practice', firstReviewAt)
  await setStorage(STORAGE_KEYS.cards, [target])
  const scheduledState = await reviewCard(target, 3, firstReviewAt)

  const commit = await commitPracticeReview(target, 1, practiceAt)

  assert.deepEqual(readStored(STORAGE_KEYS.reviewStates), [scheduledState])
  assert.equal(commit.log.mode, 'practice')
  assert.deepEqual(commit.nextState, scheduledState)

  await undoReview(commit)
  assert.deepEqual(readStored(STORAGE_KEYS.reviewStates), [scheduledState])
  assert.equal((readStored<Array<{ mode?: string }>>(STORAGE_KEYS.reviewLogs) ?? []).length, 1)
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
  await saveReviewSession({ ...session, mode: 'practice' })
  assert.equal((await getReviewSession())?.mode, 'practice')
  await clearReviewSession()
  assert.equal(await getReviewSession(), null)
})
