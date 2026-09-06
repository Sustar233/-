import { ref } from 'vue'

/** Serialize page mutations and surface errors from both Error and uni-app APIs. */
export function useAsyncAction() {
  const running = ref(false)

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    if (running.value) return false
    running.value = true
    try {
      await action()
      return true
    } catch (error) {
      const detail = error as { message?: string; errMsg?: string } | null
      uni.showToast({ title: detail?.message || detail?.errMsg || '操作失败，请重试', icon: 'none' })
      return false
    } finally {
      running.value = false
    }
  }

  return { running, run }
}
