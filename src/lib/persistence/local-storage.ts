import { normalizeSettings } from "@/lib/modules"
import type { FocusPersistence, PersistenceRead, PersistenceWrite } from "@/lib/persistence/types"
import {
  DEFAULT_ONBOARDING,
  STORAGE_KEY,
  type AppState,
  type Category,
  type DailyHabit,
  type DailyHabitKind,
  type Decision,
  type DecisionImportance,
  type DeclineLog,
  type EnergyLevel,
  type EnergyLog,
  type ModuleHabit,
  type ModuleHabitKind,
  type Onboarding,
  type OnboardingStatus,
  type PainChoice,
  type Reflection,
  type ReflectionScore,
  type RoleChoice,
  type TimeBlock,
  type TimeChoice,
  type WeeklyPriorities,
} from "@/lib/types"

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

function isEnergy(value: unknown): value is EnergyLevel {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}

function isImportance(value: unknown): value is DecisionImportance {
  return value === "klein" || value === "wichtig" || value === "gross"
}

function isModuleKind(value: unknown): value is ModuleHabitKind {
  return (
    value === "sleep-on-it" ||
    value === "pro-contra" ||
    value === "decision-budget" ||
    value === "decision-review" ||
    value === "shutdown" ||
    value === "message-windows" ||
    value === "recovery"
  )
}

function isRole(value: unknown): value is RoleChoice {
  return value === "geschaeftsfuehrung" || value === "vorstand" || value === "bereichsleitung" || value === "inhaber"
}

function isPain(value: unknown): value is PainChoice {
  return value === "operational" || value === "decisions" || value === "boundaries"
}

function isTimeChoice(value: unknown): value is TimeChoice {
  return value === "light" || value === "steady" || value === "deep"
}

function isOnboardingStatus(value: unknown): value is OnboardingStatus {
  return value === "pending" || value === "offer" || value === "done"
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

function list<T>(value: unknown, map: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const next = map(item)
    return next ? [next] : []
  })
}

function sanitizeDecision(value: unknown): Decision | null {
  if (!value || typeof value !== "object") return null
  const decision = value as Partial<Decision>
  if (typeof decision.id !== "string" || !decision.date || !DATE.test(decision.date)) return null
  if (!isImportance(decision.importance)) return null
  const title = asString(decision.title, 140).trim()
  if (!title) return null
  return {
    id: decision.id,
    title,
    importance: decision.importance,
    date: decision.date,
    sleptOn: decision.sleptOn === true,
    proContra: decision.proContra === true,
    learning: asString(decision.learning, 280),
    demo: decision.demo === true,
    createdAt: asString(decision.createdAt, 40) || new Date(0).toISOString(),
    updatedAt: asString(decision.updatedAt, 40) || new Date(0).toISOString(),
  }
}

function sanitizeModuleHabit(value: unknown): ModuleHabit | null {
  if (!value || typeof value !== "object") return null
  const habit = value as Partial<ModuleHabit>
  if (typeof habit.id !== "string" || !habit.date || !DATE.test(habit.date) || !isModuleKind(habit.kind)) return null
  return {
    id: habit.id,
    kind: habit.kind,
    date: habit.date,
    done: habit.done === true,
    demo: habit.demo === true,
    updatedAt: asString(habit.updatedAt, 40) || new Date(0).toISOString(),
  }
}

function sanitizeEnergy(value: unknown): EnergyLog | null {
  if (!value || typeof value !== "object") return null
  const entry = value as Partial<EnergyLog>
  if (typeof entry.id !== "string" || !entry.date || !DATE.test(entry.date) || !isEnergy(entry.level)) return null
  return {
    id: entry.id,
    date: entry.date,
    level: entry.level,
    demo: entry.demo === true,
    updatedAt: asString(entry.updatedAt, 40) || new Date(0).toISOString(),
  }
}

function sanitizeDecline(value: unknown): DeclineLog | null {
  if (!value || typeof value !== "object") return null
  const entry = value as Partial<DeclineLog>
  if (typeof entry.id !== "string" || !entry.date || !DATE.test(entry.date)) return null
  if (typeof entry.count !== "number" || entry.count < 0 || entry.count > 99) return null
  return {
    id: entry.id,
    date: entry.date,
    count: Math.round(entry.count),
    demo: entry.demo === true,
    updatedAt: asString(entry.updatedAt, 40) || new Date(0).toISOString(),
  }
}

function sanitizeOnboarding(value: unknown, legacy: boolean): Onboarding {
  if (!value || typeof value !== "object") {
    return legacy ? { status: "offer", completed: false, role: null, pain: null, time: null } : { ...DEFAULT_ONBOARDING }
  }
  const raw = value as Partial<Onboarding>
  return {
    status: isOnboardingStatus(raw.status) ? raw.status : legacy ? "offer" : "pending",
    completed: raw.completed === true,
    role: isRole(raw.role) ? raw.role : null,
    pain: isPain(raw.pain) ? raw.pain : null,
    time: isTimeChoice(raw.time) ? raw.time : null,
  }
}

export function sanitizeState(value: unknown): AppState | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<AppState>
  if (raw.version !== 1) return null
  const legacy = raw.onboarding == null
  return {
    version: 1,
    timeBlocks: list(raw.timeBlocks, sanitizeBlock),
    dailyHabits: list(raw.dailyHabits, sanitizeHabit),
    weeklyPriorities: list(raw.weeklyPriorities, sanitizeWeek),
    reflections: list(raw.reflections, sanitizeReflection),
    decisions: list(raw.decisions, sanitizeDecision),
    moduleHabits: list(raw.moduleHabits, sanitizeModuleHabit),
    energyLogs: list(raw.energyLogs, sanitizeEnergy),
    declines: list(raw.declines, sanitizeDecline),
    onboarding: sanitizeOnboarding(raw.onboarding, legacy),
    settings: normalizeSettings(raw.settings, legacy),
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
