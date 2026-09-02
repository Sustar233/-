import { ensurePresetKnowledge } from './presetKnowledgeService'
import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage, setStorageBatch } from '@/storage/storage'
import type { CardImportance, KnowledgeCard } from '@/types/card'
import {
  AI_KNOWLEDGE_PACKAGE_FORMAT,
  type AiKnowledgeCard,
  type AiKnowledgeChapter,
  type AiKnowledgeImportResult,
  type AiKnowledgePackage,
  type AiKnowledgeSection,
} from '@/types/knowledgePackage'
import type { Chapter, Subject } from '@/types/subject'
import { generateId } from '@/utils/id'

const MAX_PACKAGE_CARDS = 1500
const MAX_SECTION_CARDS = 10

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requiredText(
  value: unknown,
  path: string,
  maximumLength: number,
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${path}不能为空`)
  }
  const text = value.trim()
  if (text.length > maximumLength) {
    throw new Error(`${path}不能超过 ${maximumLength} 个字`)
  }
  return text
}

function optionalText(
  value: unknown,
  path: string,
  maximumLength: number,
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new Error(`${path}必须是文字`)
  const text = value.trim()
  if (!text) return undefined
  if (text.length > maximumLength) {
    throw new Error(`${path}不能超过 ${maximumLength} 个字`)
  }
  return text
}

function parseTags(value: unknown, path: string): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || !value.every((tag) => typeof tag === 'string')) {
    throw new Error(`${path}必须是文字数组`)
  }
  const tags = [...new Set(value.map((tag) => tag.trim()).filter(Boolean))]
  if (tags.length > 3) throw new Error(`${path}最多包含 3 个标签`)
  if (tags.some((tag) => tag.length > 40)) throw new Error(`${path}中的单个标签不能超过 40 个字`)
  return tags.length ? tags : undefined
}

function parseCard(value: unknown, path: string): AiKnowledgeCard {
  if (!isRecord(value)) throw new Error(`${path}必须是对象`)
  const importanceValue = value.importance ?? 2
  if (![1, 2, 3].includes(importanceValue as number)) {
    throw new Error(`${path}.importance只能是 1、2 或 3`)
  }
  return {
    question: requiredText(value.question, `${path}.question`, 1000),
    answer: requiredText(value.answer, `${path}.answer`, 5000),
    tags: parseTags(value.tags, `${path}.tags`),
    importance: importanceValue as CardImportance,
    connection: optionalText(value.connection, `${path}.connection`, 500),
    note: optionalText(value.note, `${path}.note`, 2000),
  }
}

function parseSection(value: unknown, path: string): AiKnowledgeSection {
  if (!isRecord(value)) throw new Error(`${path}必须是对象`)
  if (!Array.isArray(value.cards) || !value.cards.length) {
    throw new Error(`${path}.cards至少需要 1 张知识卡`)
  }
  if (value.cards.length > MAX_SECTION_CARDS) {
    throw new Error(`${path}.cards超过 ${MAX_SECTION_CARDS} 张，请继续拆分小节`)
  }
  return {
    title: requiredText(value.title, `${path}.title`, 80),
    cards: value.cards.map((card, index) => parseCard(card, `${path}.cards[${index}]`)),
  }
}

function parseChapter(value: unknown, path: string): AiKnowledgeChapter {
  if (!isRecord(value)) throw new Error(`${path}必须是对象`)
  if (!Array.isArray(value.sections) || !value.sections.length) {
    throw new Error(`${path}.sections至少需要 1 个小节`)
  }
  const sections = value.sections.map((section, index) =>
    parseSection(section, `${path}.sections[${index}]`),
  )
  const sectionNames = sections.map((section) => section.title.toLocaleLowerCase())
  if (new Set(sectionNames).size !== sectionNames.length) {
    throw new Error(`${path}中存在重名小节`)
  }
  return {
    name: requiredText(value.name, `${path}.name`, 40),
    sections,
  }
}

export function parseAiKnowledgePackage(text: string): AiKnowledgePackage {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('AI 知识库不是合法 JSON，请确认没有代码块或额外说明')
  }
  if (!isRecord(value)) throw new Error('AI 知识库顶层必须是对象')
  if (value.format !== AI_KNOWLEDGE_PACKAGE_FORMAT || value.version !== 1) {
    throw new Error('AI 知识库格式标识或版本不受支持')
  }
  if (!isRecord(value.subject)) throw new Error('subject必须是对象')
  if (!Array.isArray(value.chapters) || !value.chapters.length) {
    throw new Error('chapters至少需要 1 个章节')
  }

  const chapters = value.chapters.map((chapter, index) =>
    parseChapter(chapter, `chapters[${index}]`),
  )
  const chapterNames = chapters.map((chapter) => chapter.name.toLocaleLowerCase())
  if (new Set(chapterNames).size !== chapterNames.length) {
    throw new Error('知识库中存在重名章节')
  }
  const cardCount = chapters.reduce(
    (total, chapter) =>
      total + chapter.sections.reduce((count, section) => count + section.cards.length, 0),
    0,
  )
  if (cardCount > MAX_PACKAGE_CARDS) {
    throw new Error(`单次最多导入 ${MAX_PACKAGE_CARDS} 张知识卡，请分成多个知识库`)
  }

  const questions = chapters.flatMap((chapter) =>
    chapter.sections.flatMap((section) =>
      section.cards.map((card) => card.question.toLocaleLowerCase()),
    ),
  )
  if (new Set(questions).size !== questions.length) {
    throw new Error('知识库中存在完全重复的问题，请先合并或改写')
  }

  return {
    format: AI_KNOWLEDGE_PACKAGE_FORMAT,
    version: 1,
    subject: {
      name: requiredText(value.subject.name, 'subject.name', 40),
      description: optionalText(value.subject.description, 'subject.description', 100),
    },
    chapters,
  }
}

function uniqueId(prefix: string, usedIds: Set<string>): string {
  let id = generateId(prefix)
  while (usedIds.has(id)) id = generateId(prefix)
  usedIds.add(id)
  return id
}

export async function importAiKnowledgePackage(text: string): Promise<AiKnowledgeImportResult> {
  const knowledgePackage = parseAiKnowledgePackage(text)
  await ensurePresetKnowledge()
  const [subjectsValue, chaptersValue, cardsValue] = await Promise.all([
    getStorage<Subject[]>(STORAGE_KEYS.subjects),
    getStorage<Chapter[]>(STORAGE_KEYS.chapters),
    getStorage<KnowledgeCard[]>(STORAGE_KEYS.cards),
  ])
  const subjects = subjectsValue ?? []
  const chapters = chaptersValue ?? []
  const cards = cardsValue ?? []
  if (
    subjects.some(
      (subject) =>
        subject.name.trim().toLocaleLowerCase() ===
        knowledgePackage.subject.name.toLocaleLowerCase(),
    )
  ) {
    throw new Error('已存在同名知识库，请修改 JSON 中的 subject.name 后再导入')
  }

  const usedIds = new Set([
    ...subjects.map((subject) => subject.id),
    ...chapters.map((chapter) => chapter.id),
    ...cards.map((card) => card.id),
  ])
  const now = Date.now()
  const subjectId = uniqueId('subject', usedIds)
  const subject: Subject = {
    id: subjectId,
    name: knowledgePackage.subject.name,
    description: knowledgePackage.subject.description,
    createdAt: now,
    updatedAt: now,
  }
  const importedChapters: Chapter[] = []
  const importedCards: KnowledgeCard[] = []
  let sectionCount = 0

  for (const packageChapter of knowledgePackage.chapters) {
    const chapterId = uniqueId('chapter', usedIds)
    importedChapters.push({
      id: chapterId,
      subjectId,
      name: packageChapter.name,
      createdAt: now,
      updatedAt: now,
    })
    let previousCardId: string | undefined
    for (const section of packageChapter.sections) {
      const sectionId = uniqueId('section', usedIds)
      sectionCount += 1
      for (const packageCard of section.cards) {
        const cardId = uniqueId('card', usedIds)
        importedCards.push({
          id: cardId,
          subjectId,
          chapterId,
          sectionId,
          sectionTitle: section.title,
          parentCardId: previousCardId,
          connection: previousCardId ? packageChapter.name : undefined,
          question: packageCard.question,
          answer: packageCard.answer,
          tags: packageCard.tags ?? [],
          importance: packageCard.importance ?? 2,
          status: 'active',
          note: packageCard.note,
          createdAt: now,
          updatedAt: now,
        })
        previousCardId = cardId
      }
    }
  }

  await setStorageBatch([
    { type: 'set', key: STORAGE_KEYS.subjects, value: [...subjects, subject] },
    { type: 'set', key: STORAGE_KEYS.chapters, value: [...chapters, ...importedChapters] },
    { type: 'set', key: STORAGE_KEYS.cards, value: [...cards, ...importedCards] },
  ])

  return {
    subjectId,
    subjectName: subject.name,
    chapterCount: importedChapters.length,
    sectionCount,
    cardCount: importedCards.length,
  }
}
