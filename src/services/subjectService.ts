import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage, setStorage, setStorageBatch, type StorageMutation } from '@/storage/storage'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewLog, ReviewSession, ReviewState } from '@/types/review'
import type { Chapter, Subject } from '@/types/subject'
import { generateId } from '@/utils/id'
import { ensurePresetKnowledge, isPresetKnowledgeId } from './presetKnowledgeService'

export async function getSubjects(): Promise<Subject[]> {
  await ensurePresetKnowledge()
  return (await getStorage<Subject[]>(STORAGE_KEYS.subjects)) ?? []
}

export async function getChapters(subjectId?: string): Promise<Chapter[]> {
  await ensurePresetKnowledge()
  const chapters = (await getStorage<Chapter[]>(STORAGE_KEYS.chapters)) ?? []
  return subjectId ? chapters.filter((chapter) => chapter.subjectId === subjectId) : chapters
}

export async function createSubject(name: string, description?: string): Promise<Subject> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('科目名称不能为空')

  const subjects = await getSubjects()
  const now = Date.now()
  const subject: Subject = {
    id: generateId('subject'),
    name: trimmedName,
    description: description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }
  await setStorage(STORAGE_KEYS.subjects, [...subjects, subject])
  return subject
}

export async function updateSubject(
  id: string,
  changes: Pick<Subject, 'name'> & Partial<Pick<Subject, 'description'>>,
): Promise<Subject> {
  const name = changes.name.trim()
  if (!name) throw new Error('科目名称不能为空')

  const subjects = await getSubjects()
  const current = subjects.find((subject) => subject.id === id)
  if (!current) throw new Error('科目不存在')
  const updated: Subject = {
    ...current,
    name,
    description: changes.description?.trim() || undefined,
    updatedAt: Date.now(),
  }
  await setStorage(
    STORAGE_KEYS.subjects,
    subjects.map((subject) => (subject.id === id ? updated : subject)),
  )
  return updated
}

export interface ResetSubjectProgressResult {
  logCount: number
  stateCount: number
}

export async function resetSubjectProgress(
  subjectId: string,
): Promise<ResetSubjectProgressResult> {
  const [subjects, cards, reviewStates, reviewLogs, reviewSession] = await Promise.all([
    getStorage<Subject[]>(STORAGE_KEYS.subjects).then((value) => value ?? []),
    getStorage<KnowledgeCard[]>(STORAGE_KEYS.cards).then((value) => value ?? []),
    getStorage<ReviewState[]>(STORAGE_KEYS.reviewStates).then((value) => value ?? []),
    getStorage<ReviewLog[]>(STORAGE_KEYS.reviewLogs).then((value) => value ?? []),
    getStorage<ReviewSession>(STORAGE_KEYS.reviewSession),
  ])
  if (!subjects.some((subject) => subject.id === subjectId)) {
    throw new Error('知识库不存在')
  }

  const cardIds = new Set(
    cards.filter((card) => card.subjectId === subjectId).map((card) => card.id),
  )
  const remainingStates = reviewStates.filter((state) => !cardIds.has(state.cardId))
  const remainingLogs = reviewLogs.filter(
    (log) => log.subjectId !== subjectId && !cardIds.has(log.cardId),
  )
  const mutations: StorageMutation[] = [
    { type: 'set', key: STORAGE_KEYS.reviewStates, value: remainingStates },
    { type: 'set', key: STORAGE_KEYS.reviewLogs, value: remainingLogs },
  ]

  if (
    reviewSession &&
    (reviewSession.filter.subjectId === subjectId ||
      reviewSession.cardIds.some((cardId) => cardIds.has(cardId)))
  ) {
    mutations.push({ type: 'remove', key: STORAGE_KEYS.reviewSession })
  }

  await setStorageBatch(mutations)
  return {
    logCount: reviewLogs.length - remainingLogs.length,
    stateCount: reviewStates.length - remainingStates.length,
  }
}

export async function deleteSubject(id: string): Promise<void> {
  const [subjects, chapters, cards, reviewStates, reviewLogs] = await Promise.all([
    getSubjects(),
    getChapters(),
    getStorage<KnowledgeCard[]>(STORAGE_KEYS.cards).then((value) => value ?? []),
    getStorage<ReviewState[]>(STORAGE_KEYS.reviewStates).then((value) => value ?? []),
    getStorage<ReviewLog[]>(STORAGE_KEYS.reviewLogs).then((value) => value ?? []),
  ])
  const removedCardIds = new Set(cards.filter((card) => card.subjectId === id).map((card) => card.id))

  const mutations: StorageMutation[] = [
    {
      type: 'set',
      key: STORAGE_KEYS.subjects,
      value: subjects.filter((subject) => subject.id !== id),
    },
    {
      type: 'set',
      key: STORAGE_KEYS.chapters,
      value: chapters.filter((chapter) => chapter.subjectId !== id),
    },
    {
      type: 'set',
      key: STORAGE_KEYS.cards,
      value: cards.filter((card) => card.subjectId !== id),
    },
    {
      type: 'set',
      key: STORAGE_KEYS.reviewStates,
      value: reviewStates.filter((state) => !removedCardIds.has(state.cardId)),
    },
    {
      type: 'set',
      key: STORAGE_KEYS.reviewLogs,
      value: reviewLogs.filter((log) => log.subjectId !== id),
    },
    { type: 'remove', key: STORAGE_KEYS.reviewSession },
  ]
  if (isPresetKnowledgeId(id)) {
    mutations.push({ type: 'set', key: STORAGE_KEYS.presetKnowledgeDismissed, value: true })
  }
  await setStorageBatch(mutations)
}

export async function createChapter(subjectId: string, name: string): Promise<Chapter> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('章节名称不能为空')
  if (!(await getSubjects()).some((subject) => subject.id === subjectId)) {
    throw new Error('科目不存在')
  }
  const chapters = await getChapters()
  const now = Date.now()
  const chapter: Chapter = {
    id: generateId('chapter'),
    subjectId,
    name: trimmedName,
    createdAt: now,
    updatedAt: now,
  }
  await setStorage(STORAGE_KEYS.chapters, [...chapters, chapter])
  return chapter
}

export async function updateChapter(id: string, name: string): Promise<Chapter> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('章节名称不能为空')
  const chapters = await getChapters()
  const current = chapters.find((chapter) => chapter.id === id)
  if (!current) throw new Error('章节不存在')
  const updated = { ...current, name: trimmedName, updatedAt: Date.now() }
  await setStorage(
    STORAGE_KEYS.chapters,
    chapters.map((chapter) => (chapter.id === id ? updated : chapter)),
  )
  return updated
}

export async function deleteChapter(id: string): Promise<void> {
  const [chapters, cards] = await Promise.all([
    getChapters(),
    getStorage<KnowledgeCard[]>(STORAGE_KEYS.cards).then((value) => value ?? []),
  ])
  const mutations: StorageMutation[] = [
    {
      type: 'set',
      key: STORAGE_KEYS.chapters,
      value: chapters.filter((chapter) => chapter.id !== id),
    },
    {
      type: 'set',
      key: STORAGE_KEYS.cards,
      value: cards.map((card) => {
        if (card.chapterId !== id) return card
        const {
          chapterId: _chapterId,
          sectionId: _sectionId,
          sectionTitle: _sectionTitle,
          ...uncategorized
        } = card
        return { ...uncategorized, updatedAt: Date.now() }
      }),
    },
  ]
  if (isPresetKnowledgeId(id)) {
    mutations.push({ type: 'set', key: STORAGE_KEYS.presetKnowledgeDismissed, value: true })
  }
  await setStorageBatch(mutations)
}
