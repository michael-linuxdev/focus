export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function todayISO(now = new Date()): string {
  return toISODate(now)
}

export function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

export function startOfISOWeek(date: Date): Date {
  const day = date.getDay()
  const delta = day === 0 ? -6 : 1 - day
  return addDays(date, delta)
}

export function previousWeekday(date: Date): Date {
  let cursor = addDays(date, -1)
  while (!isWeekday(cursor)) cursor = addDays(cursor, -1)
  return cursor
}

export function diffDays(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / 86_400_000)
}

export function isoWeekNumber(date: Date): number {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

export function weekStartOffset(today: Date, offset: number): string {
  return toISODate(addDays(startOfISOWeek(today), offset * 7))
}

export function eachDate(startIso: string, endIso: string): string[] {
  const dates: string[] = []
  for (let cursor = parseISODate(startIso); toISODate(cursor) <= endIso; cursor = addDays(cursor, 1)) {
    dates.push(toISODate(cursor))
  }
  return dates
}
