import type { ReviewFilter } from '@/types/review'

type Query = Record<string, unknown> | undefined

function queryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0] == null ? undefined : String(value[0])
  return value == null || value === '' ? undefined : String(value)
}

export function reviewFilterFromQuery(query: Query): ReviewFilter {
  return {
    subjectId: queryValue(query?.subjectId),
    chapterId: queryValue(query?.chapterId),
    uncategorizedOnly: queryValue(query?.uncategorized) === '1' || undefined,
    tag: queryValue(query?.tag),
  }
}

export function reviewRoute(filter: ReviewFilter = {}, fresh = false): string {
  const parts: string[] = []
  if (fresh) parts.push('fresh=1')
  if (filter.subjectId) parts.push(`subjectId=${encodeURIComponent(filter.subjectId)}`)
  if (filter.chapterId) parts.push(`chapterId=${encodeURIComponent(filter.chapterId)}`)
  if (filter.uncategorizedOnly) parts.push('uncategorized=1')
  if (filter.tag) parts.push(`tag=${encodeURIComponent(filter.tag)}`)
  return `/pages/review/index${parts.length ? `?${parts.join('&')}` : ''}`
}
