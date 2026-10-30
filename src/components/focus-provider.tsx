"use client"

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { parseISODate, todayISO } from "@/lib/dates"
import { createId } from "@/lib/ids"
import { importantCount, normalizeSettings } from "@/lib/modules"
import { createPersistence, type FocusPersistence } from "@/lib/persistence"
import { createDemoState } from "@/lib/seed"
import {
  createEmptyState,
  type AppState,
  type DailyHabitKind,
  type DecisionDraft,
  type EnabledHabits,
  type EnergyLevel,
  type ModuleHabit,
  type ModuleHabitKind,
  type PainChoice,
  type ReflectionScore,
  type RoleChoice,
  type Settings,
  type TimeBlockDraft,
  type TimeChoice,
  type WeeklyPriorities,
} from "@/lib/types"

interface Snapshot {
  ready: boolean
  today: string
  state: AppState
  warning: string | null
}

const SERVER_SNAPSHOT: Snapshot = {
  ready: false,
  today: "",
  state: createEmptyState(),
  warning: null,
}

function createFocusStore(persistence: FocusPersistence) {
  let snapshot: Snapshot = SERVER_SNAPSHOT
  const listeners = new Set<() => void>()

  function replace(next: Snapshot) {
    snapshot = next
    listeners.forEach((listener) => listener())
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return snapshot
    },
    getServerSnapshot() {
      return SERVER_SNAPSHOT
    },
    boot() {
      if (typeof window === "undefined" || snapshot.ready) return
      const today = todayISO()
      const read = persistence.read()
      let state: AppState
      let warning: string | null = null
      if (read.status === "ok") {
        state = read.state
      } else if (read.status === "invalid") {
        state = createEmptyState()
        warning = "Gespeicherte Daten waren unlesbar und wurden zurückgesetzt."
        persistence.write(state)
      } else {
        state = createDemoState(parseISODate(today))
        const wrote = persistence.write(state)
        if (!wrote.ok) warning = wrote.message
      }
      replace({ ready: true, today, state, warning })
    },
    update(recipe: (state: AppState) => AppState): boolean {
      if (!snapshot.ready) return false
      const state = recipe(snapshot.state)
      const wrote = persistence.write(state)
      replace({
        ready: true,
        today: snapshot.today,
        state,
        warning: wrote.ok ? null : wrote.message,
      })
      return wrote.ok
    },
  }
}

