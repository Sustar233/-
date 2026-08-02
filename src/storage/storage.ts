// #ifdef H5
interface StorageResponse<T> {
  value: T
}

const API_PREFIX = '/api/storage/'

function usesLanStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.fetch === 'function'
}
// #endif

function getLocalStorage<T>(key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    uni.getStorage({
      key,
      success: (result) => resolve(result.data as T),
      fail: (error) => {
        const message = String((error as { errMsg?: string }).errMsg ?? '')
        if (message.includes('data not found')) {
          resolve(null)
          return
        }
        reject(error)
      },
    })
  })
}

function setLocalStorage<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    uni.setStorage({
      key,
      data: value,
      success: () => resolve(),
      fail: reject,
    })
  })
}

function removeLocalStorage(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    uni.removeStorage({
      key,
      success: () => resolve(),
      fail: reject,
    })
  })
}

// #ifdef H5
function storageUrl(key: string): string {
  return `${API_PREFIX}${encodeURIComponent(key)}`
}

async function requestStorage<T>(key: string): Promise<T | null> {
  const response = await window.fetch(storageUrl(key))
  if (response.status === 404) return null
  if (!response.ok) throw new Error('无法读取局域网共享数据，请确认电脑端服务仍在运行')
  return ((await response.json()) as StorageResponse<T>).value
}

async function writeStorage<T>(key: string, value: T): Promise<void> {
  const response = await window.fetch(storageUrl(key), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!response.ok) throw new Error('无法保存到局域网共享数据，请确认电脑端服务仍在运行')
}

async function deleteStorage(key: string): Promise<void> {
  const response = await window.fetch(storageUrl(key), { method: 'DELETE' })
  if (!response.ok) throw new Error('无法删除局域网共享数据，请确认电脑端服务仍在运行')
}
// #endif

export async function getStorage<T>(key: string): Promise<T | null> {
  // #ifdef H5
  if (usesLanStorage()) {
    const sharedValue = await requestStorage<T>(key)
    if (sharedValue !== null) return sharedValue

    // Migrate data created before LAN sharing was enabled. Each key is copied only
    // when the shared store is empty, so an existing shared value is never replaced.
    const localValue = await getLocalStorage<T>(key)
    if (localValue === null) return null
    await writeStorage(key, localValue)
    return localValue
  }
  // #endif

  return getLocalStorage<T>(key)
}

export async function setStorage<T>(key: string, value: T): Promise<void> {
  // #ifdef H5
  if (usesLanStorage()) return writeStorage(key, value)
  // #endif

  return setLocalStorage(key, value)
}

export async function removeStorage(key: string): Promise<void> {
  // #ifdef H5
  if (usesLanStorage()) return deleteStorage(key)
  // #endif

  return removeLocalStorage(key)
}
