import assert from 'node:assert/strict'
import test from 'node:test'
import { applyReview, createReviewState } from '../src/scheduler/fsrs'
import { normalizeSettings } from '../src/types/settings'

test('FSRS adapter applies a rating', () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const state = createReviewState('card_1', now)
  const reviewed = applyReview(state, 3, now)
  assert.equal(reviewed.cardId, 'card_1')
  assert.equal(reviewed.lastReviewAt, now)
  assert.ok(reviewed.dueAt > now)
})

test('FSRS adapter rejects incomplete persisted state before scheduling', () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const state = createReviewState('card_1', now)
  const fsrsData = { ...(state.fsrsData as Record<string, unknown>) }
  delete fsrsData.stability

  assert.throws(
    () => applyReview({ ...state, fsrsData }, 3, now),
    /复习状态缺少必要字段/,
  )
})

test('scheduler settings normalize legacy and out-of-range values', () => {
  assert.deepEqual(normalizeSettings({ dailyNewCards: 12 }), {
    dailyNewCards: 12,
    desiredRetention: 0.9,
    enableFuzz: true,
  })
  assert.deepEqual(
    normalizeSettings({ dailyNewCards: 999, desiredRetention: 0.5, enableFuzz: false }),
    { dailyNewCards: 200, desiredRetention: 0.75, enableFuzz: false },
  )
})
