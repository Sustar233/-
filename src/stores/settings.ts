import { defineStore } from 'pinia'
import { ref } from 'vue'
import { STORAGE_KEYS } from '@/storage/keys'
import { getStorage, setStorage } from '@/storage/storage'
import type { Settings } from '@/types/settings'
import { DEFAULT_SETTINGS, normalizeSettings } from '@/types/settings'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })

  async function load(): Promise<void> {
    settings.value = normalizeSettings(await getStorage<Settings>(STORAGE_KEYS.settings))
  }

  async function setDailyNewCards(value: number): Promise<void> {
    settings.value = normalizeSettings({ ...settings.value, dailyNewCards: value })
    await setStorage(STORAGE_KEYS.settings, settings.value)
  }

  async function setFsrsPreferences(desiredRetention: number, enableFuzz: boolean): Promise<void> {
    settings.value = normalizeSettings({ ...settings.value, desiredRetention, enableFuzz })
    await setStorage(STORAGE_KEYS.settings, settings.value)
  }

  return { settings, load, setDailyNewCards, setFsrsPreferences }
})
