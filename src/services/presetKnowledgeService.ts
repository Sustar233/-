import {
  buildPresetKnowledgeData,
  PRESET_ID_PREFIX,
  PRESET_KNOWLEDGE_VERSION,
} from '@/data/presetKnowledge'
import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage, setStorage } from '@/storage/storage'
import type { KnowledgeCard } from '@/types/card'
import type { Chapter, Subject } from '@/types/subject'

let initializationPromise: Promise<void> | null = null

function containsNonPresetData(items: Array<{ id: string }>): boolean {
  return items.some((item) => !item.id.startsWith(PRESET_ID_PREFIX))
}

async function initializePresetKnowledge(): Promise<void> {
  const [version, subjectsValue, chaptersValue, cardsValue] = await Promise.all([
    getStorage<number>(STORAGE_KEYS.presetKnowledgeVersion),
    getStorage<Subject[]>(STORAGE_KEYS.subjects),
    getStorage<Chapter[]>(STORAGE_KEYS.chapters),
    getStorage<KnowledgeCard[]>(STORAGE_KEYS.cards),
  ])

  if ((version ?? 0) >= PRESET_KNOWLEDGE_VERSION) return

  const subjects = subjectsValue ?? []
  const chapters = chaptersValue ?? []
  const cards = cardsValue ?? []
  const hasUserKnowledge =
    containsNonPresetData(subjects) ||
    containsNonPresetData(chapters) ||
    containsNonPresetData(cards)

  if (hasUserKnowledge) {
    await setStorage(STORAGE_KEYS.presetKnowledgeVersion, PRESET_KNOWLEDGE_VERSION)
    return
  }

  const preset = buildPresetKnowledgeData()
  await Promise.all([
    setStorage(STORAGE_KEYS.subjects, [preset.subject]),
    setStorage(STORAGE_KEYS.chapters, preset.chapters),
    setStorage(STORAGE_KEYS.cards, preset.cards),
  ])
  await setStorage(STORAGE_KEYS.presetKnowledgeVersion, PRESET_KNOWLEDGE_VERSION)
}

export function ensurePresetKnowledge(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = initializePresetKnowledge().finally(() => {
      initializationPromise = null
    })
  }
  return initializationPromise
}

