"use client"

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { parseISODate, todayISO } from "@/lib/dates"
import { createId } from "@/lib/ids"
import { createPersistence, type FocusPersistence } from "@/lib/persistence"
import { createDemoState } from "@/lib/seed"
import {
  createEmptyState,
  type AppState,
  type DailyHabitKind,
  type ReflectionScore,
  type Settings,
  type TimeBlockDraft,
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
    state.reflections.some((reflection) => reflection.demo)
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
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
        settings: {
          targetPercent: clamp(patch.targetPercent ?? current.settings.targetPercent, 10, 80),
          strategyBlockMinutes: clamp(
            patch.strategyBlockMinutes ?? current.settings.strategyBlockMinutes,
            30,
            240,
          ),
        },
      }))
    },
    clearDemo: () => {
      store.update((current) => ({
        ...current,
        timeBlocks: current.timeBlocks.filter((block) => !block.demo),
        dailyHabits: current.dailyHabits.filter((habit) => !habit.demo),
        weeklyPriorities: current.weeklyPriorities.filter((week) => !week.demo),
        reflections: current.reflections.filter((reflection) => !reflection.demo),
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
        return {
          ...current,
          timeBlocks: [...current.timeBlocks.filter((block) => !block.demo), ...demo.timeBlocks],
          dailyHabits: [
            ...habits,
            ...demo.dailyHabits.filter((habit) => !habitKeys.has(`${habit.kind}|${habit.date}`)),
          ],
          weeklyPriorities: [...weeks, ...demo.weeklyPriorities.filter((week) => !weekKeys.has(week.weekStart))],
          reflections: [
            ...reflections,
            ...demo.reflections.filter((reflection) => !reflectionKeys.has(reflection.date)),
          ],
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
