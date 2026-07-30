import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage, setStorage } from '@/storage/storage'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewLog, ReviewState } from '@/types/review'
import type { BackupData, Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/types/settings'
import type { Chapter, Subject } from '@/types/subject'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'string'
}

function hasNumber(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'number' && Number.isFinite(record[key])
}

function isSubject(value: unknown): value is Subject {
  return (
    isRecord(value) &&
    hasString(value, 'id') &&
    hasString(value, 'name') &&
    hasNumber(value, 'createdAt') &&
    hasNumber(value, 'updatedAt')
  )
}

function isChapter(value: unknown): value is Chapter {
  return (
    isRecord(value) &&
    hasString(value, 'id') &&
    hasString(value, 'subjectId') &&
    hasString(value, 'name') &&
    hasNumber(value, 'createdAt') &&
    hasNumber(value, 'updatedAt')
  )
}

function isCard(value: unknown): value is KnowledgeCard {
  return (
    isRecord(value) &&
    hasString(value, 'id') &&
    hasString(value, 'subjectId') &&
    hasString(value, 'question') &&
    hasString(value, 'answer') &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === 'string') &&
    [1, 2, 3].includes(value.importance as number) &&
    ['active', 'suspended'].includes(value.status as string) &&
    hasNumber(value, 'createdAt') &&
    hasNumber(value, 'updatedAt')
  )
}

function isReviewState(value: unknown): value is ReviewState {
  return isRecord(value) && hasString(value, 'cardId') && hasNumber(value, 'dueAt') && 'fsrsData' in value
}

function isReviewLog(value: unknown): value is ReviewLog {
  return (
    isRecord(value) &&
    hasString(value, 'id') &&
    hasString(value, 'cardId') &&
    hasString(value, 'subjectId') &&
    [1, 2, 3, 4].includes(value.rating as number) &&
    hasNumber(value, 'reviewedAt')
  )
}

export function validateBackupData(value: unknown): value is BackupData {
  if (!isRecord(value) || value.version !== 1) return false
  const settings = value.settings
  return (
    Array.isArray(value.subjects) &&
    value.subjects.every(isSubject) &&
    Array.isArray(value.chapters) &&
    value.chapters.every(isChapter) &&
    Array.isArray(value.cards) &&
    value.cards.every(isCard) &&
    Array.isArray(value.reviewStates) &&
    value.reviewStates.every(isReviewState) &&
    Array.isArray(value.reviewLogs) &&
    value.reviewLogs.every(isReviewLog) &&
    isRecord(settings) &&
    hasNumber(settings, 'dailyNewCards') &&
    (settings.dailyNewCards as number) >= 0
  )
}

export async function exportBackup(): Promise<string> {
  const [subjects, chapters, cards, reviewStates, reviewLogs, settings] = await Promise.all([
    getStorage<Subject[]>(STORAGE_KEYS.subjects).then((value) => value ?? []),
    getStorage<Chapter[]>(STORAGE_KEYS.chapters).then((value) => value ?? []),
    getStorage<KnowledgeCard[]>(STORAGE_KEYS.cards).then((value) => value ?? []),
    getStorage<ReviewState[]>(STORAGE_KEYS.reviewStates).then((value) => value ?? []),
    getStorage<ReviewLog[]>(STORAGE_KEYS.reviewLogs).then((value) => value ?? []),
    getStorage<Settings>(STORAGE_KEYS.settings).then((value) => value ?? DEFAULT_SETTINGS),
  ])
  return JSON.stringify(
    { version: 1, subjects, chapters, cards, reviewStates, reviewLogs, settings } satisfies BackupData,
    null,
    2,
  )
}

export function parseBackup(json: string): BackupData {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('JSON 格式错误，当前数据未更改')
  }
  if (!validateBackupData(data)) throw new Error('备份结构无效，当前数据未更改')
  return data
}

export async function importBackup(json: string): Promise<void> {
  const data = parseBackup(json)
  await Promise.all([
    setStorage(STORAGE_KEYS.subjects, data.subjects),
    setStorage(STORAGE_KEYS.chapters, data.chapters),
    setStorage(STORAGE_KEYS.cards, data.cards),
    setStorage(STORAGE_KEYS.reviewStates, data.reviewStates),
    setStorage(STORAGE_KEYS.reviewLogs, data.reviewLogs),
    setStorage(STORAGE_KEYS.settings, data.settings),
  ])
}
