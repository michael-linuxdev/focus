export type Category = "strategic" | "operational"

export type DailyHabitKind = "strategy-block" | "deep-work"

export type ReflectionScore = 1 | 2 | 3 | 4 | 5

export type EnergyLevel = 1 | 2 | 3 | 4 | 5

export type DecisionImportance = "klein" | "wichtig" | "gross"

export type ModuleHabitKind =
  | "sleep-on-it"
  | "pro-contra"
  | "decision-budget"
  | "decision-review"
  | "shutdown"
  | "message-windows"
  | "recovery"

export const HABIT_KEYS = [
  "strategy-block",
  "deep-work",
  "weekly-priorities",
  "reflection",
  "sleep-on-it",
  "pro-contra",
  "decision-budget",
  "decision-review",
  "shutdown",
  "message-windows",
  "recovery",
  "said-no",
] as const

export type HabitKey = (typeof HABIT_KEYS)[number]

export type EnabledHabits = Record<HabitKey, boolean>

export type RoleChoice = "geschaeftsfuehrung" | "vorstand" | "bereichsleitung" | "inhaber"

export type PainChoice = "operational" | "decisions" | "boundaries"

export type TimeChoice = "light" | "steady" | "deep"

export type OnboardingStatus = "pending" | "offer" | "done"

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

export interface Decision {
  id: string
  title: string
  importance: DecisionImportance
  date: string
  sleptOn: boolean
  proContra: boolean
  learning: string
  demo: boolean
  createdAt: string
  updatedAt: string
}

export interface DecisionDraft {
  title: string
  importance: DecisionImportance
  sleptOn: boolean
  proContra: boolean
  date?: string
}

export interface ModuleHabit {
  id: string
  kind: ModuleHabitKind
  date: string
  done: boolean
  demo: boolean
  updatedAt: string
}

export interface EnergyLog {
  id: string
  date: string
  level: EnergyLevel
  demo: boolean
  updatedAt: string
}

export interface DeclineLog {
  id: string
  date: string
  count: number
  demo: boolean
  updatedAt: string
}

export interface Onboarding {
  status: OnboardingStatus
  completed: boolean
  role: RoleChoice | null
  pain: PainChoice | null
  time: TimeChoice | null
}

export interface Settings {
  targetPercent: number
  strategyBlockMinutes: number
  decisionBudget: number
  messageWindows: string
  enabledHabits: EnabledHabits
}

export interface AppState {
  version: 1
  timeBlocks: TimeBlock[]
  dailyHabits: DailyHabit[]
  weeklyPriorities: WeeklyPriorities[]
  reflections: Reflection[]
  decisions: Decision[]
  moduleHabits: ModuleHabit[]
  energyLogs: EnergyLog[]
  declines: DeclineLog[]
  onboarding: Onboarding
  settings: Settings
}

export function enabledHabits(on: boolean): EnabledHabits {
  return Object.fromEntries(HABIT_KEYS.map((key) => [key, on])) as EnabledHabits
}

export const DEFAULT_MESSAGE_WINDOWS = "9:00–9:30 und 16:30–17:00"

export const DEFAULT_ONBOARDING: Onboarding = {
  status: "pending",
  completed: false,
  role: null,
  pain: null,
  time: null,
}

export const DEFAULT_SETTINGS: Settings = {
  targetPercent: 40,
  strategyBlockMinutes: 90,
  decisionBudget: 3,
  messageWindows: DEFAULT_MESSAGE_WINDOWS,
  enabledHabits: enabledHabits(false),
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
    decisions: [],
    moduleHabits: [],
    energyLogs: [],
    declines: [],
    onboarding: { ...DEFAULT_ONBOARDING },
    settings: {
      ...DEFAULT_SETTINGS,
      enabledHabits: { ...DEFAULT_SETTINGS.enabledHabits },
    },
  }
}
