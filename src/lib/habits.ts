import { parseISODate, startOfISOWeek, toISODate } from "@/lib/dates"
import { weekdayStreak, weeklyStreak } from "@/lib/stats"
import type { AppState, DailyHabitKind, Reflection, WeeklyPriorities } from "@/lib/types"

export function dailyHabitStreak(state: AppState, kind: DailyHabitKind, today: string) {
  const dates = state.dailyHabits.filter((habit) => habit.kind === kind && habit.done).map((habit) => habit.date)
  return weekdayStreak(dates, today)
}

export function isDailyHabitDone(state: AppState, kind: DailyHabitKind, date: string): boolean {
  return state.dailyHabits.some((habit) => habit.kind === kind && habit.date === date && habit.done)
}

export function prioritiesForWeek(state: AppState, weekStart: string): WeeklyPriorities | undefined {
  return state.weeklyPriorities.find((week) => week.weekStart === weekStart)
}

export function isWeekDefined(week: WeeklyPriorities | undefined): boolean {
  if (!week) return false
  return week.items.every((item) => item.trim().length > 0)
}

export function priorityStreak(state: AppState, today: string) {
  const currentWeek = toISODate(startOfISOWeek(parseISODate(today)))
  const defined = state.weeklyPriorities.filter((week) => isWeekDefined(week)).map((week) => week.weekStart)
  return weeklyStreak(defined, currentWeek)
}

export function reflectionOn(state: AppState, date: string): Reflection | undefined {
  return state.reflections.find((reflection) => reflection.date === date)
}

export function checkedCount(week: WeeklyPriorities | undefined): number {
  if (!week) return 0
  return week.done.filter((done, index) => done && week.items[index].trim().length > 0).length
}
