import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage } from '@/storage/storage'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewSession, ReviewState } from '@/types/review'
import type { Subject } from '@/types/subject'
import { startOfDay } from '@/utils/date'
import { ensurePresetKnowledge } from './presetKnowledgeService'
import {
  buildReviewQueueFromData,
  buildTodayReviewQueueFromData,
  getReviewLogs,
  getReviewSession,
  getReviewStates,
} from './reviewService'
import { calculateStatistics, type StatisticsSummary } from './statisticsService'

export interface DashboardSnapshot {
  subjects: Subject[]
  cards: KnowledgeCard[]
  dueCount: number
  statistics: StatisticsSummary
  session: ReviewSession | null
  todayWrongCount: number
  todaySubjectIds: string[]
}

export async function getDashboardSnapshot(now = Date.now()): Promise<DashboardSnapshot> {
  await ensurePresetKnowledge()
  const [subjectsValue, cardsValue, states, logs, session] = await Promise.all([
    getStorage<Subject[]>(STORAGE_KEYS.subjects),
    getStorage<KnowledgeCard[]>(STORAGE_KEYS.cards),
    getReviewStates(),
    getReviewLogs(),
    getReviewSession(),
  ])
  const subjects = subjectsValue ?? []
  const cards = cardsValue ?? []
  const cardsBySubject = new Map<string, KnowledgeCard[]>()
  const subjectByCard = new Map<string, string>()
  const statesBySubject = new Map<string, ReviewState[]>()
  for (const card of cards) {
    const group = cardsBySubject.get(card.subjectId) ?? []
    group.push(card)
    cardsBySubject.set(card.subjectId, group)
    subjectByCard.set(card.id, card.subjectId)
  }
  for (const state of states) {
    const subjectId = subjectByCard.get(state.cardId)
    if (!subjectId) continue
    const group = statesBySubject.get(subjectId) ?? []
    group.push(state)
    statesBySubject.set(subjectId, group)
  }
  const subjectIds = new Set(subjects.map((subject) => subject.id))
  const today = startOfDay(now)
  const todaySubjectIds: string[] = []
  const addTodaySubject = (subjectId?: string): void => {
    if (subjectId && subjectIds.has(subjectId) && !todaySubjectIds.includes(subjectId)) {
      todaySubjectIds.push(subjectId)
    }
  }
  if (session && startOfDay(session.startedAt) === today) {
    addTodaySubject(session.filter.subjectId)
  }
  const latestTodayBySubject = new Map<string, number>()
  for (const log of logs) {
    if (startOfDay(log.reviewedAt) !== today) continue
    latestTodayBySubject.set(log.subjectId, Math.max(latestTodayBySubject.get(log.subjectId) ?? 0, log.reviewedAt))
  }
  for (const [subjectId] of [...latestTodayBySubject].sort((first, second) => second[1] - first[1])) {
    addTodaySubject(subjectId)
  }

  return {
    subjects,
    cards,
    dueCount: subjects.reduce(
      (count, subject) =>
        count + buildReviewQueueFromData({
          cards: cardsBySubject.get(subject.id) ?? [],
          states: statesBySubject.get(subject.id) ?? [],
        }, now, { subjectId: subject.id }).length,
      0,
    ),
    statistics: calculateStatistics(cards, logs, states, now),
    session,
    todayWrongCount: buildTodayReviewQueueFromData(cards, logs, now, {}, true).length,
    todaySubjectIds,
  }
}
