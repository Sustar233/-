const memory = new Map<string, unknown>()

export function installStorageMock(): void {
  const mock = {
    getStorage(options: {
      key: string
      success?: (result: { data: unknown }) => void
      fail?: (error: { errMsg: string }) => void
    }) {
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
    }) {
      memory.set(options.key, options.data)
      options.success?.()
    },
    removeStorage(options: { key: string; success?: () => void }) {
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
}

export function readStored<T>(key: string): T | undefined {
  return memory.get(key) as T | undefined
}
