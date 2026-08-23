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

function isPresetId(id: string): boolean {
  return ALL_PRESET_PREFIXES.some((prefix) => id.startsWith(prefix))
}

async function initializePresetKnowledge(): Promise<void> {
  const [version, subjectsValue, chaptersValue, cardsValue, statesValue, logsValue] =
    await Promise.all([
    getStorage<number>(STORAGE_KEYS.presetKnowledgeVersion),
    getStorage<Subject[]>(STORAGE_KEYS.subjects),
    getStorage<Chapter[]>(STORAGE_KEYS.chapters),
    getStorage<KnowledgeCard[]>(STORAGE_KEYS.cards),
    getStorage<ReviewState[]>(STORAGE_KEYS.reviewStates),
    getStorage<ReviewLog[]>(STORAGE_KEYS.reviewLogs),
  ])

  if ((version ?? 0) >= PRESET_KNOWLEDGE_VERSION) return

  const subjects = subjectsValue ?? []
  const chapters = chaptersValue ?? []
  const cards = cardsValue ?? []
  const states = statesValue ?? []
  const logs = logsValue ?? []
  const hasPresetData =
    subjects.some((subject) => isPresetId(subject.id)) ||
    chapters.some((chapter) => isPresetId(chapter.id)) ||
    cards.some((card) => isPresetId(card.id))
  const hasUserKnowledge =
    subjects.some((subject) => !isPresetId(subject.id)) ||
    chapters.some((chapter) => !isPresetId(chapter.id)) ||
    cards.some((card) => !isPresetId(card.id))

  // Preserve the legacy behavior for a store containing only user data and no
  // evidence that a built-in preset was ever installed. Versioned installs are
  // migrated below, including those where the user manually emptied the preset.
  if ((version ?? 0) === 0 && hasUserKnowledge && !hasPresetData) {
    await setStorageBatch([
      {
        type: 'set',
        key: STORAGE_KEYS.presetKnowledgeVersion,
        value: PRESET_KNOWLEDGE_VERSION,
      },
    ])
    return
  }

  const preset = buildPresetKnowledgeData()
  const removedPresetCardIds = new Set(
    cards.filter((card) => isPresetId(card.id)).map((card) => card.id),
  )
  const userCards = cards
    .filter((card) => !isPresetId(card.id))
    .map((card) =>
      card.parentCardId &&
      (removedPresetCardIds.has(card.parentCardId) || isPresetId(card.parentCardId))
        ? { ...card, parentCardId: undefined, updatedAt: Date.now() }
        : card,
    )

  await setStorageBatch([
    {
      type: 'set',
      key: STORAGE_KEYS.subjects,
      value: [...subjects.filter((subject) => !isPresetId(subject.id)), preset.subject],
    },
    {
      type: 'set',
      key: STORAGE_KEYS.chapters,
      value: [...chapters.filter((chapter) => !isPresetId(chapter.id)), ...preset.chapters],
    },
    { type: 'set', key: STORAGE_KEYS.cards, value: [...userCards, ...preset.cards] },
    {
      type: 'set',
      key: STORAGE_KEYS.reviewStates,
      value: states.filter(
        (state) => !removedPresetCardIds.has(state.cardId) && !isPresetId(state.cardId),
      ),
    },
    {
      type: 'set',
      key: STORAGE_KEYS.reviewLogs,
      value: logs.filter(
        (log) => !removedPresetCardIds.has(log.cardId) && !isPresetId(log.cardId),
      ),
    },
    { type: 'remove', key: STORAGE_KEYS.reviewSession },
    { type: 'set', key: STORAGE_KEYS.presetKnowledgeVersion, value: PRESET_KNOWLEDGE_VERSION },
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
