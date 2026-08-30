import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { createReviewState } from '../src/scheduler/fsrs'
import { getDashboardSnapshot } from '../src/services/dashboardService'
import { STORAGE_KEYS } from '../src/storage/keys'
import { setStorage } from '../src/storage/storage'
import type { KnowledgeCard } from '../src/types/card'
import { installStorageMock, resetStorage } from './helpers/storageMock'

installStorageMock()
beforeEach(resetStorage)

test('dashboard snapshot derives queue, statistics, and wrong-card count from one dataset', async () => {
  const now = new Date(2026, 6, 30, 12).getTime()
  const cards: KnowledgeCard[] = [
    {
      id: 'due-card',
      subjectId: 'subject-1',
      question: 'Due?',
      answer: 'Yes',
      tags: [],
      importance: 2,
      status: 'active',
      createdAt: now - 2,
      updatedAt: now - 2,
    },
    {
      id: 'new-card',
      subjectId: 'subject-1',
      question: 'New?',
      answer: 'Yes',
      tags: [],
      importance: 2,
      status: 'active',
      createdAt: now - 1,
      updatedAt: now - 1,
    },
  ]
  const dueState = createReviewState(cards[0]!.id, now - 60_000)
  dueState.dueAt = now - 1

  await Promise.all([
    setStorage(STORAGE_KEYS.presetKnowledgeDismissed, true),
    setStorage(STORAGE_KEYS.subjects, [
      { id: 'subject-1', name: 'Subject', createdAt: now, updatedAt: now },
    ]),
    setStorage(STORAGE_KEYS.cards, cards),
    setStorage(STORAGE_KEYS.reviewStates, [dueState]),
    setStorage(STORAGE_KEYS.reviewLogs, [
      {
        id: 'wrong-log',
        cardId: cards[0]!.id,
        subjectId: cards[0]!.subjectId,
        rating: 1,
        reviewedAt: now,
        mode: 'scheduled',
      },
    ]),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 20 }),
  ])

  const snapshot = await getDashboardSnapshot(now)

  assert.equal(snapshot.subjects.length, 1)
  assert.equal(snapshot.cards.length, 2)
  assert.equal(snapshot.dueCount, 2)
  assert.equal(snapshot.statistics.todayReviews, 1)
  assert.equal(snapshot.todayWrongCount, 1)
  assert.deepEqual(snapshot.todaySubjectIds, ['subject-1'])
})

test('dashboard totals separate daily queues for different subjects', async () => {
  const now = new Date(2026, 6, 30, 12).getTime()
  const cards: KnowledgeCard[] = [
    {
      id: 'subject-a-card',
      subjectId: 'subject-a',
      question: 'A?',
      answer: 'A',
      tags: [],
      importance: 2,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'subject-b-card',
      subjectId: 'subject-b',
      question: 'B?',
      answer: 'B',
      tags: [],
      importance: 2,
      status: 'active',
      createdAt: now + 1,
      updatedAt: now + 1,
    },
  ]
  await Promise.all([
    setStorage(STORAGE_KEYS.presetKnowledgeDismissed, true),
    setStorage(STORAGE_KEYS.subjects, [
      { id: 'subject-a', name: 'A', createdAt: now, updatedAt: now },
      { id: 'subject-b', name: 'B', createdAt: now, updatedAt: now },
    ]),
    setStorage(STORAGE_KEYS.cards, cards),
    setStorage(STORAGE_KEYS.settings, { dailyNewCards: 1 }),
  ])

  const snapshot = await getDashboardSnapshot(now)
  assert.equal(snapshot.dueCount, 2)
  assert.deepEqual(snapshot.todaySubjectIds, [])
})
