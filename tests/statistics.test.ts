import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateStatistics, calculateStreak, calculateWeakCards } from '../src/services/statisticsService'
import type { KnowledgeCard } from '../src/types/card'
import type { ReviewLog } from '../src/types/review'

const now = new Date(2026, 6, 30, 12).getTime()
const day = 24 * 60 * 60 * 1000
const cards: KnowledgeCard[] = [
  {
    id: 'weak',
    subjectId: 'subject_1',
    question: 'Weak question',
    answer: 'A',
    tags: [],
    importance: 2,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
  },
]
const logs: ReviewLog[] = [
  { id: '1', cardId: 'weak', subjectId: 'subject_1', rating: 1, reviewedAt: now - day * 2 },
  { id: '2', cardId: 'weak', subjectId: 'subject_1', rating: 2, reviewedAt: now - day },
  { id: '3', cardId: 'weak', subjectId: 'subject_1', rating: 1, reviewedAt: now },
]

test('statistics apply streak and weakness rules', () => {
  assert.equal(calculateStreak(logs, now), 3)
  assert.equal(calculateWeakCards(cards, logs)[0].score, 7)

  const summary = calculateStatistics(cards, logs, now)
  assert.equal(summary.todayReviews, 1)
  assert.equal(summary.todayAgain, 1)
  assert.equal(summary.todayNewCards, 0)
  assert.equal(summary.last7Days.length, 7)
})

test('streak starts yesterday when today has no review', () => {
  assert.equal(calculateStreak(logs.slice(0, 2), now), 2)
})

test('statistics remain correct when logs are not chronological', () => {
  const unsortedLogs: ReviewLog[] = [
    { id: 'later', cardId: 'new-card', subjectId: 'subject_1', rating: 3, reviewedAt: now },
    {
      id: 'earlier',
      cardId: 'new-card',
      subjectId: 'subject_1',
      rating: 3,
      reviewedAt: now - day,
    },
  ]

  const summary = calculateStatistics([], unsortedLogs, now)
  assert.equal(summary.todayReviews, 1)
  assert.equal(summary.todayNewCards, 0)
  assert.equal(summary.last7Days.at(-1)?.count, 1)
})
