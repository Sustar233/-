import {
  buildPresetKnowledgeData,
  LEGACY_PRESET_ID_PREFIXES,
  PRESET_ID_PREFIX,
  PRESET_KNOWLEDGE_VERSION,
} from '@/data/presetKnowledge'
import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage, setStorageBatch, type StorageMutation } from '@/storage/storage'
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
  const hasAllCurrentPresetIds =
    subjectIds.has(preset.subject.id) &&
    preset.chapters.every((chapter) => chapterIds.has(chapter.id)) &&
    preset.cards.every((card) => cardIds.has(card.id))

  // Refresh preset content in place when its structure changes. Card IDs stay
  // stable, so review states and logs remain valid across the migration.
  if (hasAllCurrentPresetIds && !hasLegacyPresetData) {
    const mutations: StorageMutation[] = [
      {
        type: 'set',
        key: STORAGE_KEYS.presetKnowledgeVersion,
        value: PRESET_KNOWLEDGE_VERSION,
      },
      { type: 'set', key: STORAGE_KEYS.presetKnowledgeDismissed, value: false },
    ]
    const presetNeedsRefresh =
      version !== PRESET_KNOWLEDGE_VERSION ||
      preset.cards.some((presetCard) => {
        const storedCard = cards.find((card) => card.id === presetCard.id)
        return (
          storedCard?.sectionId !== presetCard.sectionId ||
          storedCard?.sectionTitle !== presetCard.sectionTitle
        )
      })
    if (presetNeedsRefresh) {
      mutations.push(
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
        {
          type: 'set',
          key: STORAGE_KEYS.cards,
          value: [...cards.filter((card) => !isPresetKnowledgeId(card.id)), ...preset.cards],
        },
        { type: 'remove', key: STORAGE_KEYS.reviewSession },
      )
    }
    await setStorageBatch(mutations)
    return
  }

  const removedPresetCardIds = new Set(
    cards.filter((card) => isPresetKnowledgeId(card.id)).map((card) => card.id),
  )
  const nextPresetCardIds = new Set(preset.cards.map((card) => card.id))
  const shouldKeepReviewForCard = (cardId: string): boolean => {
    if (LEGACY_PRESET_ID_PREFIXES.some((prefix) => cardId.startsWith(prefix))) return false
    if (cardId.startsWith(PRESET_ID_PREFIX)) return nextPresetCardIds.has(cardId)
    return true
  }
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
      value: states.filter((state) => shouldKeepReviewForCard(state.cardId)),
    },
    {
      type: 'set',
      key: STORAGE_KEYS.reviewLogs,
      value: logs.filter((log) => shouldKeepReviewForCard(log.cardId)),
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
