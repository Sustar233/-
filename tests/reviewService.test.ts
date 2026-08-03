import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { createReviewState } from '../src/scheduler/fsrs'
import { buildReviewQueue, reviewCard } from '../src/services/reviewService'
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
