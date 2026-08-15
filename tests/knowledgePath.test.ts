import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { getKnowledgeContext, updateCard } from '../src/services/cardService'
import { STORAGE_KEYS } from '../src/storage/keys'
import { setStorage } from '../src/storage/storage'
import type { KnowledgeCard } from '../src/types/card'
import { installStorageMock, resetStorage } from './helpers/storageMock'

installStorageMock()
beforeEach(resetStorage)

function card(id: string, createdAt: number, parentCardId?: string): KnowledgeCard {
  return {
    id,
    subjectId: 'subject_1',
    chapterId: 'chapter_1',
    parentCardId,
    question: `Question ${id}`,
    answer: `Answer ${id}`,
    tags: [],
    importance: 2,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
  }
}

test('knowledge context follows the explicit path from root to direct prerequisite', () => {
  const root = card('root', 1)
  const middle = card('middle', 2, root.id)
  const leaf = card('leaf', 3, middle.id)

  assert.deepEqual(
    getKnowledgeContext(leaf, [leaf, middle, root]).map((item) => item.id),
    ['root', 'middle'],
  )
})

test('legacy cards fall back to nearby earlier cards in the same chapter', () => {
  const cards = [card('one', 1), card('two', 2), card('three', 3), card('four', 4)]
  assert.deepEqual(
    getKnowledgeContext(cards[3], cards, 2).map((item) => item.id),
    ['two', 'three'],
  )
})

test('editing a prerequisite cannot create a circular path', async () => {
  const root = card('root', 1)
  const child = card('child', 2, root.id)
  await setStorage(STORAGE_KEYS.cards, [root, child])

  await assert.rejects(
    () =>
      updateCard(root.id, {
        subjectId: root.subjectId,
        chapterId: root.chapterId,
        parentCardId: child.id,
        question: root.question,
        answer: root.answer,
      }),
    /不能形成循环/,
  )
})
