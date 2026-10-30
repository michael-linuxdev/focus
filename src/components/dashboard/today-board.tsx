"use client"

import Link from "next/link"
import { HabitToggle } from "@/components/habit-toggle"
import { useOnboardingWizard } from "@/components/onboarding/onboarding-context"
import { useFocus } from "@/components/focus-provider"
import { declinesOn, HABITS, importantCount, isHabitDone, isModuleHabitKind, WINGS, type HabitMeta } from "@/lib/modules"
import type { HabitKey } from "@/lib/types"
import { cn } from "@/lib/utils"

const ACCENT: Record<(typeof WINGS)[number]["id"], string> = {
  focus: "text-strategic",
  decisions: "text-[#8c6232]",
  boundaries: "text-[#8c3e2a]",
}

function labelFor(habit: HabitMeta, count: number, budget: number, declines: number): string {
  if (habit.key === "decision-budget") return `Budget ${count}/${budget}`
  if (habit.key === "said-no") return declines > 0 ? `Nein gesagt · ${declines}` : "Nein gesagt"
  return habit.short
}

export function TodayBoard() {
  const { state, today, toggleDailyHabit, toggleModuleHabit, incrementDeclines, decrementDeclines } = useFocus()
  const { openWizard } = useOnboardingWizard()
  const enabled = HABITS.filter((habit) => state.settings.enabledHabits[habit.key])
  const count = importantCount(state, today)
  const declines = declinesOn(state, today)
  const over = count > state.settings.decisionBudget

  if (enabled.length === 0) {
    return (
      <section className="rounded-3xl bg-card px-5 py-5 ring-1 ring-foreground/10">
        <h2 className="font-serif text-2xl tracking-tight">Heute, ein Tipp</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground text-pretty">
          Drei kurze Fragen, dann liegen die passenden Gewohnheiten bereit. Danach reicht ein Tipp.
        </p>
        <button
          type="button"
          onClick={openWizard}
          className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Gewohnheiten wählen
        </button>
      </section>
    )
  }

  function press(key: HabitKey) {
    if (key === "strategy-block" || key === "deep-work") {
      toggleDailyHabit(key, today)
      return
    }
    if (isModuleHabitKind(key)) toggleModuleHabit(key, today)
  }

  return (
    <section aria-labelledby="heute-titel" className="rounded-3xl bg-card px-5 py-5 ring-1 ring-foreground/10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="heute-titel" className="font-serif text-2xl tracking-tight">
            Heute, ein Tipp
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Was du hältst, bleibt im Palast hell.</p>
        </div>
        <button type="button" onClick={openWizard} className="text-sm font-medium text-strategic underline-offset-4 hover:underline">
          Anpassen
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {WINGS.map((wing) => {
          const habits = enabled.filter((habit) => habit.module === wing.id)
          if (habits.length === 0) return null
          return (
            <div key={wing.id}>
              <h3 className={cn("text-xs font-medium tracking-[0.14em] uppercase", ACCENT[wing.id])}>{wing.title}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {habits.map((habit) => {
                  if (habit.key === "weekly-priorities") {
                    const done = isHabitDone(state, habit.key, today)
                    return (
                      <Link
                        key={habit.key}
                        href="/fokus"
                        className={cn(
                          "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium",
                          done ? "border-transparent bg-[#1f6f5b] text-white" : "border-border bg-background",
                        )}
                      >
                        {done ? "Top 3 stehen" : "Top 3 öffnen"}
                      </Link>
                    )
                  }
                  if (habit.key === "reflection") {
                    const done = isHabitDone(state, habit.key, today)
                    return (
                      <a
                        key={habit.key}
                        href="#abend"
                        className={cn(
                          "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium",
                          done ? "border-transparent bg-[#1f6f5b] text-white" : "border-border bg-background",
                        )}
                      >
                        {done ? "Reflexion steht" : "Zur Reflexion"}
                      </a>
                    )
                  }
                  if (habit.key === "said-no") {
                    return (
                      <span key={habit.key} className="inline-flex overflow-hidden rounded-full border border-border">
                        <button
                          type="button"
                          onClick={() => incrementDeclines(today)}
                          className="inline-flex min-h-11 items-center bg-card px-4 text-sm font-medium hover:bg-muted"
                        >
                          {labelFor(habit, count, state.settings.decisionBudget, declines)}
                        </button>
                        {declines > 0 ? (
                          <button
                            type="button"
                            onClick={() => decrementDeclines(today)}
                            className="min-h-11 border-l border-border px-3 text-sm text-muted-foreground hover:bg-muted"
                            aria-label="Letztes Nein zurücknehmen"
                          >
                            −
                          </button>
                        ) : null}
                      </span>
                    )
                  }
                  const done = isHabitDone(state, habit.key, today)
                  const warn = habit.key === "decision-budget" && over
                  return (
                    <HabitToggle
                      key={habit.key}
                      pressed={done && !warn}
                      warn={warn}
                      label={warn ? "Budget überzogen" : labelFor(habit, count, state.settings.decisionBudget, declines)}
                      onClick={() => {
                        if (warn) return
                        press(habit.key)
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
