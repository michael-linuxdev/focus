"use client"

import { useState } from "react"
import { EveningRitual } from "@/components/dashboard/evening-ritual"
import { HabitToggle } from "@/components/habit-toggle"
import { ModuleWeek } from "@/components/module-week"
import { PageIntro } from "@/components/page-intro"
import { WeekSwitcher } from "@/components/week-switcher"
import { useFocus } from "@/components/focus-provider"
import { addDays, parseISODate, startOfISOWeek, toISODate, weekStartOffset } from "@/lib/dates"
import { formatWeekdayShort, formatWeekRange } from "@/lib/format"
import {
  declinesOn,
  energyOn,
  habitsFor,
  isHabitDone,
  isModuleHabitKind,
  MESSAGE_WINDOW_PRESETS,
} from "@/lib/modules"
import { cn } from "@/lib/utils"

export function GrenzenView() {
  const { state, today, incrementDeclines, decrementDeclines, updateSettings, toggleModuleHabit } = useFocus()
  const [offset, setOffset] = useState(0)
  const weekStart = weekStartOffset(parseISODate(today), offset)
  const todayCount = declinesOn(state, today)
  const currentWeek = toISODate(startOfISOWeek(parseISODate(today)))
  const weekCount = state.declines
    .filter((entry) => entry.date >= currentWeek && entry.date <= today)
    .reduce((sum, entry) => sum + entry.count, 0)
  const total = state.declines.reduce((sum, entry) => sum + entry.count, 0)
  const lows = state.energyLogs.filter((entry) => entry.level <= 2 && entry.date <= today).map((entry) => entry.date)
  const latestLow = [...lows].sort().at(-1)
  const recovered =
    !latestLow || state.moduleHabits.some((habit) => habit.kind === "recovery" && habit.done && habit.date >= latestLow)
  const days = Array.from({ length: 7 }, (_, index) => toISODate(addDays(parseISODate(weekStart), index)))

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Grenzen & Energie"
        title="Der Tag braucht ein Ende"
        lede="Laptop zu, Nachrichten nur in festen Fenstern, Erholung nach intensiven Phasen — und ein klares Nein, wenn ein Termin nichts trägt."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[2rem] bg-[#1c2433] px-6 py-7 text-[#f6f1ea]">
          <p className="text-[11px] tracking-[0.18em] text-[#e7b3a2]">NEIN GESAGT</p>
          <h2 className="mt-2 font-serif text-4xl tracking-tight text-balance">Was du ablehnst, schützt den Tag</h2>
          <p className="mt-5 font-serif text-8xl tabular-nums leading-none">{todayCount}</p>
          <p className="mt-3 text-sm text-white/65">
            heute · {weekCount} diese Woche · {total} insgesamt
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => incrementDeclines(today)}
              className="inline-flex h-14 items-center rounded-2xl bg-[#c4785a] px-5 text-base font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              + Nein gesagt
            </button>
            <button
              type="button"
              onClick={() => decrementDeclines(today)}
              disabled={todayCount === 0}
              className="inline-flex h-14 items-center rounded-2xl bg-white/10 px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              Zurücknehmen
            </button>
          </div>
        </section>
        <EveningRitual prominent />
      </div>

      <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl tracking-tight">Heute halten</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ein Tipp. Der Palast lässt den Raum stehen, auch wenn ein Tag ausfällt.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {habitsFor("boundaries").map((habit) => {
            const key = habit.key
            if (key === "said-no") return null
            const done = isHabitDone(state, key, today)
            if (!isModuleHabitKind(key)) return null
            return (
              <HabitToggle
                key={key}
                pressed={done}
                label={habit.short}
                onClick={() => toggleModuleHabit(key, today)}
              />
            )
          })}
        </div>
        {latestLow && !recovered ? (
          <p className="mt-4 rounded-2xl bg-[#f8ebe6] px-4 py-3 text-sm text-pretty">
            Zuletzt war die Energie dünn. Eine Erholung holt den Garten im Palast aus dem Staub.
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
        <WeekSwitcher
          title={formatWeekRange(weekStart, toISODate(addDays(parseISODate(weekStart), 6)))}
          detail="Abendritual und Nachrichtenfenster"
          onPrevious={() => setOffset((value) => Math.max(-26, value - 1))}
          onNext={() => setOffset((value) => Math.min(0, value + 1))}
          previousDisabled={offset <= -26}
          nextDisabled={offset >= 0}
        />
        <div className="mt-5 space-y-5">
          <div>
            <h3 className="text-sm font-medium">Abendritual</h3>
            <div className="mt-3">
              <ModuleWeek kind="shutdown" weekStart={weekStart} today={today} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium">Nachrichtenfenster</h3>
            <p className="mt-1 text-sm text-muted-foreground">{state.settings.messageWindows}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {MESSAGE_WINDOW_PRESETS.map((preset) => {
                const selected = state.settings.messageWindows === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updateSettings({ messageWindows: preset })}
                    className={cn(
                      "min-h-10 rounded-full border px-3 text-sm",
                      selected ? "border-[#c4785a] bg-[#f8ebe6]" : "border-border bg-background",
                    )}
                  >
                    {preset}
                  </button>
                )
              })}
            </div>
            <div className="mt-3">
              <ModuleWeek kind="message-windows" weekStart={weekStart} today={today} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
        <h2 className="font-serif text-2xl tracking-tight">Energie der Woche</h2>
        <p className="mt-1 text-sm text-muted-foreground">Der Schieber im Abendritual setzt den heutigen Wert.</p>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {days.map((date) => {
            const level = date <= today ? energyOn(state, date) : null
            return (
              <div key={date} className="flex flex-col items-center gap-2">
                <div className="flex h-24 w-full items-end rounded-xl bg-muted">
                  <div
                    className="w-full rounded-xl bg-[#c4785a]"
                    style={{ height: level ? `${level * 20}%` : "8%", opacity: level ? 1 : 0.35 }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">{formatWeekdayShort(date)}</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
