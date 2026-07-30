import type { KnowledgeCard } from './card'
import type { ReviewLog, ReviewState } from './review'
import type { Chapter, Subject } from './subject'

export interface Settings {
  dailyNewCards: number
}

export interface BackupData {
  version: 1
  subjects: Subject[]
  chapters: Chapter[]
  cards: KnowledgeCard[]
  reviewStates: ReviewState[]
  reviewLogs: ReviewLog[]
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  dailyNewCards: 20,
}
