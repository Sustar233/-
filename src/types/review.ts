export type ReviewRating = 1 | 2 | 3 | 4
export type ReviewMode = 'scheduled' | 'practice'

export interface ReviewState {
  cardId: string
  dueAt: number
  fsrsData: unknown
  lastReviewAt?: number
  rememberedDayStreak?: number
  lastRememberedDay?: number
  lastForgottenDay?: number
  masteredAt?: number
}

export interface ReviewLog {
  id: string
  cardId: string
  subjectId: string
  rating: ReviewRating
  reviewedAt: number
  mode?: ReviewMode
}

export interface ReviewFilter {
  subjectId?: string
  chapterId?: string
  uncategorizedOnly?: boolean
  tag?: string
}

export interface ReviewCommit {
  cardId: string
  previousState?: ReviewState
  nextState: ReviewState
  log: ReviewLog
}

export interface ReviewSession {
  version: 1
  cardIds: string[]
  currentIndex: number
  startedAt: number
  filter: ReviewFilter
  mode?: ReviewMode
  previewedCardIds?: string[]
  forgottenCardIds?: string[]
  previousForgottenCardIds?: string[]
  lastCommit?: ReviewCommit
}
