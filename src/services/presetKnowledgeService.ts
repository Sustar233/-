import {
  buildPresetKnowledgeData,
  LEGACY_PRESET_ID_PREFIXES,
  PRESET_ID_PREFIX,
  PRESET_KNOWLEDGE_VERSION,
} from '@/data/presetKnowledge'
import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage, setStorageBatch } from '@/storage/storage'
import type { KnowledgeCard } from '@/types/card'
import type { ReviewLog, ReviewState } from '@/types/review'
import type { Chapter, Subject } from '@/types/subject'

let initializationPromise: Promise<void> | null = null

const ALL_PRESET_PREFIXES = [PRESET_ID_PREFIX, ...LEGACY_PRESET_ID_PREFIXES]

export function isPresetKnowledgeId(id: string): boolean {
  return ALL_PRESET_PREFIXES.some((prefix) => id.startsWith(prefix))
}

async function initializePresetKnowledge(force = false): Promise<void> {
  const [version, dismissed, subjectsValue, chaptersValue, cardsValue, statesValue, logsValue] =
    await Promise.all([
    getStorage<number>(STORAGE_KEYS.presetKnowledgeVersion),
    getStorage<boolean>(STORAGE_KEYS.presetKnowledgeDismissed),
    getStorage<Subject[]>(STORAGE_KEYS.subjects),
    getStorage<Chapter[]>(STORAGE_KEYS.chapters),
    getStorage<KnowledgeCard[]>(STORAGE_KEYS.cards),
    getStorage<ReviewState[]>(STORAGE_KEYS.reviewStates),
    getStorage<ReviewLog[]>(STORAGE_KEYS.reviewLogs),
  ])

  const subjects = subjectsValue ?? []
  const chapters = chaptersValue ?? []
  const cards = cardsValue ?? []
  const states = statesValue ?? []
  const logs = logsValue ?? []
  if (dismissed && !force) return

  const preset = buildPresetKnowledgeData()
  const hasLegacyPresetData = [...subjects, ...chapters, ...cards].some((item) =>
    LEGACY_PRESET_ID_PREFIXES.some((prefix) => item.id.startsWith(prefix)),
  )
  const subjectIds = new Set(subjects.map((subject) => subject.id))
  const chapterIds = new Set(chapters.map((chapter) => chapter.id))
  const cardIds = new Set(cards.map((card) => card.id))
  const hasCompleteCurrentPreset =
    subjectIds.has(preset.subject.id) &&
    preset.chapters.every((chapter) => chapterIds.has(chapter.id)) &&
    preset.cards.every((card) => cardIds.has(card.id))

  // The version-4 migration repairs WeChat stores that were incorrectly marked
  // as initialized without receiving the preset. A complete preset only needs
  // the marker update, so its learning progress remains untouched.
  if (hasCompleteCurrentPreset && !hasLegacyPresetData) {
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

  const removedPresetCardIds = new Set(
    cards.filter((card) => isPresetKnowledgeId(card.id)).map((card) => card.id),
  )
  const userCards = cards
    .filter((card) => !isPresetKnowledgeId(card.id))
    .map((card) =>
      card.parentCardId &&
      (removedPresetCardIds.has(card.parentCardId) || isPresetKnowledgeId(card.parentCardId))
        ? { ...card, parentCardId: undefined, updatedAt: Date.now() }
        : card,
    )

  await setStorageBatch([
    {
      type: 'set',
      key: STORAGE_KEYS.subjects,
      value: [
        ...subjects.filter((subject) => !isPresetKnowledgeId(subject.id)),
        preset.subject,
      ],
    },
    {
      type: 'set',
      key: STORAGE_KEYS.chapters,
      value: [
        ...chapters.filter((chapter) => !isPresetKnowledgeId(chapter.id)),
        ...preset.chapters,
      ],
    },
    { type: 'set', key: STORAGE_KEYS.cards, value: [...userCards, ...preset.cards] },
    {
      type: 'set',
      key: STORAGE_KEYS.reviewStates,
      value: states.filter(
        (state) =>
          !removedPresetCardIds.has(state.cardId) && !isPresetKnowledgeId(state.cardId),
      ),
    },
    {
      type: 'set',
      key: STORAGE_KEYS.reviewLogs,
      value: logs.filter(
        (log) => !removedPresetCardIds.has(log.cardId) && !isPresetKnowledgeId(log.cardId),
      ),
    },
    { type: 'remove', key: STORAGE_KEYS.reviewSession },
    { type: 'set', key: STORAGE_KEYS.presetKnowledgeVersion, value: PRESET_KNOWLEDGE_VERSION },
    { type: 'set', key: STORAGE_KEYS.presetKnowledgeDismissed, value: false },
  ])
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
