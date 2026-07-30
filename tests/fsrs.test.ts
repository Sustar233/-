import assert from 'node:assert/strict'
import test from 'node:test'
import { applyReview, createReviewState, previewReview } from '../src/scheduler/fsrs'

test('FSRS adapter previews and applies all four ratings', () => {
  const now = new Date('2026-07-30T08:00:00.000Z').getTime()
  const state = createReviewState('card_1', now)
  const previews = previewReview(state, now)

  assert.deepEqual(
    previews.map((item) => item.rating),
    [1, 2, 3, 4],
  )
  assert.ok(previews.every((item) => item.dueAt > now))
  assert.ok(previews.every((item) => item.intervalLabel.length > 0))

  const reviewed = applyReview(state, 3, now)
  assert.equal(reviewed.cardId, 'card_1')
  assert.equal(reviewed.lastReviewAt, now)
  assert.ok(reviewed.dueAt > now)
})
