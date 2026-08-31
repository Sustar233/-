import {
  buildPresetKnowledgeData,
  LEGACY_PRESET_ID_PREFIXES,
  PRESET_ID_PREFIX,
  PRESET_KNOWLEDGE_VERSION,
} from '@/data/presetKnowledge'
import {
  buildSeedancePresetKnowledgeData,
  SEEDANCE_PRESET_ID_PREFIX,
} from '@/data/seedancePresetKnowledge'
import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage, setStorageBatch, type StorageMutation } from '@/storage/storage'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewLog, ReviewSession, ReviewState } from '@/types/review'
import type { Chapter, Subject } from '@/types/subject'

let initializationPromise: Promise<void> | null = null

const CURRENT_PRESET_PREFIXES = [SEEDANCE_PRESET_ID_PREFIX, PRESET_ID_PREFIX] as const
const ALL_PRESET_PREFIXES = [...CURRENT_PRESET_PREFIXES, ...LEGACY_PRESET_ID_PREFIXES]

export function isPresetKnowledgeId(id: string): boolean {
  return ALL_PRESET_PREFIXES.some((prefix) => id.startsWith(prefix))
}

function isCurrentPresetId(id: string): boolean {
  return CURRENT_PRESET_PREFIXES.some((prefix) => id.startsWith(prefix))
}

