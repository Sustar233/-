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
