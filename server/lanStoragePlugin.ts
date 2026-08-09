import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { JsonStorage, type JsonStorageMutation } from './jsonStorage'

const API_PREFIX = '/api/storage/'
const MAX_BODY_BYTES = 10 * 1024 * 1024

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求内容过大'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('JSON 格式无效'))
      }
    })
    request.on('error', reject)
  })
}

function isAllowedKey(key: string): boolean {
  return key.startsWith('recalllab:') && key.length <= 100
}

function parseBatchMutations(value: unknown): JsonStorageMutation[] | null {
  if (!value || typeof value !== 'object') return null
  const mutations = (value as { mutations?: unknown }).mutations
  if (!Array.isArray(mutations) || mutations.length > 100) return null

  const parsed: JsonStorageMutation[] = []
  for (const mutation of mutations) {
    if (!mutation || typeof mutation !== 'object') return null
    const candidate = mutation as Record<string, unknown>
    if (typeof candidate.key !== 'string' || !isAllowedKey(candidate.key)) return null
    if (candidate.type === 'remove') {
      parsed.push({ type: 'remove', key: candidate.key })
      continue
    }
    if (candidate.type !== 'set' || !Object.prototype.hasOwnProperty.call(candidate, 'value')) {
      return null
    }
    parsed.push({ type: 'set', key: candidate.key, value: candidate.value })
  }
  return parsed
}

export function lanStoragePlugin(): Plugin {
  const storage = new JsonStorage(resolve(process.cwd(), '.recalllab-data', 'storage.json'))

  return {
    name: 'recalllab-lan-storage',
    enforce: 'pre',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://recalllab.local')
        if (url.pathname === '/api/health') {
          sendJson(response, 200, { ok: true })
          return
        }
        if (!url.pathname.startsWith(API_PREFIX)) {
          next()
          return
        }

        if (url.pathname === `${API_PREFIX}batch`) {
          if (request.method !== 'POST') {
            response.setHeader('Allow', 'POST')
            sendJson(response, 405, { error: '不支持的请求方法' })
            return
          }
          try {
            const mutations = parseBatchMutations(await readJsonBody(request))
            if (!mutations) {
              sendJson(response, 400, { error: '批量写入格式无效' })
              return
            }
            await storage.batch(mutations)
            sendJson(response, 200, { ok: true })
          } catch (error) {
            console.error('[RecallLab shared storage batch]', error)
            sendJson(response, 500, { error: '共享数据批量写入失败' })
          }
          return
        }

        let key: string
        try {
          key = decodeURIComponent(url.pathname.slice(API_PREFIX.length))
        } catch {
          sendJson(response, 400, { error: '存储键格式无效' })
          return
        }
        if (!isAllowedKey(key)) {
          sendJson(response, 400, { error: '不允许的存储键' })
          return
        }

        try {
          if (request.method === 'GET') {
            const result = await storage.get(key)
            sendJson(response, result.found ? 200 : 404, result.found ? { value: result.value } : { error: '未找到' })
            return
          }
          if (request.method === 'PUT') {
            const body = await readJsonBody(request)
            if (!body || typeof body !== 'object' || !Object.prototype.hasOwnProperty.call(body, 'value')) {
              sendJson(response, 400, { error: '缺少 value' })
              return
            }
            await storage.set(key, (body as { value: unknown }).value)
            sendJson(response, 200, { ok: true })
            return
          }
          if (request.method === 'DELETE') {
            await storage.remove(key)
            sendJson(response, 200, { ok: true })
            return
          }
          response.setHeader('Allow', 'GET, PUT, DELETE')
          sendJson(response, 405, { error: '不支持的请求方法' })
        } catch (error) {
          console.error('[RecallLab shared storage]', error)
          sendJson(response, 500, { error: '共享数据读写失败' })
        }
      })
    },
  }
}
