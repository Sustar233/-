import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  importAiKnowledgePackage,
  parseAiKnowledgePackage,
} from '../src/services/knowledgePackageService'
import { STORAGE_KEYS } from '../src/storage/keys'
import { setStorage } from '../src/storage/storage'
import type { KnowledgeCard } from '../src/types/card'
import type { Chapter, Subject } from '../src/types/subject'
import { installStorageMock, readStored, resetStorage } from './helpers/storageMock'

installStorageMock()
beforeEach(resetStorage)

function packageText(): string {
  return JSON.stringify({
    format: 'recalllab-ai-knowledge',
    version: 1,
    subject: { name: '计算机网络', description: '从分层到传输' },
    chapters: [
      {
        name: '网络基础',
        sections: [
          {
            title: '分层模型',
            cards: [
              {
                question: '为什么网络需要分层？',
                answer: '分层可以隔离变化、降低复杂度，并通过接口协作。',
                tags: ['基础', '基础'],
                importance: 3,
              },
              {
                question: '协议是什么？',
                answer: '协议是通信双方共同遵守的规则集合。',
              },
            ],
          },
          {
            title: '封装',
            cards: [
              {
                question: '什么是封装？',
                answer: '数据逐层向下传递时添加本层控制信息的过程。',
              },
            ],
          },
        ],
      },
      {
        name: '传输层',
        sections: [
          {
            title: '可靠传输',
            cards: [
              {
                question: '可靠传输解决什么问题？',
                answer: '解决丢失、重复、乱序和差错等问题。',
                note: '讲义第 18 页',
              },
            ],
          },
        ],
      },
    ],
  })
}

test('AI knowledge packages are appended with generated chapter, section, and path ids', async () => {
  const existingSubject: Subject = {
    id: 'existing-subject',
    name: '已有知识库',
    createdAt: 1,
    updatedAt: 1,
  }
  const existingChapter: Chapter = {
    id: 'existing-chapter',
    subjectId: existingSubject.id,
    name: '已有章节',
    createdAt: 1,
    updatedAt: 1,
  }
  const existingCard: KnowledgeCard = {
    id: 'existing-card',
    subjectId: existingSubject.id,
    chapterId: existingChapter.id,
    question: '已有问题',
    answer: '已有答案',
    tags: [],
    importance: 2,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
  }
  await Promise.all([
    setStorage(STORAGE_KEYS.presetKnowledgeDismissed, true),
    setStorage(STORAGE_KEYS.subjects, [existingSubject]),
    setStorage(STORAGE_KEYS.chapters, [existingChapter]),
    setStorage(STORAGE_KEYS.cards, [existingCard]),
  ])

  const result = await importAiKnowledgePackage(packageText())
  const subjects = readStored<Subject[]>(STORAGE_KEYS.subjects) ?? []
  const chapters = readStored<Chapter[]>(STORAGE_KEYS.chapters) ?? []
  const cards = readStored<KnowledgeCard[]>(STORAGE_KEYS.cards) ?? []
  const importedCards = cards.filter((card) => card.subjectId === result.subjectId)

  assert.deepEqual(
    { chapters: result.chapterCount, sections: result.sectionCount, cards: result.cardCount },
    { chapters: 2, sections: 3, cards: 4 },
  )
  assert.equal(subjects[0]?.id, existingSubject.id)
  assert.equal(chapters[0]?.id, existingChapter.id)
  assert.equal(cards[0]?.id, existingCard.id)
  assert.equal(new Set(importedCards.map((card) => card.sectionId)).size, 3)
  assert.equal(importedCards[0]?.parentCardId, undefined)
  assert.equal(importedCards[1]?.parentCardId, importedCards[0]?.id)
  assert.equal(importedCards[2]?.parentCardId, importedCards[1]?.id)
  assert.equal(importedCards[3]?.parentCardId, undefined)
  assert.equal(importedCards[0]?.connection, undefined)
  assert.equal(importedCards[1]?.connection, '网络基础')
  assert.equal(importedCards[2]?.connection, '网络基础')
  assert.equal(importedCards[3]?.connection, undefined)
  assert.deepEqual(importedCards[0]?.tags, ['基础'])
})

test('AI knowledge package validation rejects malformed JSON and oversized sections', () => {
  assert.throws(() => parseAiKnowledgePackage('```json\n{}\n```'), /不是合法 JSON/)
  const oversized = JSON.parse(packageText())
  oversized.chapters[0].sections[0].cards = Array.from({ length: 11 }, (_, index) => ({
    question: `问题 ${index}`,
    answer: `答案 ${index}`,
  }))
  assert.throws(
    () => parseAiKnowledgePackage(JSON.stringify(oversized)),
    /超过 10 张/,
  )
})

test('reimporting a package with the same subject name is blocked without changing data', async () => {
  await setStorage(STORAGE_KEYS.presetKnowledgeDismissed, true)
  await importAiKnowledgePackage(packageText())
  const cardsBefore = readStored<KnowledgeCard[]>(STORAGE_KEYS.cards)

  await assert.rejects(importAiKnowledgePackage(packageText()), /已存在同名知识库/)
  assert.deepEqual(readStored(STORAGE_KEYS.cards), cardsBefore)
})
