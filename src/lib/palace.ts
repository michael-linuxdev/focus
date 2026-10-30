import { addDays, diffDays, isWeekday, parseISODate, previousWeekday, startOfISOWeek, toISODate } from "@/lib/dates"
import { isWeekDefined } from "@/lib/habits"
import { WINGS, pendingReviews, type WingId } from "@/lib/modules"
import { weekdayStreak, weeklyStreak } from "@/lib/stats"
import type { AppState, ModuleHabitKind } from "@/lib/types"

export type PalaceStage = 0 | 1 | 2 | 3 | 4

export type RoomKey =
  | "strategy"
  | "deep"
  | "priorities"
  | "journal"
  | "sleep"
  | "balance"
  | "budget"
  | "archive"
  | "shutdown"
  | "windows"
  | "recovery"
  | "decline"

export interface RoomVisual {
  key: RoomKey
  stage: PalaceStage
  vitality: number
  dust: boolean
  streak: number
  best: number
}

export interface WingVisual {
  id: WingId
  title: string
  palace: string
  href: string
  stage: PalaceStage
  vitality: number
  dust: boolean
  tone: "waiting" | "resting" | "bright"
  caption: string
  streak: number
  best: number
  rooms: RoomVisual[]
}

export interface PalaceModel {
  wings: Record<WingId, WingVisual>
  summary: string
}

export const ROOM_LABEL: Record<RoomKey, string> = {
  strategy: "Der Strategieflügel",
  deep: "Der Morgen",
  priorities: "Der Tisch der drei Prioritäten",
  journal: "Das Journal",
  sleep: "Die Nachtkammer",
  balance: "Die Waage",
  budget: "Das Budgettor",
  archive: "Das Archiv",
  shutdown: "Das Abendtor",
  windows: "Die Nachrichtenfenster",
  recovery: "Der Garten",
  decline: "Die Glocke",
}

