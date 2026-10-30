import { addDays, diffDays, eachDate, isWeekday, parseISODate, previousWeekday, toISODate } from "@/lib/dates"
import { formatMinutes, formatPercent, formatWeekday } from "@/lib/format"
import type { Category, TimeBlock } from "@/lib/types"
import { DEEP_WORK_BEFORE } from "@/lib/types"

export interface DayTotals {
  strategic: number
  operational: number
}

export interface RangeSummary {
  strategicMinutes: number
  operationalMinutes: number
  totalMinutes: number
  percent: number | null
  strategicCount: number
  operationalCount: number
  longestStrategic: TimeBlock | null
  byDay: Record<string, DayTotals>
}

export interface WeekBucket {
  weekStart: string
  weekEnd: string
  label: string
  strategicMinutes: number
  operationalMinutes: number
  totalMinutes: number
  percent: number | null
}

export interface DayShare {
  date: string
  strategic: number
  operational: number
  total: number
  percent: number
}

export function blocksInRange(blocks: TimeBlock[], startIso: string, endIso: string): TimeBlock[] {
  return blocks.filter((block) => block.date >= startIso && block.date <= endIso)
}

export function summarize(blocks: TimeBlock[], startIso: string, endIso: string): RangeSummary {
  const byDay: Record<string, DayTotals> = {}
  let strategicMinutes = 0
  let operationalMinutes = 0
  let strategicCount = 0
  let operationalCount = 0
  let longestStrategic: TimeBlock | null = null

  for (const block of blocksInRange(blocks, startIso, endIso)) {
    const day = byDay[block.date] ?? { strategic: 0, operational: 0 }
    if (block.category === "strategic") {
      strategicMinutes += block.durationMinutes
      strategicCount += 1
      day.strategic += block.durationMinutes
      if (!longestStrategic || block.durationMinutes > longestStrategic.durationMinutes) {
        longestStrategic = block
      }
    } else {
      operationalMinutes += block.durationMinutes
      operationalCount += 1
      day.operational += block.durationMinutes
    }
    byDay[block.date] = day
  }

  const totalMinutes = strategicMinutes + operationalMinutes
  return {
    strategicMinutes,
    operationalMinutes,
    totalMinutes,
    percent: totalMinutes === 0 ? null : (strategicMinutes / totalMinutes) * 100,
    strategicCount,
    operationalCount,
    longestStrategic,
    byDay,
  }
}

export function weekSeries(blocks: TimeBlock[], endWeekStart: string, count: number): WeekBucket[] {
  const end = parseISODate(endWeekStart)
  const buckets: WeekBucket[] = []
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = addDays(end, -7 * index)
    const startIso = toISODate(start)
    const endIso = toISODate(addDays(start, 6))
    const summary = summarize(blocks, startIso, endIso)
    buckets.push({
      weekStart: startIso,
      weekEnd: endIso,
      label: `${start.getDate()}.${start.getMonth() + 1}.`,
      strategicMinutes: summary.strategicMinutes,
      operationalMinutes: summary.operationalMinutes,
      totalMinutes: summary.totalMinutes,
      percent: summary.percent,
    })
  }
  return buckets
}

