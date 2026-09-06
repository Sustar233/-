import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { getKnowledgeContext, orderCardsByKnowledgePath, updateCard } from '../src/services/cardService'
import { STORAGE_KEYS } from '../src/storage/keys'
import { setStorage } from '../src/storage/storage'
import type { KnowledgeCard } from '../src/types/card'
import { installStorageMock, readStored, resetStorage } from './helpers/storageMock'

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

test('moving a card to another chapter clears its previous section metadata', async () => {
  const target = {
    ...card('sectioned', 1),
    sectionId: 'section_1',
    sectionTitle: '第一节',
  }
  await setStorage(STORAGE_KEYS.cards, [target])

  const updated = await updateCard(target.id, {
    subjectId: target.subjectId,
    chapterId: 'chapter_2',
    question: target.question,
    answer: target.answer,
  })

  assert.equal(updated.sectionId, undefined)
  assert.equal(updated.sectionTitle, undefined)
})

test('moving a card between subjects repairs logs and dependent knowledge paths', async () => {
  const target = card('moved', 1)
  const dependent = card('dependent', 2, target.id)
  await Promise.all([
    setStorage(STORAGE_KEYS.cards, [target, dependent]),
    setStorage(STORAGE_KEYS.reviewLogs, [
      {
        id: 'log-moved',
        cardId: target.id,
        subjectId: target.subjectId,
        rating: 3,
        reviewedAt: 1,
      },
    ]),
  ])

  await updateCard(target.id, {
    subjectId: 'subject_2',
    chapterId: 'chapter_2',
    question: target.question,
    answer: target.answer,
  })

  const storedCards = readStored<KnowledgeCard[]>(STORAGE_KEYS.cards) ?? []
  assert.equal(storedCards.find((item) => item.id === dependent.id)?.parentCardId, undefined)
  assert.equal(
    readStored<Array<{ subjectId: string }>>(STORAGE_KEYS.reviewLogs)?.[0]?.subjectId,
    'subject_2',
  )
})


test('editing question or answer preserves the existing study section', async () => {
  const target = { ...card('sectioned', 1), sectionId: 'section_1', sectionTitle: '第一节' }
  await setStorage(STORAGE_KEYS.cards, [target])
  const updated = await updateCard(target.id, {
    subjectId: target.subjectId, chapterId: target.chapterId,
    question: '修改后的问题', answer: target.answer,
  })
  assert.equal(updated.sectionId, 'section_1')
  assert.equal(updated.sectionTitle, '第一节')
  assert.equal(readStored<KnowledgeCard[]>(STORAGE_KEYS.cards)?.find((item) => item.id === target.id)?.sectionId, 'section_1')
})

test('section metadata can still be explicitly cleared', async () => {
  const target = { ...card('sectioned', 1), sectionId: 'section_1', sectionTitle: '第一节' }
  await setStorage(STORAGE_KEYS.cards, [target])
  const updated = await updateCard(target.id, {
    subjectId: target.subjectId, chapterId: target.chapterId,
    question: target.question, answer: target.answer, sectionId: '', sectionTitle: '',
  })
  assert.equal(updated.sectionId, undefined)
  assert.equal(updated.sectionTitle, undefined)
})

test('deep knowledge paths sort without overflowing the call stack or mutating input', () => {
  const cards = Array.from({ length: 20000 }, (_, index) => card(String(index), index, index ? String(index - 1) : undefined)).reverse()
  const ordered = orderCardsByKnowledgePath(cards)
  assert.equal(ordered.length, cards.length)
  assert.ok(ordered.every((item, index) => item.id === String(index)))
  assert.equal(cards[0].id, '19999')
})

test('cyclic and missing prerequisites terminate and include every selected card once', () => {
  const cards = [card('a', 1, 'b'), card('b', 2, 'a'), card('c', 3, 'missing')]
  assert.deepEqual(orderCardsByKnowledgePath(cards).map((item) => item.id), ['b', 'a', 'c'])
  assert.deepEqual(orderCardsByKnowledgePath([cards[0]], cards).map((item) => item.id), ['a'])
})

test('zero-depth context does not accidentally return every earlier legacy card', () => {
  const cards = [card('a', 1), card('b', 2)]
  assert.deepEqual(getKnowledgeContext(cards[1], cards, 0), [])
})
