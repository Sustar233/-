import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  buildPresetKnowledgeData,
  PRESET_ID_PREFIX,
  PRESET_KNOWLEDGE_VERSION,
} from '../src/data/presetKnowledge'
import { ensurePresetKnowledge } from '../src/services/presetKnowledgeService'
import { STORAGE_KEYS } from '../src/storage/keys'
import { setStorage } from '../src/storage/storage'
import type { KnowledgeCard } from '../src/types/card'
import type { Chapter, Subject } from '../src/types/subject'
import { installStorageMock, readStored, resetStorage } from './helpers/storageMock'

installStorageMock()
beforeEach(resetStorage)

test('operating-system preset contains 8 chapters and 160 linked cards', () => {
  const data = buildPresetKnowledgeData()
  const chapterIds = new Set(data.chapters.map((chapter) => chapter.id))

  assert.equal(data.chapters.length, 8)
  assert.equal(data.cards.length, 160)
  assert.equal(new Set(data.cards.map((card) => card.id)).size, 160)
  assert.match(data.subject.name, /操作系统/)
  assert.equal(
    data.cards.every(
      (card) =>
        card.question.trim() &&
        card.answer.trim() &&
        card.tags.length > 0 &&
        card.chapterId &&
        chapterIds.has(card.chapterId),
    ),
    true,
  )
  for (const chapter of data.chapters) {
    const chapterCards = data.cards.filter((card) => card.chapterId === chapter.id)
    assert.equal(chapterCards[0]?.parentCardId, undefined)
    chapterCards.slice(1).forEach((card, index) => {
      assert.equal(card.parentCardId, chapterCards[index]?.id)
    })
  }
})

test('empty knowledge storage is seeded once', async () => {
  await ensurePresetKnowledge()

  assert.equal(readStored<Subject[]>(STORAGE_KEYS.subjects)?.length, 1)
  assert.equal(readStored<Chapter[]>(STORAGE_KEYS.chapters)?.length, 8)
  assert.equal(readStored<KnowledgeCard[]>(STORAGE_KEYS.cards)?.length, 160)
  assert.equal(
    readStored<number>(STORAGE_KEYS.presetKnowledgeVersion),
    PRESET_KNOWLEDGE_VERSION,
  )

  await setStorage(STORAGE_KEYS.subjects, [])
  await setStorage(STORAGE_KEYS.chapters, [])
  await setStorage(STORAGE_KEYS.cards, [])
  await ensurePresetKnowledge()

  assert.deepEqual(readStored(STORAGE_KEYS.subjects), [])
  assert.deepEqual(readStored(STORAGE_KEYS.chapters), [])
  assert.deepEqual(readStored(STORAGE_KEYS.cards), [])
})

test('existing user knowledge is preserved alongside the default preset', async () => {
  const existingSubject: Subject = {
    id: 'subject_user',
    name: '用户科目',
    createdAt: 1,
    updatedAt: 1,
  }
  await Promise.all([
    setStorage(STORAGE_KEYS.presetKnowledgeVersion, 1),
    setStorage(STORAGE_KEYS.subjects, [existingSubject]),
  ])

  await ensurePresetKnowledge()

  const subjects = readStored<Subject[]>(STORAGE_KEYS.subjects) ?? []
  assert.equal(subjects.some((subject) => subject.id === existingSubject.id), true)
  assert.equal(subjects.some((subject) => subject.id.startsWith(PRESET_ID_PREFIX)), true)
  assert.equal(readStored<Chapter[]>(STORAGE_KEYS.chapters)?.length, 8)
  assert.equal(readStored<KnowledgeCard[]>(STORAGE_KEYS.cards)?.length, 160)
  assert.equal(
    readStored<number>(STORAGE_KEYS.presetKnowledgeVersion),
    PRESET_KNOWLEDGE_VERSION,
  )
})

test('an interrupted preset write is repaired before marking completion', async () => {
  const preset = buildPresetKnowledgeData()
  await setStorage(STORAGE_KEYS.subjects, [preset.subject])

  await ensurePresetKnowledge()

  assert.equal(readStored<Subject[]>(STORAGE_KEYS.subjects)?.length, 1)
  assert.equal(readStored<Chapter[]>(STORAGE_KEYS.chapters)?.length, 8)
  assert.equal(readStored<KnowledgeCard[]>(STORAGE_KEYS.cards)?.length, 160)
})

test('version upgrade removes the previous food preset and its review data', async () => {
  const legacyPrefix = 'preset_food_health_'
  const legacySubject: Subject = {
    id: `${legacyPrefix}subject_v1`,
    name: '旧默认库',
    createdAt: 1,
    updatedAt: 1,
  }
  const legacyCard: KnowledgeCard = {
    id: `${legacyPrefix}card_001`,
    subjectId: legacySubject.id,
    question: '旧问题',
    answer: '旧答案',
    tags: ['旧默认'],
    importance: 2,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
  }
  const userSubject: Subject = {
    id: 'subject_user',
    name: '用户知识',
    createdAt: 2,
    updatedAt: 2,
  }
  const userCard: KnowledgeCard = {
    ...legacyCard,
    id: 'card_user',
    subjectId: userSubject.id,
    question: '保留我',
  }

  await Promise.all([
    setStorage(STORAGE_KEYS.presetKnowledgeVersion, 1),
    setStorage(STORAGE_KEYS.subjects, [legacySubject, userSubject]),
    setStorage(STORAGE_KEYS.cards, [legacyCard, userCard]),
    setStorage(STORAGE_KEYS.reviewStates, [
      { cardId: legacyCard.id, dueAt: 1, fsrsData: {} },
      { cardId: userCard.id, dueAt: 2, fsrsData: {} },
    ]),
    setStorage(STORAGE_KEYS.reviewLogs, [
      { id: 'legacy_log', cardId: legacyCard.id, subjectId: legacySubject.id, rating: 3, reviewedAt: 1 },
      { id: 'user_log', cardId: userCard.id, subjectId: userSubject.id, rating: 3, reviewedAt: 2 },
    ]),
  ])

  await ensurePresetKnowledge()

  const subjects = readStored<Subject[]>(STORAGE_KEYS.subjects) ?? []
  const cards = readStored<KnowledgeCard[]>(STORAGE_KEYS.cards) ?? []
  assert.equal(subjects.some((subject) => subject.id.startsWith(legacyPrefix)), false)
  assert.equal(cards.some((card) => card.id.startsWith(legacyPrefix)), false)
  assert.equal(subjects.some((subject) => subject.id === userSubject.id), true)
  assert.equal(cards.some((card) => card.id === userCard.id), true)
  assert.equal(cards.filter((card) => card.id.startsWith(PRESET_ID_PREFIX)).length, 160)
  assert.deepEqual(
    readStored<Array<{ cardId: string }>>(STORAGE_KEYS.reviewStates)?.map((item) => item.cardId),
    [userCard.id],
  )
  assert.deepEqual(
    readStored<Array<{ id: string }>>(STORAGE_KEYS.reviewLogs)?.map((item) => item.id),
    ['user_log'],
  )
})
