export type StorageMutation =
  | { type: 'set'; key: string; value: unknown }
  | { type: 'remove'; key: string }

interface PendingStorageTransaction {
  version: 1
  mutations: StorageMutation[]
}

const PENDING_TRANSACTION_KEY = 'recalllab:pendingTransaction'
let localOperationQueue: Promise<void> = Promise.resolve()

export function shouldUseLanStorage(isDevelopment: boolean, hasFetch: boolean): boolean {
  return isDevelopment && hasFetch
}

// #ifdef H5
interface StorageResponse<T> {
  value: T
}

const API_PREFIX = '/api/storage/'
const LAN_STORAGE_DEVELOPMENT = import.meta.env?.DEV === true

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

function isStorageMutation(value: unknown): value is StorageMutation {
  if (!value || typeof value !== 'object') return false
  const mutation = value as Record<string, unknown>
  if (typeof mutation.key !== 'string') return false
  if (mutation.type === 'remove') return true
  return mutation.type === 'set' && Object.prototype.hasOwnProperty.call(mutation, 'value')
}

function compactStorageMutations(mutations: StorageMutation[]): StorageMutation[] {
  const latestByKey = new Map<string, StorageMutation>()
  for (const mutation of mutations) {
    if (!mutation.key || mutation.key === PENDING_TRANSACTION_KEY) {
      throw new Error('存储事务包含无效键')
    }
    latestByKey.set(mutation.key, mutation)
  }
  return [...latestByKey.values()]
}

async function applyLocalMutations(mutations: StorageMutation[]): Promise<void> {
  for (const mutation of mutations) {
    if (mutation.type === 'set') await setLocalStorage(mutation.key, mutation.value)
    else await removeLocalStorage(mutation.key)
  }
}

async function recoverLocalTransaction(): Promise<void> {
  const pending = await getLocalStorage<PendingStorageTransaction>(PENDING_TRANSACTION_KEY)
  if (!pending) return
  if (
    pending.version !== 1 ||
    !Array.isArray(pending.mutations) ||
    !pending.mutations.every(isStorageMutation)
  ) {
    throw new Error('本地存储事务恢复记录已损坏，请先导出或恢复备份')
  }
  await applyLocalMutations(compactStorageMutations(pending.mutations))
  await removeLocalStorage(PENDING_TRANSACTION_KEY)
}

function runLocalExclusive<T>(operation: () => Promise<T>): Promise<T> {
  const result = localOperationQueue.catch(() => undefined).then(operation)
  localOperationQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
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

async function writeStorageBatch(mutations: StorageMutation[]): Promise<void> {
  const response = await window.fetch(`${API_PREFIX}batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mutations }),
  })
  if (!response.ok) throw new Error('无法批量保存局域网共享数据，请确认电脑端服务仍在运行')
}
// #endif

export async function getStorage<T>(key: string): Promise<T | null> {
  // #ifdef H5
  if (LAN_STORAGE_DEVELOPMENT && usesLanStorage()) {
    const sharedValue = await requestStorage<T>(key)
    if (sharedValue !== null) return sharedValue

    // Migrate data created before LAN sharing was enabled. Each key is copied only
    // when the shared store is empty, so an existing shared value is never replaced.
    const localValue = await runLocalExclusive(async () => {
      await recoverLocalTransaction()
      return getLocalStorage<T>(key)
    })
    if (localValue === null) return null
    await writeStorage(key, localValue)
    return localValue
  }
  // #endif

  return runLocalExclusive(async () => {
    await recoverLocalTransaction()
    return getLocalStorage<T>(key)
  })
}

export async function setStorage<T>(key: string, value: T): Promise<void> {
  // #ifdef H5
  if (LAN_STORAGE_DEVELOPMENT && usesLanStorage()) return writeStorage(key, value)
  // #endif

  return runLocalExclusive(async () => {
    await recoverLocalTransaction()
    return setLocalStorage(key, value)
  })
}

export async function removeStorage(key: string): Promise<void> {
  // #ifdef H5
  if (LAN_STORAGE_DEVELOPMENT && usesLanStorage()) return deleteStorage(key)
  // #endif

  return runLocalExclusive(async () => {
    await recoverLocalTransaction()
    return removeLocalStorage(key)
  })
}

export async function setStorageBatch(mutations: StorageMutation[]): Promise<void> {
  const compacted = compactStorageMutations(mutations)
  if (!compacted.length) return

  // #ifdef H5
  if (LAN_STORAGE_DEVELOPMENT && usesLanStorage()) return writeStorageBatch(compacted)
  // #endif

  return runLocalExclusive(async () => {
    await recoverLocalTransaction()
    const transaction: PendingStorageTransaction = { version: 1, mutations: compacted }
    await setLocalStorage(PENDING_TRANSACTION_KEY, transaction)
    await applyLocalMutations(compacted)
    await removeLocalStorage(PENDING_TRANSACTION_KEY)
  })
}
