import { addDays, parseISODate, startOfISOWeek, toISODate } from "@/lib/dates"
import { isDailyHabitDone, isWeekDefined, prioritiesForWeek, reflectionOn } from "@/lib/habits"
import {
  DEFAULT_MESSAGE_WINDOWS,
  DEFAULT_SETTINGS,
  type AppState,
  type Decision,
  type EnabledHabits,
  type EnergyLevel,
  type HabitKey,
  type ModuleHabitKind,
  type PainChoice,
  type Settings,
  type TimeChoice,
  enabledHabits,
} from "@/lib/types"

export type WingId = "focus" | "decisions" | "boundaries"

export type HabitCadence = "daily" | "weekly" | "event" | "counter"

export interface HabitMeta {
  key: HabitKey
  module: WingId
  title: string
  short: string
  description: string
  cadence: HabitCadence
}

export const WINGS: Array<{ id: WingId; title: string; palace: string; href: string }> = [
  { id: "focus", title: "Fokus", palace: "Der Fokusflügel", href: "/fokus" },
  { id: "decisions", title: "Entscheidungen", palace: "Der Entscheidungsflügel", href: "/entscheidungen" },
  { id: "boundaries", title: "Grenzen & Energie", palace: "Der Grenzenflügel", href: "/grenzen" },
]

export const HABITS: HabitMeta[] = [
  {
    key: "strategy-block",
    module: "focus",
    title: "Strategieblock",
    short: "Strategieblock",
    description: "Ein ungestörter Block in der Länge, die du festgelegt hast.",
    cadence: "daily",
  },
  {
    key: "deep-work",
    module: "focus",
    title: "Deep Work vor 10 Uhr",
    short: "Deep Work vor 10",
    description: "Richtung, bevor der Kalender den Vormittag übernimmt.",
    cadence: "daily",
  },
  {
    key: "weekly-priorities",
    module: "focus",
    title: "Top 3 der Woche",
    short: "Top 3",
    description: "Drei Prioritäten, geschrieben, nicht nur gedacht.",
    cadence: "weekly",
  },
  {
    key: "reflection",
    module: "focus",
    title: "Tagesreflexion",
    short: "Reflexion",
    description: "Eine Frage am Abend: reagiert oder gestaltet?",
    cadence: "daily",
  },
  {
    key: "sleep-on-it",
    module: "decisions",
    title: "Eine Nacht darüber geschlafen",
    short: "Eine Nacht geschlafen",
    description: "Wichtige Entscheidungen erst am nächsten Tag festziehen.",
    cadence: "event",
  },
  {
    key: "pro-contra",
    module: "decisions",
    title: "Pro und Contra",
    short: "Pro und Contra",
    description: "Vor großen Entscheidungen eine kurze Liste, keine Studie.",
    cadence: "event",
  },
  {
    key: "decision-budget",
    module: "decisions",
    title: "Entscheidungsbudget",
    short: "Budget gehalten",
    description: "Nur wenige wichtige Entscheidungen pro Tag.",
    cadence: "daily",
  },
  {
    key: "decision-review",
    module: "decisions",
    title: "Was habe ich gelernt?",
    short: "Gelernt notiert",
    description: "Kurz nachfassen, wenn die Entscheidung schon steht.",
    cadence: "event",
  },
  {
    key: "shutdown",
    module: "boundaries",
    title: "Abendritual",
    short: "Abendritual",
    description: "Laptop zu und ein Satz zum Tag.",
    cadence: "daily",
  },
  {
    key: "message-windows",
    module: "boundaries",
    title: "Nachrichtenfenster",
    short: "Nachrichtenfenster",
    description: "E-Mail und Slack nur in festen Fenstern.",
    cadence: "daily",
  },
  {
    key: "recovery",
    module: "boundaries",
    title: "Erholung nach intensiver Phase",
    short: "Erholung",
    description: "Nach dünnen Tagen bewusst einen Gang zurück.",
    cadence: "event",
  },
  {
    key: "said-no",
    module: "boundaries",
    title: "Nein gesagt",
    short: "Nein gesagt",
    description: "Unnötige Termine und Anfragen abgelehnt.",
    cadence: "counter",
  },
]

const MODULE_KINDS: readonly ModuleHabitKind[] = [
  "sleep-on-it",
  "pro-contra",
  "decision-budget",
  "decision-review",
  "shutdown",
  "message-windows",
  "recovery",
]

export function isModuleHabitKind(key: HabitKey): key is ModuleHabitKind {
  return (MODULE_KINDS as readonly string[]).includes(key)
}

export function habitMeta(key: HabitKey): HabitMeta {
  const found = HABITS.find((habit) => habit.key === key)
  if (!found) throw new Error(`Unbekannte Gewohnheit ${key}`)
  return found
}

