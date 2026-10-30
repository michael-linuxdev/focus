import { parseISODate } from "@/lib/dates"

const shortDay = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" })
const longDay = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
})
const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "long" })
const weekdayShort = new Intl.DateTimeFormat("de-DE", { weekday: "short" })
const monthShort = new Intl.DateTimeFormat("de-DE", { month: "short" })
const percentFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 })

export function formatPercent(value: number): string {
  return percentFormat.format(Math.round(value))
}

export function formatMinutes(minutes: number): string {
  const rounded = Math.round(Math.abs(minutes))
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} h`
  return `${hours} h ${rest} min`
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: hours < 10 ? 1 : 0,
    maximumFractionDigits: 1,
  }).format(hours)
}

export function formatLongDate(iso: string): string {
  return longDay.format(parseISODate(iso))
}

export function formatWeekday(iso: string): string {
  return weekday.format(parseISODate(iso))
}

export function formatWeekdayShort(iso: string): string {
  return weekdayShort.format(parseISODate(iso)).replace(".", "")
}

export function formatMonthShort(iso: string): string {
  return monthShort.format(parseISODate(iso)).replace(".", "")
}

export function formatShortDay(iso: string): string {
  const date = parseISODate(iso)
  return `${date.getDate()}.${date.getMonth() + 1}.`
}

export function formatWeekRange(startIso: string, endIso: string): string {
  const start = parseISODate(startIso)
  const end = parseISODate(endIso)
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    const month = monthShort.format(start).replace(".", "")
    return `${start.getDate()}.–${end.getDate()}. ${month}`
  }
  return `${shortDay.format(start).replace(".", "")} – ${shortDay.format(end).replace(".", "")}`
}

export function formatTimeRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  return `${start}–${end}`
}

export function punkteLabel(points: number): string {
  const value = Math.abs(Math.round(points))
  return value === 1 ? "1 Punkt" : `${value} Punkte`
}
