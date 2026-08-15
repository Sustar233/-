import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  buildPresetKnowledgeData,
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

test('preset knowledge contains exactly 200 valid, uniquely identified cards', () => {
  const data = buildPresetKnowledgeData()
  const chapterIds = new Set(data.chapters.map((chapter) => chapter.id))

  assert.equal(data.chapters.length, 7)
  assert.equal(data.cards.length, 200)
  assert.equal(new Set(data.cards.map((card) => card.id)).size, 200)
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
  assert.equal(readStored<Chapter[]>(STORAGE_KEYS.chapters)?.length, 7)
  assert.equal(readStored<KnowledgeCard[]>(STORAGE_KEYS.cards)?.length, 200)
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

test('existing user knowledge is never replaced by presets', async () => {
  const existingSubject: Subject = {
    id: 'subject_user',
    name: '用户科目',
    createdAt: 1,
    updatedAt: 1,
  }
  await setStorage(STORAGE_KEYS.subjects, [existingSubject])

  await ensurePresetKnowledge()

  assert.deepEqual(readStored(STORAGE_KEYS.subjects), [existingSubject])
  assert.equal(readStored(STORAGE_KEYS.chapters), undefined)
  assert.equal(readStored(STORAGE_KEYS.cards), undefined)
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
  assert.equal(readStored<Chapter[]>(STORAGE_KEYS.chapters)?.length, 7)
  assert.equal(readStored<KnowledgeCard[]>(STORAGE_KEYS.cards)?.length, 200)
})
