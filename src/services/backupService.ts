import { STORAGE_KEYS } from '@/storage/keys'
import { isStoredFsrsCard } from '@/scheduler/fsrs'
import { PRESET_ID_PREFIX } from '@/data/presetKnowledge'
import { getStorage, setStorage, setStorageBatch } from '@/storage/storage'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewLog, ReviewState } from '@/types/review'
import type { BackupData, Settings } from '@/types/settings'
import { normalizeSettings } from '@/types/settings'
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
    (!('description' in value) || typeof value.description === 'string') &&
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
    (!('chapterId' in value) || typeof value.chapterId === 'string') &&
    (!('parentCardId' in value) || typeof value.parentCardId === 'string') &&
    (!('connection' in value) || typeof value.connection === 'string') &&
    (!('note' in value) || typeof value.note === 'string') &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === 'string') &&
    [1, 2, 3].includes(value.importance as number) &&
    ['active', 'suspended'].includes(value.status as string) &&
    hasNumber(value, 'createdAt') &&
    hasNumber(value, 'updatedAt')
  )
}

function isReviewState(value: unknown): value is ReviewState {
  if (!isRecord(value) || !isRecord(value.fsrsData)) return false
  const fsrsData = value.fsrsData
  const parsedDue = typeof fsrsData.due === 'string' ? Date.parse(fsrsData.due) : Number.NaN
  return (
    hasString(value, 'cardId') &&
    hasNumber(value, 'dueAt') &&
    Number.isInteger(value.dueAt) &&
    Number.isFinite(parsedDue) &&
    parsedDue === value.dueAt &&
    isStoredFsrsCard(fsrsData) &&
    (!('lastReviewAt' in value) ||
      value.lastReviewAt === undefined ||
      hasNumber(value, 'lastReviewAt'))
  )
}

function isReviewLog(value: unknown): value is ReviewLog {
  return (
    isRecord(value) &&
    hasString(value, 'id') &&
    hasString(value, 'cardId') &&
    hasString(value, 'subjectId') &&
    [1, 2, 3, 4].includes(value.rating as number) &&
    hasNumber(value, 'reviewedAt') &&
    (!('mode' in value) || ['scheduled', 'practice'].includes(value.mode as string))
  )
}

export function validateBackupData(value: unknown): value is BackupData {
  if (!isRecord(value) || value.version !== 1) return false
  const settings = value.settings
  const shapeIsValid =
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
    (settings.dailyNewCards as number) >= 0 &&
    (!('desiredRetention' in settings) ||
      (hasNumber(settings, 'desiredRetention') &&
        (settings.desiredRetention as number) >= 0.75 &&
        (settings.desiredRetention as number) <= 0.97)) &&
    (!('enableFuzz' in settings) || typeof settings.enableFuzz === 'boolean')

  if (!shapeIsValid) return false

  const data = value as unknown as BackupData
  const unique = (ids: string[]) => new Set(ids).size === ids.length
  if (
    !unique(data.subjects.map((item) => item.id)) ||
    !unique(data.chapters.map((item) => item.id)) ||
    !unique(data.cards.map((item) => item.id)) ||
    !unique(data.reviewStates.map((item) => item.cardId)) ||
    !unique(data.reviewLogs.map((item) => item.id))
  ) {
    return false
  }

  const subjectIds = new Set(data.subjects.map((item) => item.id))
  const chapterById = new Map(data.chapters.map((item) => [item.id, item]))
  const cardById = new Map(data.cards.map((item) => [item.id, item]))
  if (data.chapters.some((chapter) => !subjectIds.has(chapter.subjectId))) return false
  if (
    data.cards.some((card) => {
      if (!subjectIds.has(card.subjectId)) return true
      if (card.chapterId && chapterById.get(card.chapterId)?.subjectId !== card.subjectId) {
        return true
      }
      if (!card.parentCardId) return false
      const parent = cardById.get(card.parentCardId)
      return !parent || parent.id === card.id || parent.subjectId !== card.subjectId
    })
  ) {
    return false
  }
  for (const card of data.cards) {
    const visited = new Set([card.id])
    let parentId = card.parentCardId
    while (parentId) {
      if (visited.has(parentId)) return false
      visited.add(parentId)
      parentId = cardById.get(parentId)?.parentCardId
    }
  }
  if (data.reviewStates.some((state) => !cardById.has(state.cardId))) return false
  if (
    data.reviewLogs.some(
      (log) => !cardById.has(log.cardId) || cardById.get(log.cardId)?.subjectId !== log.subjectId,
    )
  ) {
    return false
  }

  return true
}

