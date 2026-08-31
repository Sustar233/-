import rawKnowledgePackage from './computerSystemPrinciplesKnowledge.json'
import type { CardImportance, KnowledgeCard } from '@/types/card'
import type { AiKnowledgePackage } from '@/types/knowledgePackage'
import type { Chapter, Subject } from '@/types/subject'
import type { PresetKnowledgeData } from './presetKnowledge'

export const COMPUTER_SYSTEM_PRESET_SUBJECT_ID =
  'preset_computer_system_principles_13015_subject_v1'
export const COMPUTER_SYSTEM_PRESET_ID_PREFIX =
  'preset_computer_system_principles_13015_'
export const COMPUTER_SYSTEM_PRESET_INTRODUCED_VERSION = 9

const PRESET_CREATED_AT = 1_788_192_000_000
const EXPECTED_CHAPTER_COUNT = 6
const EXPECTED_CARD_COUNT = 350
const knowledgePackage = rawKnowledgePackage as unknown as AiKnowledgePackage

export function buildComputerSystemPrinciplesPresetKnowledgeData(): PresetKnowledgeData {
  if (
    knowledgePackage.format !== 'recalllab-ai-knowledge' ||
    knowledgePackage.version !== 1
  ) {
    throw new Error('计算机系统原理默认知识库格式无效')
  }

  const subject: Subject = {
    id: COMPUTER_SYSTEM_PRESET_SUBJECT_ID,
    name: knowledgePackage.subject.name,
    description: knowledgePackage.subject.description,
    createdAt: PRESET_CREATED_AT,
    updatedAt: PRESET_CREATED_AT,
  }

  const chapters = knowledgePackage.chapters.map<Chapter>((chapter, chapterIndex) => ({
    id: `${COMPUTER_SYSTEM_PRESET_ID_PREFIX}chapter_${String(chapterIndex + 1).padStart(2, '0')}`,
    subjectId: COMPUTER_SYSTEM_PRESET_SUBJECT_ID,
    name: chapter.name,
    createdAt: PRESET_CREATED_AT + chapterIndex + 1,
    updatedAt: PRESET_CREATED_AT + chapterIndex + 1,
  }))
  const cards: KnowledgeCard[] = []

  for (const [chapterIndex, chapter] of knowledgePackage.chapters.entries()) {
    const chapterEntity = chapters[chapterIndex]!
    let previousCardId: string | undefined

    for (const [sectionIndex, section] of chapter.sections.entries()) {
      const sectionNumber = String(sectionIndex + 1).padStart(2, '0')
      const sectionId = `${chapterEntity.id}_section_${sectionNumber}`

      for (const sourceCard of section.cards) {
        const cardNumber = cards.length + 1
        const id = `${COMPUTER_SYSTEM_PRESET_ID_PREFIX}card_${String(cardNumber).padStart(4, '0')}`
        cards.push({
          id,
          subjectId: COMPUTER_SYSTEM_PRESET_SUBJECT_ID,
          chapterId: chapterEntity.id,
          sectionId,
          sectionTitle: section.title,
          parentCardId: previousCardId,
          connection:
            sourceCard.connection ??
            (previousCardId ? `沿“${chapterEntity.name}”的知识脉络继续学习。` : undefined),
          question: sourceCard.question,
          answer: sourceCard.answer,
          tags: [...(sourceCard.tags ?? [])],
          importance: (sourceCard.importance ?? 2) as CardImportance,
          status: 'active',
          note: sourceCard.note
            ? `内置知识库｜${sourceCard.note}`
            : '内置知识库｜《计算机系统原理（2023年版）》',
          createdAt: PRESET_CREATED_AT + cardNumber,
          updatedAt: PRESET_CREATED_AT + cardNumber,
        })
        previousCardId = id
      }
    }
  }

  if (chapters.length !== EXPECTED_CHAPTER_COUNT) {
    throw new Error(
      `计算机系统原理默认章节数量应为${EXPECTED_CHAPTER_COUNT}，当前为${chapters.length}`,
    )
  }
  if (cards.length !== EXPECTED_CARD_COUNT) {
    throw new Error(
      `计算机系统原理默认知识卡数量应为${EXPECTED_CARD_COUNT}，当前为${cards.length}`,
    )
  }

  return { subject, chapters, cards }
}
