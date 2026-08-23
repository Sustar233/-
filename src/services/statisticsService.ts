import { getCards } from './cardService'
import { getReviewLogs } from './reviewService'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewLog } from '@/types/review'
import { addDays, formatShortDate, startOfDay } from '@/utils/date'

export interface DayStatistic {
  day: number
  label: string
  count: number
}

export interface StatisticsSummary {
  todayReviews: number
  todayNewCards: number
  todayAgain: number
  streakDays: number
  last7Days: DayStatistic[]
  weakCards: Array<{ card: KnowledgeCard; score: number; reviewCount: number }>
}

export function createEmptyStatistics(): StatisticsSummary {
  return {
    todayReviews: 0,
    todayNewCards: 0,
    todayAgain: 0,
    streakDays: 0,
    last7Days: [],
    weakCards: [],
  }
}

export function calculateStreak(logs: ReviewLog[], now = Date.now()): number {
  const studiedDays = new Set(logs.map((log) => startOfDay(log.reviewedAt)))
  let cursor = startOfDay(now)
  if (!studiedDays.has(cursor)) cursor = addDays(cursor, -1)
  let streak = 0
  while (studiedDays.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function calculateWeakCards(
  cards: KnowledgeCard[],
  logs: ReviewLog[],
): Array<{ card: KnowledgeCard; score: number; reviewCount: number }> {
  const logsByCard = new Map<string, ReviewLog[]>()
  for (const log of logs) {
    const cardLogs = logsByCard.get(log.cardId) ?? []
    cardLogs.push(log)
    logsByCard.set(log.cardId, cardLogs)
  }

  return cards
    .map((card) => {
      const recent = (logsByCard.get(card.id) ?? [])
        .sort((first, second) => second.reviewedAt - first.reviewedAt)
        .slice(0, 10)
      const weights: Record<number, number> = { 1: 3, 2: 1, 3: 0, 4: -1 }
      const score = recent.reduce((total, log) => total + weights[log.rating], 0)
      return { card, score, reviewCount: recent.length }
    })
    .filter((item) => item.reviewCount >= 3 && item.score > 0)
    .sort((first, second) => second.score - first.score || second.reviewCount - first.reviewCount)
    .slice(0, 10)
}

export function calculateStatistics(
  cards: KnowledgeCard[],
  logs: ReviewLog[],
  now = Date.now(),
): StatisticsSummary {
  const today = startOfDay(now)
  const reviewsByDay = new Map<number, number>()
  const firstReviewByCard = new Map<string, number>()
  let todayReviews = 0
  let todayAgain = 0
  for (const log of logs) {
    const day = startOfDay(log.reviewedAt)
    reviewsByDay.set(day, (reviewsByDay.get(day) ?? 0) + 1)
    if (day === today) {
      todayReviews += 1
      if (log.rating === 1) todayAgain += 1
    }
    const firstReviewAt = firstReviewByCard.get(log.cardId)
    if (firstReviewAt === undefined || log.reviewedAt < firstReviewAt) {
      firstReviewByCard.set(log.cardId, log.reviewedAt)
    }
  }
  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(today, index - 6)
    return {
      day,
      label: formatShortDate(day),
      count: reviewsByDay.get(day) ?? 0,
    }
  })
  return {
    todayReviews,
    todayNewCards: [...firstReviewByCard.values()].filter((time) => startOfDay(time) === today).length,
    todayAgain,
    streakDays: calculateStreak(logs, now),
    last7Days,
    weakCards: calculateWeakCards(cards, logs),
  }
}

export async function getStatistics(now = Date.now()): Promise<StatisticsSummary> {
  const [cards, logs] = await Promise.all([getCards(), getReviewLogs()])
  return calculateStatistics(cards, logs, now)
}