async function readCurrentBackup(): Promise<BackupData> {
  const [subjects, chapters, cards, reviewStates, reviewLogs, settings] = await Promise.all([
    getStorage<Subject[]>(STORAGE_KEYS.subjects).then((value) => value ?? []),
    getStorage<Chapter[]>(STORAGE_KEYS.chapters).then((value) => value ?? []),
    getStorage<KnowledgeCard[]>(STORAGE_KEYS.cards).then((value) => value ?? []),
    getStorage<ReviewState[]>(STORAGE_KEYS.reviewStates).then((value) => value ?? []),
    getStorage<ReviewLog[]>(STORAGE_KEYS.reviewLogs).then((value) => value ?? []),
    getStorage<Settings>(STORAGE_KEYS.settings).then((value) => normalizeSettings(value)),
  ])
  return { version: 1, subjects, chapters, cards, reviewStates, reviewLogs, settings }
}

async function writeBackupData(data: BackupData): Promise<void> {
  const includesPreset =
    data.subjects.some((item) => item.id.startsWith(PRESET_ID_PREFIX)) ||
    data.chapters.some((item) => item.id.startsWith(PRESET_ID_PREFIX)) ||
    data.cards.some((item) => item.id.startsWith(PRESET_ID_PREFIX))
  await setStorageBatch([
    { type: 'set', key: STORAGE_KEYS.subjects, value: data.subjects },
    { type: 'set', key: STORAGE_KEYS.chapters, value: data.chapters },
    { type: 'set', key: STORAGE_KEYS.cards, value: data.cards },
    { type: 'set', key: STORAGE_KEYS.reviewStates, value: data.reviewStates },
    { type: 'set', key: STORAGE_KEYS.reviewLogs, value: data.reviewLogs },
    {
      type: 'set',
      key: STORAGE_KEYS.settings,
      value: normalizeSettings(data.settings),
    },
    { type: 'remove', key: STORAGE_KEYS.reviewSession },
    { type: 'set', key: STORAGE_KEYS.presetKnowledgeDismissed, value: !includesPreset },
  ])
}

export async function exportBackup(): Promise<string> {
  return JSON.stringify(await readCurrentBackup(), null, 2)
}

export function parseBackup(json: string): BackupData {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('JSON 格式错误，当前数据未更改')
  }
  if (!validateBackupData(data)) {
    throw new Error('备份结构或数据关联无效，当前数据未更改')
  }
  return {
    ...data,
    settings: normalizeSettings(data.settings),
  }
}

export async function importBackup(json: string): Promise<void> {
  const data = parseBackup(json)
  const previous = await readCurrentBackup()
  await setStorage(STORAGE_KEYS.automaticBackup, {
    createdAt: Date.now(),
    json: JSON.stringify(previous, null, 2),
  })

  try {
    await writeBackupData(data)
  } catch (error) {
    try {
      await writeBackupData(previous)
    } catch {
      throw new Error('导入失败且自动回滚未完成，请使用导入前备份恢复数据')
    }
    throw new Error(`导入失败，已恢复原数据：${(error as Error).message}`)
  }
}

export async function hasAutomaticBackup(): Promise<boolean> {
  const snapshot = await getStorage<{ createdAt: number; json: string }>(
    STORAGE_KEYS.automaticBackup,
  )
  return Boolean(snapshot?.json)
}

export async function restoreAutomaticBackup(): Promise<void> {
  const snapshot = await getStorage<{ createdAt: number; json: string }>(
    STORAGE_KEYS.automaticBackup,
  )
  if (!snapshot?.json) throw new Error('没有可恢复的导入前备份')
  await importBackup(snapshot.json)
}
