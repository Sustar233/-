import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  buildPresetKnowledgeData,
  PRESET_ID_PREFIX,
  PRESET_KNOWLEDGE_VERSION,
} from '../src/data/presetKnowledge'
import {
  ensurePresetKnowledge,
  restorePresetKnowledge,
} from '../src/services/presetKnowledgeService'
import { STORAGE_KEYS } from '../src/storage/keys'
import { setStorage } from '../src/storage/storage'
import type { KnowledgeCard } from '../src/types/card'
import type { ReviewLog, ReviewState } from '../src/types/review'
import type { Chapter, Subject } from '../src/types/subject'
import { installStorageMock, readStored, resetStorage } from './helpers/storageMock'

installStorageMock()
beforeEach(resetStorage)

test('operating-system preset contains semantic sections with variable card counts', () => {
  const data = buildPresetKnowledgeData()
  const chapterIds = new Set(data.chapters.map((chapter) => chapter.id))

  assert.equal(data.chapters.length, 8)
  assert.equal(data.cards.length, 160)
  assert.equal(new Set(data.cards.map((card) => card.sectionId)).size, 38)
  assert.equal(new Set(data.cards.map((card) => card.id)).size, 160)
  assert.match(data.subject.name, /操作系统/)
  assert.equal(
    data.cards.every(
      (card) =>
        card.question.trim() &&
        card.answer.trim() &&
        card.tags.length > 0 &&
        card.chapterId &&
        card.sectionId &&
        card.sectionTitle &&
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
  const sectionSizes = [...new Set(data.cards.map((card) => card.sectionId))].map(
    (sectionId) => data.cards.filter((card) => card.sectionId === sectionId).length,
  )
  assert.deepEqual([...new Set(sectionSizes)].sort(), [2, 3, 4, 5, 6])
  assert.equal(Math.max(...sectionSizes), 6)
  assert.deepEqual(
    data.cards
      .filter((card) => card.chapterId === data.chapters[0]?.id)
      .reduce<number[]>((sizes, card) => {
        const previousCard = data.cards.find((item) => item.id === card.parentCardId)
        if (!previousCard || previousCard.sectionId !== card.sectionId) sizes.push(1)
        else sizes[sizes.length - 1] = (sizes.at(-1) ?? 0) + 1
        return sizes
      }, []),
    [3, 6, 5, 6],
  )
})

test('empty knowledge storage is seeded and an explicit dismissal is respected', async () => {
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
  await setStorage(STORAGE_KEYS.presetKnowledgeDismissed, true)
  await ensurePresetKnowledge()

  assert.deepEqual(readStored(STORAGE_KEYS.subjects), [])
  assert.deepEqual(readStored(STORAGE_KEYS.chapters), [])
  assert.deepEqual(readStored(STORAGE_KEYS.cards), [])

  await restorePresetKnowledge()
  assert.equal(readStored<Subject[]>(STORAGE_KEYS.subjects)?.length, 1)
  assert.equal(readStored<Chapter[]>(STORAGE_KEYS.chapters)?.length, 8)
  assert.equal(readStored<KnowledgeCard[]>(STORAGE_KEYS.cards)?.length, 160)
  assert.equal(readStored(STORAGE_KEYS.presetKnowledgeDismissed), false)
})

test('current version with missing preset self-heals unless explicitly dismissed', async () => {
  await setStorage(STORAGE_KEYS.presetKnowledgeVersion, PRESET_KNOWLEDGE_VERSION)

  await ensurePresetKnowledge()

  assert.equal(readStored<Subject[]>(STORAGE_KEYS.subjects)?.length, 1)
  assert.equal(readStored<Chapter[]>(STORAGE_KEYS.chapters)?.length, 8)
  assert.equal(readStored<KnowledgeCard[]>(STORAGE_KEYS.cards)?.length, 160)
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

test('version 2 store missing the preset is repaired without losing user data', async () => {
  const userSubject: Subject = {
    id: 'subject_user_existing',
    name: '我的科目',
    createdAt: 1,
    updatedAt: 1,
  }
  const userCard: KnowledgeCard = {
    id: 'card_user_existing',
    subjectId: userSubject.id,
    question: '用户问题',
    answer: '用户答案',
    tags: ['用户'],
    importance: 2,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
  }
  const userState: ReviewState = { cardId: userCard.id, dueAt: 10, fsrsData: {} }
  const userLog: ReviewLog = {
    id: 'review_user_existing',
    cardId: userCard.id,
    subjectId: userSubject.id,
    rating: 3,
    reviewedAt: 10,
  }
  await Promise.all([
    setStorage(STORAGE_KEYS.presetKnowledgeVersion, 2),
    setStorage(STORAGE_KEYS.subjects, [userSubject]),
    setStorage(STORAGE_KEYS.cards, [userCard]),
    setStorage(STORAGE_KEYS.reviewStates, [userState]),
    setStorage(STORAGE_KEYS.reviewLogs, [userLog]),
  ])

  await ensurePresetKnowledge()

  const subjects = readStored<Subject[]>(STORAGE_KEYS.subjects) ?? []
  const cards = readStored<KnowledgeCard[]>(STORAGE_KEYS.cards) ?? []
  assert.equal(subjects.some((subject) => subject.id === userSubject.id), true)
  assert.equal(subjects.some((subject) => subject.id.startsWith(PRESET_ID_PREFIX)), true)
  assert.equal(cards.some((card) => card.id === userCard.id), true)
  assert.equal(cards.filter((card) => card.id.startsWith(PRESET_ID_PREFIX)).length, 160)
  assert.deepEqual(readStored(STORAGE_KEYS.reviewStates), [userState])
  assert.deepEqual(readStored(STORAGE_KEYS.reviewLogs), [userLog])
  assert.equal(
    readStored<number>(STORAGE_KEYS.presetKnowledgeVersion),
    PRESET_KNOWLEDGE_VERSION,
  )
})

test('version marker upgrade preserves progress for an existing complete preset', async () => {
  const preset = buildPresetKnowledgeData()
  const presetCard = preset.cards[0]
  assert.ok(presetCard)
  const cardsWithoutSections = preset.cards.map((card) => {
    const { sectionId: _sectionId, sectionTitle: _sectionTitle, ...legacyCard } = card
    return legacyCard
  })
  const state: ReviewState = { cardId: presetCard.id, dueAt: 20, fsrsData: {} }
  const log: ReviewLog = {
    id: 'review_preset_existing',
    cardId: presetCard.id,
    subjectId: preset.subject.id,
    rating: 3,
    reviewedAt: 20,
  }
  await Promise.all([
    setStorage(STORAGE_KEYS.presetKnowledgeVersion, 4),
    setStorage(STORAGE_KEYS.subjects, [preset.subject]),
    setStorage(STORAGE_KEYS.chapters, preset.chapters),
    setStorage(STORAGE_KEYS.cards, cardsWithoutSections),
    setStorage(STORAGE_KEYS.reviewStates, [state]),
    setStorage(STORAGE_KEYS.reviewLogs, [log]),
  ])

  await ensurePresetKnowledge()

  assert.deepEqual(readStored(STORAGE_KEYS.reviewStates), [state])
  assert.deepEqual(readStored(STORAGE_KEYS.reviewLogs), [log])
  assert.equal(
    readStored<KnowledgeCard[]>(STORAGE_KEYS.cards)?.find((card) => card.id === presetCard.id)
      ?.sectionId,
    presetCard.sectionId,
  )
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
