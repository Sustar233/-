import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage } from '@/storage/storage'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewSession } from '@/types/review'
import type { Settings } from '@/types/settings'
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
  const [subjectsValue, cardsValue, states, logs, settings, session] = await Promise.all([
    getStorage<Subject[]>(STORAGE_KEYS.subjects),
    getStorage<KnowledgeCard[]>(STORAGE_KEYS.cards),
    getReviewStates(),
    getReviewLogs(),
    getStorage<Settings>(STORAGE_KEYS.settings),
    getReviewSession(),
  ])
  const subjects = subjectsValue ?? []
  const cards = cardsValue ?? []
  const queueData = { cards, states, logs, settings }
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
  for (const log of [...logs].sort((first, second) => second.reviewedAt - first.reviewedAt)) {
    if (startOfDay(log.reviewedAt) === today) addTodaySubject(log.subjectId)
  }

  return {
    subjects,
    cards,
    dueCount: subjects.reduce(
      (count, subject) =>
        count + buildReviewQueueFromData(queueData, now, { subjectId: subject.id }).length,
      0,
    ),
    statistics: calculateStatistics(cards, logs, now),
    session,
    todayWrongCount: buildTodayReviewQueueFromData(cards, logs, now, {}, true).length,
    todaySubjectIds,
  }
}