interface FocusContextValue {
  ready: boolean
  today: string
  state: AppState
  hasDemo: boolean
  warning: string | null
  addTimeBlock: (draft: TimeBlockDraft) => boolean
  updateTimeBlock: (id: string, draft: TimeBlockDraft) => boolean
  deleteTimeBlock: (id: string) => boolean
  toggleDailyHabit: (kind: DailyHabitKind, date: string) => void
  saveWeeklyPriorities: (
    weekStart: string,
    items: [string, string, string],
    done: [boolean, boolean, boolean],
  ) => void
  saveReflection: (date: string, score: ReflectionScore, note: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  setModuleHabit: (kind: ModuleHabitKind, date: string, done: boolean) => void
  toggleModuleHabit: (kind: ModuleHabitKind, date: string) => void
  addDecision: (draft: DecisionDraft) => boolean
  deleteDecision: (id: string) => void
  saveLearning: (id: string, learning: string) => void
  saveEnergy: (date: string, level: EnergyLevel) => void
  incrementDeclines: (date: string) => void
  decrementDeclines: (date: string) => void
  completeOnboarding: (profile: {
    role: RoleChoice
    pain: PainChoice
    time: TimeChoice
    enabled: EnabledHabits
  }) => void
  dismissOnboarding: () => void
  clearDemo: () => void
  loadDemo: () => void
  clearAll: () => void
}

const FocusContext = createContext<FocusContextValue | null>(null)

function demoPresent(state: AppState): boolean {
  return (
    state.timeBlocks.some((block) => block.demo) ||
    state.dailyHabits.some((habit) => habit.demo) ||
    state.weeklyPriorities.some((week) => week.demo) ||
    state.reflections.some((reflection) => reflection.demo) ||
    state.decisions.some((decision) => decision.demo) ||
    state.moduleHabits.some((habit) => habit.demo) ||
    state.energyLogs.some((entry) => entry.demo) ||
    state.declines.some((entry) => entry.demo)
  )
}

function withModuleHabit(current: AppState, kind: ModuleHabitKind, date: string, done: boolean): AppState {
  const now = new Date().toISOString()
  const existing = current.moduleHabits.find((habit) => habit.kind === kind && habit.date === date)
  const next: ModuleHabit = existing
    ? { ...existing, done, demo: false, updatedAt: now }
    : { id: createId(), kind, date, done, demo: false, updatedAt: now }
  return {
    ...current,
    moduleHabits: existing
      ? current.moduleHabits.map((habit) => (habit.id === existing.id ? next : habit))
      : [...current.moduleHabits, next],
  }
}

function syncBudget(current: AppState, date: string): AppState {
  const count = importantCount(current, date)
  if (count > current.settings.decisionBudget) return withModuleHabit(current, "decision-budget", date, false)
  if (count > 0) return withModuleHabit(current, "decision-budget", date, true)
  return current
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createFocusStore(createPersistence()))
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)

  useEffect(() => {
    store.boot()
  }, [store])

  const value: FocusContextValue = {
    ready: snapshot.ready,
    today: snapshot.today,
    state: snapshot.state,
    hasDemo: demoPresent(snapshot.state),
    warning: snapshot.warning,
    addTimeBlock: (draft) => {
      const now = new Date().toISOString()
      return store.update((current) => ({
        ...current,
        timeBlocks: [
          ...current.timeBlocks,
          { ...draft, note: draft.note.trim(), id: createId(), demo: false, createdAt: now, updatedAt: now },
        ],
      }))
    },
    updateTimeBlock: (id, draft) => {
      const now = new Date().toISOString()
      return store.update((current) => ({
        ...current,
        timeBlocks: current.timeBlocks.map((block) =>
          block.id === id ? { ...block, ...draft, note: draft.note.trim(), demo: false, updatedAt: now } : block,
        ),
      }))
    },
    deleteTimeBlock: (id) =>
      store.update((current) => ({
        ...current,
        timeBlocks: current.timeBlocks.filter((block) => block.id !== id),
      })),
    toggleDailyHabit: (kind, date) => {
      const now = new Date().toISOString()
      store.update((current) => {
        const existing = current.dailyHabits.find((habit) => habit.kind === kind && habit.date === date)
        if (!existing) {
          return {
            ...current,
            dailyHabits: [
              ...current.dailyHabits,
              { id: createId(), kind, date, done: true, demo: false, updatedAt: now },
            ],
          }
        }
        return {
          ...current,
          dailyHabits: current.dailyHabits.map((habit) =>
            habit.id === existing.id ? { ...habit, done: !habit.done, demo: false, updatedAt: now } : habit,
          ),
        }
      })
    },
    saveWeeklyPriorities: (weekStart, items, done) => {
      const now = new Date().toISOString()
      const trimmed = items.map((item) => item.slice(0, 120)) as WeeklyPriorities["items"]
      store.update((current) => {
        const existing = current.weeklyPriorities.find((week) => week.weekStart === weekStart)
        if (!existing) {
          return {
            ...current,
            weeklyPriorities: [
              ...current.weeklyPriorities,
              { id: createId(), weekStart, items: trimmed, done, demo: false, updatedAt: now },
            ],
          }
        }
        return {
          ...current,
          weeklyPriorities: current.weeklyPriorities.map((week) =>
            week.weekStart === weekStart ? { ...week, items: trimmed, done, demo: false, updatedAt: now } : week,
          ),
        }
      })
    },
    saveReflection: (date, score, note) => {
      const now = new Date().toISOString()
      const trimmed = note.trim().slice(0, 280)
      store.update((current) => {
        const existing = current.reflections.find((reflection) => reflection.date === date)
        if (!existing) {
          return {
            ...current,
            reflections: [
              ...current.reflections,
              { id: createId(), date, score, note: trimmed, demo: false, updatedAt: now },
            ],
          }
        }
        return {
          ...current,
          reflections: current.reflections.map((reflection) =>
            reflection.date === date ? { ...reflection, score, note: trimmed, demo: false, updatedAt: now } : reflection,
          ),
        }
      })
    },
    updateSettings: (patch) => {
      store.update((current) => ({
        ...current,
        settings: normalizeSettings({ ...current.settings, ...patch }, false),
      }))
    },
    setModuleHabit: (kind, date, done) => {
      store.update((current) => {
        if (kind === "decision-budget" && done && importantCount(current, date) > current.settings.decisionBudget) {
          return current
        }
        return withModuleHabit(current, kind, date, done)
      })
    },
    toggleModuleHabit: (kind, date) => {
      store.update((current) => {
        const done = !current.moduleHabits.some((habit) => habit.kind === kind && habit.date === date && habit.done)
        if (kind === "decision-budget" && done && importantCount(current, date) > current.settings.decisionBudget) {
          return withModuleHabit(current, kind, date, false)
        }
        return withModuleHabit(current, kind, date, done)
      })
    },
    addDecision: (draft) => {
      const title = draft.title.trim().slice(0, 140)
      if (!title) return false
      const now = new Date().toISOString()
      const date = draft.date && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : snapshot.today
      return store.update((current) => {
        let next: AppState = {
          ...current,
          decisions: [
            ...current.decisions,
            {
              id: createId(),
              title,
              importance: draft.importance,
              date,
              sleptOn: draft.sleptOn,
              proContra: draft.proContra,
              learning: "",
              demo: false,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }
        if (draft.sleptOn) next = withModuleHabit(next, "sleep-on-it", date, true)
        if (draft.proContra) next = withModuleHabit(next, "pro-contra", date, true)
        return syncBudget(next, date)
      })
    },
    deleteDecision: (id) => {
      store.update((current) => {
        const existing = current.decisions.find((decision) => decision.id === id)
        if (!existing) return current
        return syncBudget({ ...current, decisions: current.decisions.filter((decision) => decision.id !== id) }, existing.date)
      })
    },
    saveLearning: (id, learning) => {
      const now = new Date().toISOString()
      const trimmed = learning.trim().slice(0, 280)
      store.update((current) => {
        const existing = current.decisions.find((decision) => decision.id === id)
        if (!existing) return current
        let next: AppState = {
          ...current,
          decisions: current.decisions.map((decision) =>
            decision.id === id ? { ...decision, learning: trimmed, demo: false, updatedAt: now } : decision,
          ),
        }
        if (trimmed) next = withModuleHabit(next, "decision-review", snapshot.today || existing.date, true)
        return next
      })
    },
    saveEnergy: (date, level) => {
      const now = new Date().toISOString()
      store.update((current) => {
        const existing = current.energyLogs.find((entry) => entry.date === date)
        if (!existing) {
          return {
            ...current,
            energyLogs: [...current.energyLogs, { id: createId(), date, level, demo: false, updatedAt: now }],
          }
        }
        return {
          ...current,
          energyLogs: current.energyLogs.map((entry) =>
            entry.date === date ? { ...entry, level, demo: false, updatedAt: now } : entry,
          ),
        }
      })
    },
    incrementDeclines: (date) => {
      const now = new Date().toISOString()
      store.update((current) => {
        const existing = current.declines.find((entry) => entry.date === date)
        if (!existing) {
          return {
            ...current,
            declines: [...current.declines, { id: createId(), date, count: 1, demo: false, updatedAt: now }],
          }
        }
        return {
          ...current,
          declines: current.declines.map((entry) =>
            entry.date === date ? { ...entry, count: Math.min(99, entry.count + 1), demo: false, updatedAt: now } : entry,
          ),
        }
      })
    },
    decrementDeclines: (date) => {
      const now = new Date().toISOString()
      store.update((current) => ({
        ...current,
        declines: current.declines.map((entry) =>
          entry.date === date ? { ...entry, count: Math.max(0, entry.count - 1), demo: false, updatedAt: now } : entry,
        ),
      }))
    },
    completeOnboarding: (profile) => {
      store.update((current) => ({
        ...current,
        onboarding: {
          status: "done",
          completed: true,
          role: profile.role,
          pain: profile.pain,
          time: profile.time,
        },
        settings: normalizeSettings({ ...current.settings, enabledHabits: profile.enabled }, false),
      }))
    },
    dismissOnboarding: () => {
      store.update((current) => ({
        ...current,
        onboarding: { ...current.onboarding, status: "done", completed: current.onboarding.completed },
      }))
    },
    clearDemo: () => {
      store.update((current) => ({
        ...current,
        timeBlocks: current.timeBlocks.filter((block) => !block.demo),
        dailyHabits: current.dailyHabits.filter((habit) => !habit.demo),
        weeklyPriorities: current.weeklyPriorities.filter((week) => !week.demo),
        reflections: current.reflections.filter((reflection) => !reflection.demo),
        decisions: current.decisions.filter((decision) => !decision.demo),
        moduleHabits: current.moduleHabits.filter((habit) => !habit.demo),
        energyLogs: current.energyLogs.filter((entry) => !entry.demo),
        declines: current.declines.filter((entry) => !entry.demo),
      }))
    },
    loadDemo: () => {
      if (!snapshot.ready) return
      const demo = createDemoState(parseISODate(snapshot.today))
      store.update((current) => {
        const habits = current.dailyHabits.filter((habit) => !habit.demo)
        const habitKeys = new Set(habits.map((habit) => `${habit.kind}|${habit.date}`))
        const weeks = current.weeklyPriorities.filter((week) => !week.demo)
        const weekKeys = new Set(weeks.map((week) => week.weekStart))
        const reflections = current.reflections.filter((reflection) => !reflection.demo)
        const reflectionKeys = new Set(reflections.map((reflection) => reflection.date))
        const decisions = current.decisions.filter((decision) => !decision.demo)
        const decisionIds = new Set(decisions.map((decision) => decision.id))
        const moduleHabits = current.moduleHabits.filter((habit) => !habit.demo)
        const moduleKeys = new Set(moduleHabits.map((habit) => `${habit.kind}|${habit.date}`))
        const energy = current.energyLogs.filter((entry) => !entry.demo)
        const energyDates = new Set(energy.map((entry) => entry.date))
        const declines = current.declines.filter((entry) => !entry.demo)
        const declineDates = new Set(declines.map((entry) => entry.date))
        return {
          ...current,
          timeBlocks: [...current.timeBlocks.filter((block) => !block.demo), ...demo.timeBlocks],
          dailyHabits: [...habits, ...demo.dailyHabits.filter((habit) => !habitKeys.has(`${habit.kind}|${habit.date}`))],
          weeklyPriorities: [...weeks, ...demo.weeklyPriorities.filter((week) => !weekKeys.has(week.weekStart))],
          reflections: [...reflections, ...demo.reflections.filter((reflection) => !reflectionKeys.has(reflection.date))],
          decisions: [...decisions, ...demo.decisions.filter((decision) => !decisionIds.has(decision.id))],
          moduleHabits: [
            ...moduleHabits,
            ...demo.moduleHabits.filter((habit) => !moduleKeys.has(`${habit.kind}|${habit.date}`)),
          ],
          energyLogs: [...energy, ...demo.energyLogs.filter((entry) => !energyDates.has(entry.date))],
          declines: [...declines, ...demo.declines.filter((entry) => !declineDates.has(entry.date))],
        }
      })
    },
    clearAll: () => {
      store.update(() => createEmptyState())
    },
  }

  return (
    <FocusContext.Provider value={value}>
      <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
        {children}
        <Toaster position="top-center" />
      </ThemeProvider>
    </FocusContext.Provider>
  )
}

export function useFocus(): FocusContextValue {
  const value = useContext(FocusContext)
  if (!value) {
    throw new Error("useFocus muss innerhalb von FocusProvider stehen.")
  }
  return value
}
