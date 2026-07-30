export type CardImportance = 1 | 2 | 3
export type CardStatus = 'active' | 'suspended'

export interface KnowledgeCard {
  id: string
  subjectId: string
  chapterId?: string
  question: string
  answer: string
  tags: string[]
  importance: CardImportance
  status: CardStatus
  note?: string
  createdAt: number
  updatedAt: number
}

export type KnowledgeCardInput = Pick<KnowledgeCard, 'subjectId' | 'question' | 'answer'> &
  Partial<Pick<KnowledgeCard, 'chapterId' | 'tags' | 'importance' | 'note'>>
