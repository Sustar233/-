export type ReviewRating = 1 | 2 | 3 | 4

export interface ReviewState {
  cardId: string
  dueAt: number
  fsrsData: unknown
  lastReviewAt?: number
}

export interface ReviewLog {
  id: string
  cardId: string
  subjectId: string
  rating: ReviewRating
  reviewedAt: number
}

export interface ReviewPreview {
  rating: ReviewRating
  dueAt: number
  intervalLabel: string
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
  lastCommit?: ReviewCommit
}