export function growthStage(bestStreak: number, total: number): PalaceStage {
  const byStreak = bestStreak >= 9 ? 4 : bestStreak >= 6 ? 3 : bestStreak >= 3 ? 2 : bestStreak >= 1 ? 1 : 0
  const byTotal = total >= 16 ? 4 : total >= 8 ? 3 : total >= 4 ? 2 : total >= 1 ? 1 : 0
  return Math.max(byStreak, byTotal) as PalaceStage
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function uniq(dates: readonly string[]): string[] {
  return [...new Set(dates)]
}

function recentRatio(dates: readonly string[], today: string, window = 5): number {
  const done = new Set(dates.filter((date) => date <= today))
  if (done.size === 0) return 0
  const first = [...done].sort()[0]
  let cursor = parseISODate(today)
  if (!isWeekday(cursor) || !done.has(today)) cursor = previousWeekday(cursor)
  const available: string[] = []
  for (let index = 0; index < window; index += 1) {
    const iso = toISODate(cursor)
    if (iso < first) break
    available.push(iso)
    cursor = previousWeekday(cursor)
  }
  if (available.length === 0) return 0
  return available.filter((iso) => done.has(iso)).length / available.length
}

function daysAgo(today: string, days: number): string {
  return toISODate(addDays(parseISODate(today), -days))
}

function makeRoom(key: RoomKey, dates: readonly string[], today: string, ratio: number): RoomVisual {
  const unique = uniq(dates.filter((date) => date <= today))
  const streak = weekdayStreak(unique, today)
  const stage = growthStage(streak.best, unique.length)
  const vitality = stage === 0 ? 0.5 : round2(0.26 + 0.74 * clamp01(ratio))
  return {
    key,
    stage,
    vitality,
    dust: stage > 0 && ratio < 0.75,
    streak: streak.current,
    best: streak.best,
  }
}

function habitDates(state: AppState, kind: ModuleHabitKind): string[] {
  return state.moduleHabits.filter((habit) => habit.kind === kind && habit.done).map((habit) => habit.date)
}

function dailyDates(state: AppState, kind: "strategy-block" | "deep-work"): string[] {
  return state.dailyHabits.filter((habit) => habit.kind === kind && habit.done).map((habit) => habit.date)
}

function focusRooms(state: AppState, today: string): RoomVisual[] {
  const strategyDates = dailyDates(state, "strategy-block")
  const deepDates = dailyDates(state, "deep-work")
  const strategy = makeRoom("strategy", strategyDates, today, recentRatio(strategyDates, today))
  const deep = makeRoom("deep", deepDates, today, recentRatio(deepDates, today))

  const currentWeek = toISODate(startOfISOWeek(parseISODate(today)))
  const defined = state.weeklyPriorities.filter((week) => isWeekDefined(week)).map((week) => week.weekStart)
  const weekStreak = weeklyStreak(defined, currentWeek)
  const priorityStage = growthStage(weekStreak.best >= 6 ? 9 : weekStreak.best, defined.length >= 6 ? 16 : defined.length)
  const hasCurrent = defined.includes(currentWeek)
  const hasLast = defined.includes(toISODate(addDays(parseISODate(currentWeek), -7)))
  const priorityRatio = hasCurrent ? 1 : hasLast ? 0.7 : priorityStage === 0 ? 0 : 0.4
  const priorities: RoomVisual = {
    key: "priorities",
    stage: defined.length === 0 ? 0 : priorityStage,
    vitality: defined.length === 0 ? 0.5 : round2(0.26 + 0.74 * priorityRatio),
    dust: defined.length > 0 && priorityRatio < 0.75,
    streak: weekStreak.current,
    best: weekStreak.best,
  }

  const journalDates = state.reflections.map((reflection) => reflection.date)
  const journal = makeRoom("journal", journalDates, today, recentRatio(journalDates, today))
  return [strategy, deep, priorities, journal]
}

function decisionRooms(state: AppState, today: string): RoomVisual[] {
  const horizon = daysAgo(today, 21)
  const recent = state.decisions.filter(
    (decision) => decision.importance !== "klein" && decision.date <= today && decision.date >= horizon,
  )
  const sleptDates = uniq([
    ...habitDates(state, "sleep-on-it"),
    ...state.decisions.filter((decision) => decision.sleptOn).map((decision) => decision.date),
  ])
  const balanceDates = uniq([
    ...habitDates(state, "pro-contra"),
    ...state.decisions.filter((decision) => decision.proContra).map((decision) => decision.date),
  ])
  const sleepRatio =
    recent.length === 0 ? recentRatio(sleptDates, today) || (sleptDates.length ? 0.85 : 0) : recent.filter((decision) => decision.sleptOn).length / recent.length
  const balanceRatio =
    recent.length === 0
      ? recentRatio(balanceDates, today) || (balanceDates.length ? 0.85 : 0)
      : recent.filter((decision) => decision.proContra).length / recent.length

  const budgetDates = habitDates(state, "decision-budget")
  const reviewDates = uniq([
    ...habitDates(state, "decision-review"),
    ...state.decisions.filter((decision) => decision.learning.trim().length > 0).map((decision) => decision.date),
  ])
  const open = pendingReviews(state, today)
  const archiveRatio = open.length === 0 ? (reviewDates.length ? 0.95 : 0) : Math.max(0, 1 - open.length * 0.22)

  return [
    makeRoom("sleep", sleptDates, today, sleepRatio),
    makeRoom("balance", balanceDates, today, balanceRatio),
    makeRoom("budget", budgetDates, today, recentRatio(budgetDates, today)),
    makeRoom("archive", reviewDates, today, archiveRatio),
  ]
}

function boundaryRooms(state: AppState, today: string): RoomVisual[] {
  const shutdownDates = habitDates(state, "shutdown")
  const windowDates = habitDates(state, "message-windows")
  const recoveryDates = habitDates(state, "recovery")
  const lows = state.energyLogs
    .filter((entry) => entry.level <= 2 && entry.date <= today)
    .map((entry) => entry.date)
    .sort()
  const latestLow = lows.at(-1)
  const recoveredAfter = latestLow ? recoveryDates.some((date) => date >= latestLow) : true
  const recoveryRatio = recoveryDates.length === 0 ? 0 : !latestLow || recoveredAfter ? 0.92 : 0.38

  const declineDates = state.declines.filter((entry) => entry.count > 0 && entry.date <= today).map((entry) => entry.date)
  const lastDecline = [...declineDates].sort().at(-1)
  let declineRatio = 0
  if (lastDecline) {
    const gap = diffDays(parseISODate(lastDecline), parseISODate(today))
    declineRatio = gap <= 3 ? 1 : gap <= 7 ? 0.82 : gap <= 14 ? 0.6 : 0.36
  }
  const declineTotal = state.declines.filter((entry) => entry.date <= today).reduce((sum, entry) => sum + entry.count, 0)
  const declineRoom = makeRoom("decline", declineDates, today, declineRatio)
  const declineStage = growthStage(declineRoom.best, declineTotal >= 16 ? 16 : declineTotal >= 8 ? 8 : declineTotal)
  return [
    makeRoom("shutdown", shutdownDates, today, recentRatio(shutdownDates, today)),
    makeRoom("windows", windowDates, today, recentRatio(windowDates, today)),
    makeRoom("recovery", recoveryDates, today, recoveryRatio),
    { ...declineRoom, stage: declineDates.length === 0 ? 0 : declineStage },
  ]
}

function captionFor(stage: PalaceStage, rooms: RoomVisual[], wingDust: boolean): string {
  if (stage === 0) return "Noch ein Grundriss. Der erste gehaltene Tag setzt die Mauer."
  const worst = rooms
    .filter((room) => room.dust && room.stage > 0)
    .sort((a, b) => a.vitality - b.vitality)[0]
  if (worst && wingDust) {
    return `${ROOM_LABEL[worst.key]} ist staubig, nicht abgerissen. Das Licht kehrt zurück, sobald du wieder hältst.`
  }
  if (worst) return `${ROOM_LABEL[worst.key]} wartet. Der Rest des Flügels bleibt hell.`
  if (stage >= 3) return "Hell und bewohnt. Die Räume bleiben, auch wenn ein Tag ausfällt."
  return "Die ersten Räume stehen. Jede gehaltene Serie mauert weiter."
}

function wing(id: WingId, rooms: RoomVisual[], primary: RoomKey): WingVisual {
  const meta = WINGS.find((item) => item.id === id)!
  const built = rooms.filter((room) => room.stage > 0)
  let stage: PalaceStage = 0
  for (const room of built) {
    if (room.stage > stage) stage = room.stage
  }
  const average = built.length ? built.reduce((sum, room) => sum + room.vitality, 0) / built.length : 0.55
  const allFaded = built.length > 0 && built.every((room) => room.vitality < 0.6)
  const vitality = stage === 0 ? 0.55 : allFaded ? round2(average) : round2(Math.max(average, 0.86))
  const dustyCount = built.filter((room) => room.dust).length
  const dust = dustyCount >= 2 || (built.length > 0 && average < 0.62)
  const tone = stage === 0 ? "waiting" : dust ? "resting" : "bright"
  const lead = rooms.find((room) => room.key === primary)
  return {
    id,
    title: meta.title,
    palace: meta.palace,
    href: meta.href,
    stage,
    vitality,
    dust,
    tone,
    caption: captionFor(stage, rooms, dust),
    streak: lead?.streak ?? 0,
    best: lead?.best ?? 0,
    rooms,
  }
}

function summary(wings: WingVisual[]): string {
  const resting = wings.filter((item) => item.tone === "resting")
  if (resting.length === 0) {
    if (wings.every((item) => item.stage === 0)) return "Drei Grundrisse. Der Palast wächst mit dem, was du hältst."
    return "Was du hältst, bleibt hell. Nichts in diesem Haus wird abgerissen."
  }
  if (resting.length === 1) return `${resting[0].palace} ist nur verblasst. Nichts ist verloren.`
  const names = resting.map((item) => item.palace)
  return `${names.slice(0, -1).join(", ")} und ${names.at(-1)} sind nur verblasst. Nichts ist verloren.`
}

export function roomOf(wingVisual: WingVisual, key: RoomKey): RoomVisual {
  return (
    wingVisual.rooms.find((room) => room.key === key) ?? {
      key,
      stage: 0,
      vitality: 0.45,
      dust: false,
      streak: 0,
      best: 0,
    }
  )
}

export function buildPalace(state: AppState, today: string): PalaceModel {
  const focus = wing("focus", focusRooms(state, today), "strategy")
  const decisions = wing("decisions", decisionRooms(state, today), "budget")
  const boundaries = wing("boundaries", boundaryRooms(state, today), "shutdown")
  const wings = { focus, decisions, boundaries }
  return { wings, summary: summary([focus, decisions, boundaries]) }
}
