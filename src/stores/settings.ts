import { defineStore } from 'pinia'
import { ref } from 'vue'
import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage, setStorage } from '@/storage/storage'
import type { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/types/settings'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })

  async function load(): Promise<void> {
    settings.value = (await getStorage<Settings>(STORAGE_KEYS.settings)) ?? { ...DEFAULT_SETTINGS }
  }

  async function setDailyNewCards(value: number): Promise<void> {
    const dailyNewCards = Math.min(200, Math.max(0, Math.round(value)))
    settings.value = { ...settings.value, dailyNewCards }
    await setStorage(STORAGE_KEYS.settings, settings.value)
  }

  return { settings, load, setDailyNewCards }
})