export function dayShares(summary: RangeSummary): DayShare[] {
  return Object.entries(summary.byDay)
    .map(([date, totals]) => {
      const total = totals.strategic + totals.operational
      return {
        date,
        strategic: totals.strategic,
        operational: totals.operational,
        total,
        percent: total === 0 ? 0 : (totals.strategic / total) * 100,
      }
    })
    .filter((day) => day.total > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function buildInsights(summary: RangeSummary, trend: WeekBucket[]): string[] {
  if (summary.percent === null) return []
  const lines: string[] = []
  const meaningful = trend.filter((week) => week.totalMinutes > 0)
  if (meaningful.length >= 4) {
    const strategic = meaningful.reduce((sum, week) => sum + week.strategicMinutes, 0)
    const total = meaningful.reduce((sum, week) => sum + week.totalMinutes, 0)
    const average = Math.round((strategic / total) * 100)
    lines.push(
      `Über ${meaningful.length} Wochen mit Einträgen sind es im gewichteten Schnitt ${formatPercent(average)} %.`,
    )
  }

  const days = dayShares(summary)
  if (days.length === 1) {
    const only = days[0]
    lines.push(
      `Bisher ein Tag mit Zeiten: ${formatWeekday(only.date)}, ${formatPercent(only.percent)} % strategisch.`,
    )
  } else if (days.length > 1) {
    const highest = [...days].sort((a, b) => b.percent - a.percent || b.strategic - a.strategic)[0]
    const lowest = [...days].sort((a, b) => a.percent - b.percent || a.strategic - b.strategic)[0]
    const most = [...days].sort((a, b) => b.strategic - a.strategic)[0]
    let sentence = `Am ${formatWeekday(highest.date)} war der Anteil mit ${formatPercent(highest.percent)} % am höchsten`
    if (lowest.date !== highest.date) {
      sentence += `, am ${formatWeekday(lowest.date)} mit ${formatPercent(lowest.percent)} % am niedrigsten`
    }
    sentence += "."
    if (most.date !== highest.date) {
      sentence += ` Die meiste strategische Zeit lag am ${formatWeekday(most.date)} (${formatMinutes(most.strategic)}).`
    }
    lines.push(sentence)
  }

  return lines.slice(0, 3)
}

export function weekdayStreak(doneDates: readonly string[], todayIso: string): { current: number; best: number } {
  const done = new Set(doneDates.filter((date) => date <= todayIso))
  if (done.size === 0) return { current: 0, best: 0 }

  let cursor = parseISODate(todayIso)
  if (!isWeekday(cursor) || !done.has(todayIso)) {
    cursor = previousWeekday(cursor)
  }

  let current = 0
  for (let guard = 0; guard < 500; guard += 1) {
    const iso = toISODate(cursor)
    if (!done.has(iso)) break
    current += 1
    cursor = previousWeekday(cursor)
  }

  const earliest = [...done].sort()[0]
  let best = 0
  let run = 0
  for (
    let date = parseISODate(earliest), guard = 0;
    toISODate(date) <= todayIso && guard < 800;
    date = addDays(date, 1), guard += 1
  ) {
    if (!isWeekday(date)) continue
    if (done.has(toISODate(date))) {
      run += 1
      if (run > best) best = run
    } else {
      run = 0
    }
  }

  return { current, best: Math.max(best, current) }
}

export function weeklyStreak(weekStarts: readonly string[], currentWeekStart: string): { current: number; best: number } {
  const set = new Set(weekStarts.filter((week) => week <= currentWeekStart))
  if (set.size === 0) return { current: 0, best: 0 }

  let cursor = set.has(currentWeekStart)
    ? currentWeekStart
    : toISODate(addDays(parseISODate(currentWeekStart), -7))
  let current = 0
  for (let guard = 0; guard < 200; guard += 1) {
    if (!set.has(cursor)) break
    current += 1
    cursor = toISODate(addDays(parseISODate(cursor), -7))
  }

  const sorted = [...set].sort()
  let best = 0
  let run = 0
  let previous: Date | null = null
  for (const week of sorted) {
    const date = parseISODate(week)
    if (previous && diffDays(previous, date) === 7) run += 1
    else run = 1
    if (run > best) best = run
    previous = date
  }

  return { current, best: Math.max(best, current) }
}

export function strategyCandidates(blocks: TimeBlock[], date: string, minMinutes: number): TimeBlock[] {
  return blocks
    .filter((block) => block.date === date && block.category === "strategic" && block.durationMinutes >= minMinutes)
    .sort((a, b) => b.durationMinutes - a.durationMinutes)
}

export function deepWorkCandidates(blocks: TimeBlock[], date: string): TimeBlock[] {
  return blocks
    .filter(
      (block) =>
        block.date === date &&
        block.category === "strategic" &&
        block.start !== null &&
        block.start < DEEP_WORK_BEFORE,
    )
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
}

export function heatLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0
  if (minutes < 45) return 1
  if (minutes < 90) return 2
  if (minutes < 150) return 3
  return 4
}

export const HEAT_COLORS = ["#e7e1d6", "#d3ebe3", "#8fcbba", "#2f8a74", "#1b4f43"] as const

export function categoryMinutes(category: Category, summary: RangeSummary): number {
  return category === "strategic" ? summary.strategicMinutes : summary.operationalMinutes
}

export function loggedDates(blocks: TimeBlock[], startIso: string, endIso: string): Set<string> {
  const dates = new Set<string>()
  for (const iso of eachDate(startIso, endIso)) {
    if (blocks.some((block) => block.date === iso)) dates.add(iso)
  }
  return dates
}
