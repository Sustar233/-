import {
  buildPresetKnowledgeData,
  LEGACY_PRESET_ID_PREFIXES,
  PRESET_ID_PREFIX,
  PRESET_KNOWLEDGE_VERSION,
} from '@/data/presetKnowledge'
import {
  buildComputerSystemPrinciplesPresetKnowledgeData,
  COMPUTER_SYSTEM_PRESET_ID_PREFIX,
  COMPUTER_SYSTEM_PRESET_INTRODUCED_VERSION,
} from '@/data/computerSystemPrinciplesPresetKnowledge'
import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage, setStorageBatch, type StorageMutation } from '@/storage/storage'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewLog, ReviewSession, ReviewState } from '@/types/review'
import type { Chapter, Subject } from '@/types/subject'

let initializationPromise: Promise<void> | null = null

const CURRENT_PRESET_PREFIXES = [
  PRESET_ID_PREFIX,
  COMPUTER_SYSTEM_PRESET_ID_PREFIX,
] as const
const ALL_PRESET_PREFIXES = [...CURRENT_PRESET_PREFIXES, ...LEGACY_PRESET_ID_PREFIXES]

export function isPresetKnowledgeId(id: string): boolean {
  return ALL_PRESET_PREFIXES.some((prefix) => id.startsWith(prefix))
}