async function initializePresetKnowledge(force = false): Promise<void> {
  const [
    version,
    dismissed,
    subjectsValue,
    chaptersValue,
    cardsValue,
    statesValue,
    logsValue,
    reviewSession,
  ] = await Promise.all([
    getStorage<number>(STORAGE_KEYS.presetKnowledgeVersion),
    getStorage<boolean>(STORAGE_KEYS.presetKnowledgeDismissed),
    getStorage<Subject[]>(STORAGE_KEYS.subjects),
    getStorage<Chapter[]>(STORAGE_KEYS.chapters),
    getStorage<KnowledgeCard[]>(STORAGE_KEYS.cards),
    getStorage<ReviewState[]>(STORAGE_KEYS.reviewStates),
    getStorage<ReviewLog[]>(STORAGE_KEYS.reviewLogs),
    getStorage<ReviewSession>(STORAGE_KEYS.reviewSession),
  ])

  const subjects = subjectsValue ?? []
  const chapters = chaptersValue ?? []
  const cards = cardsValue ?? []
  const states = statesValue ?? []
  const logs = logsValue ?? []
  if (dismissed && !force) return

  // Seedance is first because it is the default selection. The operating-system
  // library remains bundled as a separate subject for multi-library testing.
  const seedancePreset = buildSeedancePresetKnowledgeData()
  const operatingSystemPreset = buildPresetKnowledgeData()
  const presetSubjects = [seedancePreset.subject, operatingSystemPreset.subject]
  const presetChapters = [...seedancePreset.chapters, ...operatingSystemPreset.chapters]
  const presetCards = [...seedancePreset.cards, ...operatingSystemPreset.cards]

  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]))
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]))
  const cardById = new Map(cards.map((card) => [card.id, card]))
  const hasLegacyPresetData = [...subjects, ...chapters, ...cards].some((item) =>
    LEGACY_PRESET_ID_PREFIXES.some((prefix) => item.id.startsWith(prefix)),
  )
  const hasAllCurrentPresetIds =
    presetSubjects.every((subject) => subjectById.has(subject.id)) &&
    presetChapters.every((chapter) => chapterById.has(chapter.id)) &&
    presetCards.every((card) => cardById.has(card.id))
  const presetContentChanged =
    presetSubjects.some((subject) => {
      const stored = subjectById.get(subject.id)
      return stored?.name !== subject.name || stored?.description !== subject.description
    }) ||
    presetChapters.some((chapter) => chapterById.get(chapter.id)?.name !== chapter.name) ||
    presetCards.some((card) => {
      const stored = cardById.get(card.id)
      return (
        stored?.question !== card.question ||
        stored?.answer !== card.answer ||
        stored?.chapterId !== card.chapterId ||
        stored?.sectionId !== card.sectionId ||
        stored?.sectionTitle !== card.sectionTitle ||
        stored?.parentCardId !== card.parentCardId
      )
    })

  const needsRefresh =
    force ||
    version !== PRESET_KNOWLEDGE_VERSION ||
    hasLegacyPresetData ||
    !hasAllCurrentPresetIds ||
    presetContentChanged

  if (!needsRefresh) {
    await setStorageBatch([
      {
        type: 'set',
        key: STORAGE_KEYS.presetKnowledgeVersion,
        value: PRESET_KNOWLEDGE_VERSION,
      },
      { type: 'set', key: STORAGE_KEYS.presetKnowledgeDismissed, value: false },
    ])
    return
  }

  const nextPresetSubjectIds = new Set(presetSubjects.map((subject) => subject.id))
  const nextPresetCardIds = new Set(presetCards.map((card) => card.id))
  const shouldKeepReviewForCard = (cardId: string): boolean => {
    if (LEGACY_PRESET_ID_PREFIXES.some((prefix) => cardId.startsWith(prefix))) return false
    if (isCurrentPresetId(cardId)) return nextPresetCardIds.has(cardId)
    return true
  }
  const userCards = cards
    .filter((card) => !isPresetKnowledgeId(card.id))
    .map((card) =>
      card.parentCardId &&
      isPresetKnowledgeId(card.parentCardId) &&
      !nextPresetCardIds.has(card.parentCardId)
        ? { ...card, parentCardId: undefined, updatedAt: Date.now() }
        : card,
    )

  const sessionBecameInvalid = Boolean(
    reviewSession &&
      ((reviewSession.filter.subjectId &&
        isPresetKnowledgeId(reviewSession.filter.subjectId) &&
        !nextPresetSubjectIds.has(reviewSession.filter.subjectId)) ||
        reviewSession.cardIds.some(
          (cardId) => isPresetKnowledgeId(cardId) && !nextPresetCardIds.has(cardId),
        ) ||
        (reviewSession.lastCommit &&
          isPresetKnowledgeId(reviewSession.lastCommit.cardId) &&
          !nextPresetCardIds.has(reviewSession.lastCommit.cardId))),
  )

  const mutations: StorageMutation[] = [
    {
      type: 'set',
      key: STORAGE_KEYS.subjects,
      value: [
        ...subjects.filter((subject) => !isPresetKnowledgeId(subject.id)),
        ...presetSubjects,
      ],
    },
    {
      type: 'set',
      key: STORAGE_KEYS.chapters,
      value: [
        ...chapters.filter((chapter) => !isPresetKnowledgeId(chapter.id)),
        ...presetChapters,
      ],
    },
    { type: 'set', key: STORAGE_KEYS.cards, value: [...userCards, ...presetCards] },
    {
      type: 'set',
      key: STORAGE_KEYS.reviewStates,
      value: states.filter((state) => shouldKeepReviewForCard(state.cardId)),
    },
    {
      type: 'set',
      key: STORAGE_KEYS.reviewLogs,
      value: logs.filter((log) => shouldKeepReviewForCard(log.cardId)),
    },
    { type: 'set', key: STORAGE_KEYS.presetKnowledgeVersion, value: PRESET_KNOWLEDGE_VERSION },
    { type: 'set', key: STORAGE_KEYS.presetKnowledgeDismissed, value: false },
  ]
  if (sessionBecameInvalid) {
    mutations.push({ type: 'remove', key: STORAGE_KEYS.reviewSession })
  }
  await setStorageBatch(mutations)
}

export function ensurePresetKnowledge(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = initializePresetKnowledge().finally(() => {
      initializationPromise = null
    })
  }
  return initializationPromise
}

export async function restorePresetKnowledge(): Promise<void> {
  if (initializationPromise) await initializationPromise
  initializationPromise = initializePresetKnowledge(true).finally(() => {
    initializationPromise = null
  })
  return initializationPromise
}
