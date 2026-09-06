const memory = new Map<string, unknown>()
const pendingSetFailures = new Map<string, number>()
const operations: Array<{ type: 'get' | 'set' | 'remove'; key: string }> = []

export function storageOperations() {
  return [...operations]
}

export function installStorageMock(): void {
  const mock = {
    getStorage(options: {
      key: string
      success?: (result: { data: unknown }) => void
      fail?: (error: { errMsg: string }) => void
    }) {
      operations.push({ type: 'get', key: options.key })
      if (memory.has(options.key)) {
        options.success?.({ data: memory.get(options.key) })
      } else {
        options.fail?.({ errMsg: 'getStorage:fail data not found' })
      }
    },
    setStorage(options: {
      key: string
      data: unknown
      success?: () => void
      fail?: (error: { errMsg: string }) => void
    }) {
      const failures = pendingSetFailures.get(options.key) ?? 0
      operations.push({ type: 'set', key: options.key })
      if (failures > 0) {
        pendingSetFailures.set(options.key, failures - 1)
        options.fail?.({ errMsg: 'setStorage:fail simulated write error' })
        return
      }
      memory.set(options.key, options.data)
      options.success?.()
    },
    removeStorage(options: { key: string; success?: () => void }) {
      operations.push({ type: 'remove', key: options.key })
      memory.delete(options.key)
      options.success?.()
    },
  }
  Object.defineProperty(globalThis, 'uni', {
    value: mock,
    configurable: true,
    writable: true,
  })
}

export function resetStorage(): void {
  memory.clear()
  pendingSetFailures.clear()
  operations.length = 0
}

export function readStored<T>(key: string): T | undefined {
  return memory.get(key) as T | undefined
}

export function failNextSet(key: string, times = 1): void {
  pendingSetFailures.set(key, times)
}
