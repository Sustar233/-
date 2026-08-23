import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewFilterFromQuery, reviewRoute } from '../src/utils/reviewFilter'

test('review routes keep all supported filters in one shared format', () => {
  assert.equal(
    reviewRoute(
      { subjectId: 'subject 1', chapterId: 'chapter/2', tag: '重点 内容' },
      true,
    ),
    '/pages/review/index?fresh=1&subjectId=subject%201&chapterId=chapter%2F2&tag=%E9%87%8D%E7%82%B9%20%E5%86%85%E5%AE%B9',
  )
  assert.equal(reviewRoute({ uncategorizedOnly: true }), '/pages/review/index?uncategorized=1')
})

test('review query parsing normalizes missing and repeated values', () => {
  assert.deepEqual(
    reviewFilterFromQuery({
      subjectId: ['subject-1', 'ignored'],
      chapterId: '',
      uncategorized: '1',
      tag: '重点',
    }),
    {
      subjectId: 'subject-1',
      chapterId: undefined,
      uncategorizedOnly: true,
      tag: '重点',
    },
  )
})
