import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type JsonStorageRecord = Record<string, unknown>

export type JsonStorageMutation =
  | { type: 'set'; key: string; value: unknown }
  | { type: 'remove'; key: string }

export class JsonStorage {
  private statePromise: Promise<JsonStorageRecord> | null = null
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly filePath: string) {}

  async get(key: string): Promise<{ found: boolean; value?: unknown }> {
    await this.writeQueue.catch(() => undefined)
    const state = await this.load()
    if (!Object.prototype.hasOwnProperty.call(state, key)) return { found: false }
    return { found: true, value: state[key] }
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.enqueueWrite((state) => {
      state[key] = value
    })
  }

  async remove(key: string): Promise<void> {
    await this.enqueueWrite((state) => {
      delete state[key]
    })
  }

  async batch(mutations: JsonStorageMutation[]): Promise<void> {
    if (!mutations.length) return
    await this.enqueueWrite((state) => {
      for (const mutation of mutations) {
        if (mutation.type === 'set') state[mutation.key] = mutation.value
        else delete state[mutation.key]
      }
    })
  }

  private load(): Promise<JsonStorageRecord> {
    this.statePromise ??= this.readState()
    return this.statePromise
  }

  private async readState(): Promise<JsonStorageRecord> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('共享数据文件格式无效')
      }
      return parsed as JsonStorageRecord
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw error
    }
  }

  private enqueueWrite(mutate: (state: JsonStorageRecord) => void): Promise<void> {
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const state = await this.load()
      mutate(state)
      await mkdir(dirname(this.filePath), { recursive: true })
      const temporaryPath = `${this.filePath}.tmp`
      await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
      await rename(temporaryPath, this.filePath)
    })
    return this.writeQueue
  }
}
