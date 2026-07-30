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
  return cards
    .map((card) => {
      const recent = logs
        .filter((log) => log.cardId === card.id)
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
  const todayLogs = logs.filter((log) => startOfDay(log.reviewedAt) === today)
  const firstReviewByCard = new Map<string, number>()
  for (const log of [...logs].sort((first, second) => first.reviewedAt - second.reviewedAt)) {
    if (!firstReviewByCard.has(log.cardId)) firstReviewByCard.set(log.cardId, log.reviewedAt)
  }
  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(today, index - 6)
    return {
      day,
      label: formatShortDate(day),
      count: logs.filter((log) => startOfDay(log.reviewedAt) === day).length,
    }
  })
  return {
    todayReviews: todayLogs.length,
    todayNewCards: [...firstReviewByCard.values()].filter((time) => startOfDay(time) === today).length,
    todayAgain: todayLogs.filter((log) => log.rating === 1).length,
    streakDays: calculateStreak(logs, now),
    last7Days,
    weakCards: calculateWeakCards(cards, logs),
  }
}

export async function getStatistics(now = Date.now()): Promise<StatisticsSummary> {
  const [cards, logs] = await Promise.all([getCards(), getReviewLogs()])
  return calculateStatistics(cards, logs, now)
}
