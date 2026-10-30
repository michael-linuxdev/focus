export type Category = "strategic" | "operational"

export type DailyHabitKind = "strategy-block" | "deep-work"

export type ReflectionScore = 1 | 2 | 3 | 4 | 5

export interface TimeBlock {
  id: string
  date: string
  start: string | null
  end: string | null
  durationMinutes: number
  category: Category
  note: string
  demo: boolean
  createdAt: string
  updatedAt: string
}

export interface TimeBlockDraft {
  date: string
  start: string | null
  end: string | null
  durationMinutes: number
  category: Category
  note: string
}

export interface DailyHabit {
  id: string
  kind: DailyHabitKind
  date: string
  done: boolean
  demo: boolean
  updatedAt: string
}

export interface WeeklyPriorities {
  id: string
  weekStart: string
  items: [string, string, string]
  done: [boolean, boolean, boolean]
  demo: boolean
  updatedAt: string
}

export interface Reflection {
  id: string
  date: string
  score: ReflectionScore
  note: string
  demo: boolean
  updatedAt: string
}

export interface Settings {
  targetPercent: number
  strategyBlockMinutes: number
}

export interface AppState {
  version: 1
  timeBlocks: TimeBlock[]
  dailyHabits: DailyHabit[]
  weeklyPriorities: WeeklyPriorities[]
  reflections: Reflection[]
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  targetPercent: 40,
  strategyBlockMinutes: 90,
}

export const STORAGE_KEY = "strategic-focus-tracker.v1"

export const DEEP_WORK_BEFORE = "10:00"

export function createEmptyState(): AppState {
  return {
    version: 1,
    timeBlocks: [],
    dailyHabits: [],
    weeklyPriorities: [],
    reflections: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}
