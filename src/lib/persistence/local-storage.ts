import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  type AppState,
  type Category,
  type DailyHabit,
  type DailyHabitKind,
  type Reflection,
  type ReflectionScore,
  type TimeBlock,
  type WeeklyPriorities,
} from "@/lib/types"
import type { FocusPersistence, PersistenceRead, PersistenceWrite } from "@/lib/persistence/types"

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

function isCategory(value: unknown): value is Category {
  return value === "strategic" || value === "operational"
}

function isHabitKind(value: unknown): value is DailyHabitKind {
  return value === "strategy-block" || value === "deep-work"
}

function isScore(value: unknown): value is ReflectionScore {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}

function asString(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : ""
}

function sanitizeBlock(value: unknown): TimeBlock | null {
  if (!value || typeof value !== "object") return null
  const block = value as Partial<TimeBlock>
  if (typeof block.id !== "string" || !block.date || !DATE.test(block.date)) return null
  if (!isCategory(block.category)) return null
  if (typeof block.durationMinutes !== "number" || block.durationMinutes <= 0 || block.durationMinutes > 24 * 60) {
    return null
  }
  const start = block.start === null || (typeof block.start === "string" && TIME.test(block.start)) ? block.start ?? null : null
  const end = block.end === null || (typeof block.end === "string" && TIME.test(block.end)) ? block.end ?? null : null
  return {
    id: block.id,
    date: block.date,
    start,
    end,
    durationMinutes: Math.round(block.durationMinutes),
    category: block.category,
    note: asString(block.note, 280),
    demo: block.demo === true,
    createdAt: asString(block.createdAt, 40) || new Date(0).toISOString(),
    updatedAt: asString(block.updatedAt, 40) || new Date(0).toISOString(),
  }
}

function sanitizeHabit(value: unknown): DailyHabit | null {
  if (!value || typeof value !== "object") return null
  const habit = value as Partial<DailyHabit>
  if (typeof habit.id !== "string" || !habit.date || !DATE.test(habit.date) || !isHabitKind(habit.kind)) return null
  return {
    id: habit.id,
    kind: habit.kind,
    date: habit.date,
    done: habit.done === true,
    demo: habit.demo === true,
    updatedAt: asString(habit.updatedAt, 40) || new Date(0).toISOString(),
  }
}

function asTrio(value: unknown): [string, string, string] {
  const items = Array.isArray(value) ? value : []
  return [0, 1, 2].map((index) => asString(items[index], 120)) as [string, string, string]
}

function asChecks(value: unknown): [boolean, boolean, boolean] {
  const items = Array.isArray(value) ? value : []
  return [0, 1, 2].map((index) => items[index] === true) as [boolean, boolean, boolean]
}

function sanitizeWeek(value: unknown): WeeklyPriorities | null {
  if (!value || typeof value !== "object") return null
  const week = value as Partial<WeeklyPriorities>
  if (typeof week.id !== "string" || !week.weekStart || !DATE.test(week.weekStart)) return null
  return {
    id: week.id,
    weekStart: week.weekStart,
    items: asTrio(week.items),
    done: asChecks(week.done),
    demo: week.demo === true,
    updatedAt: asString(week.updatedAt, 40) || new Date(0).toISOString(),
  }
}

function sanitizeReflection(value: unknown): Reflection | null {
  if (!value || typeof value !== "object") return null
  const reflection = value as Partial<Reflection>
  if (typeof reflection.id !== "string" || !reflection.date || !DATE.test(reflection.date)) return null
  if (!isScore(reflection.score)) return null
  return {
    id: reflection.id,
    date: reflection.date,
    score: reflection.score,
    note: asString(reflection.note, 280),
    demo: reflection.demo === true,
    updatedAt: asString(reflection.updatedAt, 40) || new Date(0).toISOString(),
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function sanitizeState(value: unknown): AppState | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<AppState>
  if (raw.version !== 1) return null
  const settings = raw.settings
  return {
    version: 1,
    timeBlocks: Array.isArray(raw.timeBlocks) ? raw.timeBlocks.flatMap((item) => {
      const block = sanitizeBlock(item)
      return block ? [block] : []
    }) : [],
    dailyHabits: Array.isArray(raw.dailyHabits) ? raw.dailyHabits.flatMap((item) => {
      const habit = sanitizeHabit(item)
      return habit ? [habit] : []
    }) : [],
    weeklyPriorities: Array.isArray(raw.weeklyPriorities) ? raw.weeklyPriorities.flatMap((item) => {
      const week = sanitizeWeek(item)
      return week ? [week] : []
    }) : [],
    reflections: Array.isArray(raw.reflections) ? raw.reflections.flatMap((item) => {
      const reflection = sanitizeReflection(item)
      return reflection ? [reflection] : []
    }) : [],
    settings: {
      targetPercent: clamp(settings?.targetPercent, 10, 80, DEFAULT_SETTINGS.targetPercent),
      strategyBlockMinutes: clamp(settings?.strategyBlockMinutes, 30, 240, DEFAULT_SETTINGS.strategyBlockMinutes),
    },
  }
}

export class LocalStoragePersistence implements FocusPersistence {
  constructor(private readonly key = STORAGE_KEY) {}

  read(): PersistenceRead {
    if (typeof window === "undefined") return { status: "empty" }
    try {
      const raw = window.localStorage.getItem(this.key)
      if (!raw) return { status: "empty" }
      const parsed: unknown = JSON.parse(raw)
      const state = sanitizeState(parsed)
      if (!state) return { status: "invalid" }
      return { status: "ok", state }
    } catch {
      return { status: "invalid" }
    }
  }

  write(state: AppState): PersistenceWrite {
    if (typeof window === "undefined") {
      return { ok: false, message: "Speichern ist außerhalb des Browsers nicht möglich." }
    }
    try {
      window.localStorage.setItem(this.key, JSON.stringify(state))
      return { ok: true }
    } catch {
      return {
        ok: false,
        message: "Der Browser hat das Speichern blockiert. Änderungen bleiben nur bis zum Neuladen erhalten.",
      }
    }
  }
}

export function createPersistence(): FocusPersistence {
  return new LocalStoragePersistence()
}