export function habitsFor(module: WingId): HabitMeta[] {
  return HABITS.filter((habit) => habit.module === module)
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function normalizeEnabled(value: unknown, legacyFocus: boolean): EnabledHabits {
  const base = enabledHabits(false)
  if (legacyFocus) {
    base["strategy-block"] = true
    base["deep-work"] = true
    base["weekly-priorities"] = true
    base.reflection = true
  }
  if (!value || typeof value !== "object") return base
  const raw = value as Record<string, unknown>
  for (const habit of HABITS) {
    const flag = raw[habit.key]
    if (typeof flag === "boolean") base[habit.key] = flag
  }
  return base
}

export function normalizeSettings(value: unknown, legacyFocus: boolean): Settings {
  const raw = value && typeof value === "object" ? (value as Partial<Settings>) : {}
  const windows = typeof raw.messageWindows === "string" ? raw.messageWindows.trim().slice(0, 80) : ""
  return {
    targetPercent: clamp(raw.targetPercent, 10, 80, DEFAULT_SETTINGS.targetPercent),
    strategyBlockMinutes: clamp(raw.strategyBlockMinutes, 30, 240, DEFAULT_SETTINGS.strategyBlockMinutes),
    decisionBudget: clamp(raw.decisionBudget, 1, 6, DEFAULT_SETTINGS.decisionBudget),
    messageWindows: windows || DEFAULT_MESSAGE_WINDOWS,
    enabledHabits: normalizeEnabled(raw.enabledHabits, legacyFocus),
  }
}

const LIGHT: Record<PainChoice, HabitKey[]> = {
  operational: ["strategy-block", "decision-budget", "shutdown"],
  decisions: ["sleep-on-it", "strategy-block", "shutdown"],
  boundaries: ["shutdown", "strategy-block", "decision-budget"],
}

const STEADY: Record<PainChoice, HabitKey[]> = {
  operational: ["strategy-block", "deep-work", "weekly-priorities", "decision-budget", "shutdown", "message-windows"],
  decisions: ["sleep-on-it", "pro-contra", "decision-budget", "decision-review", "strategy-block", "shutdown"],
  boundaries: ["shutdown", "message-windows", "recovery", "said-no", "reflection", "decision-budget"],
}

export function suggestHabits(pain: PainChoice, time: TimeChoice): EnabledHabits {
  if (time === "deep") return enabledHabits(true)
  const keys = time === "light" ? LIGHT[pain] : STEADY[pain]
  const next = enabledHabits(false)
  for (const key of keys) next[key] = true
  return next
}

export function isModuleHabitDone(state: AppState, kind: ModuleHabitKind, date: string): boolean {
  return state.moduleHabits.some((habit) => habit.kind === kind && habit.date === date && habit.done)
}

export function isHabitDone(state: AppState, key: HabitKey, date: string): boolean {
  if (key === "strategy-block" || key === "deep-work") return isDailyHabitDone(state, key, date)
  if (key === "weekly-priorities") {
    const week = toISODate(startOfISOWeek(parseISODate(date)))
    return isWeekDefined(prioritiesForWeek(state, week))
  }
  if (key === "reflection") return Boolean(reflectionOn(state, date))
  if (key === "said-no") return declinesOn(state, date) > 0
  return isModuleHabitDone(state, key, date)
}

export function declinesOn(state: AppState, date: string): number {
  return state.declines.find((entry) => entry.date === date)?.count ?? 0
}

export function energyOn(state: AppState, date: string): EnergyLevel | null {
  return state.energyLogs.find((entry) => entry.date === date)?.level ?? null
}

export function decisionsOn(state: AppState, date: string): Decision[] {
  return state.decisions.filter((decision) => decision.date === date)
}

export function isImportant(decision: Decision): boolean {
  return decision.importance !== "klein"
}

export function importantCount(state: AppState, date: string): number {
  return state.decisions.filter((decision) => decision.date === date && isImportant(decision)).length
}

export function pendingReviews(state: AppState, today: string, horizon = 21): Decision[] {
  const start = toISODate(addDays(parseISODate(today), -horizon))
  return state.decisions
    .filter(
      (decision) =>
        isImportant(decision) &&
        decision.learning.trim().length === 0 &&
        decision.date < today &&
        decision.date >= start,
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}

export function budgetRemaining(state: AppState, date: string): number {
  return state.settings.decisionBudget - importantCount(state, date)
}

export const ROLE_LABEL: Record<AppState["onboarding"]["role"] & string, string> = {
  geschaeftsfuehrung: "die Geschäftsführung",
  vorstand: "den Vorstand",
  bereichsleitung: "die Bereichsleitung",
  inhaber: "Inhaberinnen und Inhaber",
}

export const PAIN_OPTIONS: Array<{ id: PainChoice; title: string; hint: string }> = [
  { id: "operational", title: "Zu viel operativ", hint: "Der Tag reagiert, die Richtung wartet." },
  { id: "decisions", title: "Zu viele Entscheidungen", hint: "Alles will heute entschieden sein." },
  { id: "boundaries", title: "Kaum Grenzen, wenig Energie", hint: "Der Tag hat kein Ende und kein Nein." },
]

export const TIME_OPTIONS: Array<{ id: TimeChoice; title: string; hint: string }> = [
  { id: "light", title: "Zwei Minuten", hint: "Nur das Nötigste, ein Griff pro Flügel." },
  { id: "steady", title: "Fünf Minuten", hint: "Ein kurzes Ritual, das sich halten lässt." },
  { id: "deep", title: "Zehn Minuten", hint: "Alle drei Flügel, bewusst gepflegt." },
]

export const ROLE_OPTIONS: Array<{ id: NonNullable<AppState["onboarding"]["role"]>; title: string }> = [
  { id: "geschaeftsfuehrung", title: "Geschäftsführung" },
  { id: "vorstand", title: "Vorstand" },
  { id: "bereichsleitung", title: "Bereichsleitung" },
  { id: "inhaber", title: "Inhaberin oder Inhaber" },
]

export const ENERGY_LABELS = ["leer", "dünn", "tragfähig", "klar", "voll"] as const

export const MESSAGE_WINDOW_PRESETS = [
  DEFAULT_MESSAGE_WINDOWS,
  "Nur 8:30–9:00",
  "12:00–12:30 und 17:00–17:30",
] as const
