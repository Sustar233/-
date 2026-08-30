import type { CardImportance } from './card'

export const AI_KNOWLEDGE_PACKAGE_FORMAT = 'recalllab-ai-knowledge' as const

export interface AiKnowledgeCard {
  question: string
  answer: string
  tags?: string[]
  importance?: CardImportance
  connection?: string
  note?: string
}

export interface AiKnowledgeSection {
  title: string
  cards: AiKnowledgeCard[]
}

export interface AiKnowledgeChapter {
  name: string
  sections: AiKnowledgeSection[]
}

export interface AiKnowledgePackage {
  format: typeof AI_KNOWLEDGE_PACKAGE_FORMAT
  version: 1
  subject: {
    name: string
    description?: string
  }
  chapters: AiKnowledgeChapter[]
}

export interface AiKnowledgeImportResult {
  subjectId: string
  subjectName: string
  chapterCount: number
  sectionCount: number
  cardCount: number
}