function isLegacyPresetId(id: string): boolean {
  return LEGACY_PRESET_ID_PREFIXES.some((prefix) => id.startsWith(prefix))
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
  const legacySubjectIds = new Set(
    subjects.filter((subject) => isLegacyPresetId(subject.id)).map((subject) => subject.id),
  )
  const legacyChapterIds = new Set(
    chapters
      .filter(
        (chapter) =>
          isLegacyPresetId(chapter.id) ||
          isLegacyPresetId(chapter.subjectId) ||
          legacySubjectIds.has(chapter.subjectId),
      )
      .map((chapter) => chapter.id),
  )
  const legacyCardIds = new Set(
    cards
      .filter(
        (card) =>
          isLegacyPresetId(card.id) ||
          isLegacyPresetId(card.subjectId) ||
          legacySubjectIds.has(card.subjectId) ||
          Boolean(card.chapterId && legacyChapterIds.has(card.chapterId)),
      )
      .map((card) => card.id),
  )
  const hasLegacyPresetData =
    legacySubjectIds.size > 0 || legacyChapterIds.size > 0 || legacyCardIds.size > 0

  const operatingSystemPreset = buildPresetKnowledgeData()
  const computerSystemPreset = buildComputerSystemPrinciplesPresetKnowledgeData()
  const currentPresets = [operatingSystemPreset, computerSystemPreset]
  const presetSubjects = currentPresets.map((preset) => preset.subject)
  const presetChapters = currentPresets.flatMap((preset) => preset.chapters)
  const presetCards = currentPresets.flatMap((preset) => preset.cards)

  if (dismissed && !force) {
    const shouldIntroduceComputerSystemPreset =
      version != null && version < COMPUTER_SYSTEM_PRESET_INTRODUCED_VERSION
    if (!hasLegacyPresetData && !shouldIntroduceComputerSystemPreset) return

    const shouldRemoveDuringMigration = (id: string): boolean =>
      isLegacyPresetId(id) ||
      (shouldIntroduceComputerSystemPreset &&
        id.startsWith(COMPUTER_SYSTEM_PRESET_ID_PREFIX))
    const introducedSubjects = shouldIntroduceComputerSystemPreset
      ? [computerSystemPreset.subject]
      : []
    const introducedChapters = shouldIntroduceComputerSystemPreset
      ? computerSystemPreset.chapters
      : []
    const introducedCards = shouldIntroduceComputerSystemPreset
      ? computerSystemPreset.cards
      : []

    const remainingSubjectIds = new Set(
      [
        ...subjects.filter((subject) => !shouldRemoveDuringMigration(subject.id)),
        ...introducedSubjects,
      ].map((subject) => subject.id),
    )
    const remainingCards = [
      ...cards.filter(
        (card) =>
          !shouldRemoveDuringMigration(card.id) &&
          !shouldRemoveDuringMigration(card.subjectId) &&
          remainingSubjectIds.has(card.subjectId),
      ),
      ...introducedCards,
    ]
      .map((card) =>
        card.parentCardId && shouldRemoveDuringMigration(card.parentCardId)
          ? { ...card, parentCardId: undefined, updatedAt: Date.now() }
          : card,
      )
    const remainingCardIds = new Set(remainingCards.map((card) => card.id))
    const sessionBecameInvalid = Boolean(
      reviewSession &&
        ((reviewSession.filter.subjectId &&
          !remainingSubjectIds.has(reviewSession.filter.subjectId)) ||
          reviewSession.cardIds.some((cardId) => !remainingCardIds.has(cardId)) ||
          (reviewSession.lastCommit &&
            !remainingCardIds.has(reviewSession.lastCommit.cardId))),
    )
    const mutations: StorageMutation[] = [
      {
        type: 'set',
        key: STORAGE_KEYS.subjects,
        value: [
          ...subjects.filter((subject) => !shouldRemoveDuringMigration(subject.id)),
          ...introducedSubjects,
        ],
      },
      {
        type: 'set',
        key: STORAGE_KEYS.chapters,
        value: [
          ...chapters.filter(
            (chapter) =>
              !shouldRemoveDuringMigration(chapter.id) &&
              !shouldRemoveDuringMigration(chapter.subjectId) &&
              remainingSubjectIds.has(chapter.subjectId),
          ),
          ...introducedChapters,
        ],
      },
      { type: 'set', key: STORAGE_KEYS.cards, value: remainingCards },
      {
        type: 'set',
        key: STORAGE_KEYS.reviewStates,
        value: states.filter((state) => remainingCardIds.has(state.cardId)),
      },
      {
        type: 'set',
        key: STORAGE_KEYS.reviewLogs,
        value: logs.filter((log) => remainingCardIds.has(log.cardId)),
      },
      { type: 'set', key: STORAGE_KEYS.presetKnowledgeVersion, value: PRESET_KNOWLEDGE_VERSION },
    ]
    if (sessionBecameInvalid) {
      mutations.push({ type: 'remove', key: STORAGE_KEYS.reviewSession })
    }
    await setStorageBatch(mutations)
    return
  }

  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]))
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]))
  const cardById = new Map(cards.map((card) => [card.id, card]))
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
        stored?.parentCardId !== card.parentCardId ||
        stored?.connection !== card.connection ||
        stored?.note !== card.note
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
  const finalSubjectIds = new Set([
    ...subjects
      .filter((subject) => !isPresetKnowledgeId(subject.id))
      .map((subject) => subject.id),
    ...nextPresetSubjectIds,
  ])
  const userCards = cards
    .filter(
      (card) => !isPresetKnowledgeId(card.id) && !legacySubjectIds.has(card.subjectId),
    )
    .map((card) =>
      card.parentCardId &&
      isPresetKnowledgeId(card.parentCardId) &&
      !nextPresetCardIds.has(card.parentCardId)
        ? { ...card, parentCardId: undefined, updatedAt: Date.now() }
        : card,
    )
  const finalCardIds = new Set([...userCards, ...presetCards].map((card) => card.id))

  const sessionBecameInvalid = Boolean(
    reviewSession &&
      ((reviewSession.filter.subjectId &&
        !finalSubjectIds.has(reviewSession.filter.subjectId)) ||
        reviewSession.cardIds.some((cardId) => !finalCardIds.has(cardId)) ||
        (reviewSession.lastCommit &&
          !finalCardIds.has(reviewSession.lastCommit.cardId))),
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
      value: states.filter((state) => finalCardIds.has(state.cardId)),
    },
    {
      type: 'set',
      key: STORAGE_KEYS.reviewLogs,
      value: logs.filter((log) => finalCardIds.has(log.cardId)),
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
