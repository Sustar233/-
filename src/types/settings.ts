import type { KnowledgeCard } from './card'
import type { ReviewLog, ReviewState } from './review'
import type { Chapter, Subject } from './subject'

export interface Settings {
  dailyNewCards: number
  desiredRetention: number
  enableFuzz: boolean
}

export interface BackupData {
  version: 1
  subjects: Subject[]
  chapters: Chapter[]
  cards: KnowledgeCard[]
  reviewStates: ReviewState[]
  reviewLogs: ReviewLog[]
  settings: Settings
  presetKnowledgeDismissed?: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  dailyNewCards: 20,
  desiredRetention: 0.9,
  enableFuzz: true,
}

export function normalizeSettings(value?: Partial<Settings> | null): Settings {
  const rawDailyNewCards = value?.dailyNewCards
  const rawDesiredRetention = value?.desiredRetention
  const dailyNewCards = typeof rawDailyNewCards === 'number' && Number.isFinite(rawDailyNewCards)
    ? Math.min(200, Math.max(0, Math.round(rawDailyNewCards)))
    : DEFAULT_SETTINGS.dailyNewCards
  const desiredRetention =
    typeof rawDesiredRetention === 'number' && Number.isFinite(rawDesiredRetention)
    ? Math.min(0.97, Math.max(0.75, Number(rawDesiredRetention.toFixed(2))))
    : DEFAULT_SETTINGS.desiredRetention

  return {
    dailyNewCards,
    desiredRetention,
    enableFuzz:
      typeof value?.enableFuzz === 'boolean' ? value.enableFuzz : DEFAULT_SETTINGS.enableFuzz,
  }
}
