const DAY_MS = 24 * 60 * 60 * 1000

export function startOfDay(timestamp = Date.now()): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function addDays(timestamp: number, days: number): number {
  const date = new Date(timestamp)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export function isSameDay(first: number, second: number): boolean {
  return startOfDay(first) === startOfDay(second)
}

export function formatShortDate(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function formatInterval(from: number, to: number): string {
  const minutes = Math.max(1, Math.round((to - from) / 60_000))
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}小时`
  const days = Math.max(1, Math.round((to - from) / DAY_MS))
  if (days < 30) return `${days}天`
  const months = Math.round(days / 30)
  return `${months}个月`
}
