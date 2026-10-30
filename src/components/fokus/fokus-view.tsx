"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { PageIntro } from "@/components/page-intro"
import { WeekSwitcher } from "@/components/week-switcher"
import { useFocus } from "@/components/focus-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { addDays, parseISODate, startOfISOWeek, toISODate, weekStartOffset } from "@/lib/dates"
import { formatLongDate, formatMinutes, formatWeekRange, formatWeekdayShort } from "@/lib/format"
import {
  checkedCount,
  dailyHabitStreak,
  isDailyHabitDone,
  isWeekDefined,
  prioritiesForWeek,
  priorityStreak,
  reflectionOn,
} from "@/lib/habits"
import { REFLECTION_SCALE } from "@/lib/labels"
import { deepWorkCandidates, strategyCandidates } from "@/lib/stats"
import type { DailyHabitKind, ReflectionScore } from "@/lib/types"
import { cn } from "@/lib/utils"

function DayStrip({
  kind,
  weekStart,
  today,
}: {
  kind: DailyHabitKind
  weekStart: string
  today: string
}) {
  const { state, toggleDailyHabit } = useFocus()
  const days = Array.from({ length: 7 }, (_, index) => toISODate(addDays(parseISODate(weekStart), index)))
  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {days.map((date) => {
        const done = isDailyHabitDone(state, kind, date)
        const future = date > today
        const isToday = date === today
        return (
          <button
            key={date}
            type="button"
            disabled={future}
            aria-pressed={done}
            aria-label={`${formatLongDate(date)} ${done ? "gehalten" : "nicht gehalten"}`}
            onClick={() => toggleDailyHabit(kind, date)}
            className="flex flex-col items-center gap-1 disabled:opacity-40"
          >
            <span
              className={cn(
                "grid size-10 place-items-center rounded-full border text-sm sm:size-11",
                done ? "border-strategic bg-strategic text-white" : "border-border bg-background",
                isToday && "ring-2 ring-strategic ring-offset-2 ring-offset-card",
              )}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : parseISODate(date).getDate()}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatWeekdayShort(date)}</span>
          </button>
        )
      })}
    </div>
  )
}

function DailyCard({
  kind,
  title,
  description,
  weekStart,
  today,
  evidence,
}: {
  kind: DailyHabitKind
  title: string
  description: string
  weekStart: string
  today: string
  evidence: string | null
}) {
  const { state, toggleDailyHabit } = useFocus()
  const streak = dailyHabitStreak(state, kind, today)
  const done = isDailyHabitDone(state, kind, today)
  const viewingCurrent = weekStart === toISODate(startOfISOWeek(parseISODate(today)))
  return (
    <article className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>
        </div>
        <p className="text-right">
          <span className="block font-serif text-4xl tabular-nums leading-none">{streak.current}</span>
          <span className="text-xs text-muted-foreground">Tage Serie</span>
        </p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Bestwert {streak.best} Tage</p>
      <div className="mt-5">
        <DayStrip kind={kind} weekStart={weekStart} today={today} />
      </div>
      {viewingCurrent ? (
        <div className="mt-5 space-y-3">
          {evidence && !done ? (
            <p className="rounded-xl bg-accent px-3 py-2 text-sm text-pretty">{evidence}</p>
          ) : null}
          {done && !evidence ? (
            <p className="text-sm text-muted-foreground">Heute manuell markiert. In der Zeiterfassung liegt kein passender Block.</p>
          ) : null}
          {done && evidence ? <p className="text-sm text-muted-foreground">Heute gehalten, passend zur Zeiterfassung.</p> : null}
          <Button type="button" className="h-11 px-4" variant={done ? "outline" : "default"} onClick={() => toggleDailyHabit(kind, today)}>
            {done ? "Markierung für heute zurücknehmen" : "Heute als gehalten markieren"}
          </Button>
        </div>
      ) : null}
    </article>
  )
}

export function FokusView() {
  const { state, today, saveWeeklyPriorities, saveReflection } = useFocus()
  const [habitOffset, setHabitOffset] = useState(0)
  const [priorityOffset, setPriorityOffset] = useState(0)
  const habitWeek = weekStartOffset(parseISODate(today), habitOffset)
  const priorityWeek = weekStartOffset(parseISODate(today), priorityOffset)
  const storedWeek = prioritiesForWeek(state, priorityWeek)
  const items = storedWeek?.items ?? (["", "", ""] as [string, string, string])
  const done = storedWeek?.done ?? ([false, false, false] as [boolean, boolean, boolean])
  const streak = priorityStreak(state, today)
  const reflection = reflectionOn(state, today)
  const reflectionKey = reflection?.id ?? `empty-${today}`
  const [noteDraft, setNoteDraft] = useState(reflection?.note ?? "")
  const [seenReflection, setSeenReflection] = useState(reflectionKey)
  if (seenReflection !== reflectionKey) {
    setSeenReflection(reflectionKey)
    setNoteDraft(reflection?.note ?? "")
  }
  const strategyEvidence = strategyCandidates(state.timeBlocks, today, state.settings.strategyBlockMinutes)[0]
  const deepEvidence = deepWorkCandidates(state.timeBlocks, today)[0]
  const recentReflections = [...state.reflections].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)

  function updatePriority(index: number, value: string) {
    const next: [string, string, string] = [items[0], items[1], items[2]]
    next[index] = value
    const nextDone: [boolean, boolean, boolean] = [done[0], done[1], done[2]]
    if (value.trim().length === 0) nextDone[index] = false
    saveWeeklyPriorities(priorityWeek, next, nextDone)
  }

  function togglePriority(index: number, checked: boolean) {
    if (items[index].trim().length === 0) return
    const nextDone: [boolean, boolean, boolean] = [done[0], done[1], done[2]]
    nextDone[index] = checked
    saveWeeklyPriorities(priorityWeek, [items[0], items[1], items[2]], nextDone)
  }

  function chooseScore(score: ReflectionScore) {
    saveReflection(today, score, noteDraft)
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fokus"
        title="Vier Gewohnheiten, die Zeit schützen"
        lede="Ein ungestörter Block, ein Vormittag vor den Terminen, drei Prioritäten in der Woche und eine ehrliche Frage am Abend."
      />

      <WeekSwitcher
        title={formatWeekRange(habitWeek, toISODate(addDays(parseISODate(habitWeek), 6)))}
        detail="Tage antippen, um die Serie nachzutragen"
        onPrevious={() => setHabitOffset((value) => value - 1)}
        onNext={() => setHabitOffset((value) => Math.min(0, value + 1))}
        previousDisabled={habitOffset <= -26}
        nextDisabled={habitOffset >= 0}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <DailyCard
          kind="strategy-block"
          title="Strategie-Block"
          description={`Ziel: ${formatMinutes(state.settings.strategyBlockMinutes)} am Stück, ungestört. Die Länge stellst du in den Einstellungen ein.`}
          weekStart={habitWeek}
          today={today}
          evidence={
            strategyEvidence
              ? `In der Zeiterfassung liegt heute ein strategischer Block von ${formatMinutes(strategyEvidence.durationMinutes)}${strategyEvidence.note ? `: ${strategyEvidence.note}` : ""}.`
              : null
          }
        />
        <DailyCard
          kind="deep-work"
          title="Deep Work vor 10 Uhr"
          description="Ein strategischer Block, der vor 10:00 Uhr beginnt — bevor der Tag in Termine kippt."
          weekStart={habitWeek}
          today={today}
          evidence={
            deepEvidence
              ? `Heute beginnt ein strategischer Block um ${deepEvidence.start} Uhr${deepEvidence.note ? `: ${deepEvidence.note}` : ""}.`
              : null
          }
        />
      </div>

      <article className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl tracking-tight">Top 3 der Woche</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground text-pretty">
              Die Gewohnheit ist, drei Prioritäten festzulegen. Das Abhaken zeigt, ob die Woche ihnen auch gefolgt ist.
            </p>
          </div>
          <p className="text-right">
            <span className="block font-serif text-4xl tabular-nums leading-none">{streak.current}</span>
            <span className="text-xs text-muted-foreground">Wochen definiert</span>
          </p>
        </div>
        <div className="mt-4">
          <WeekSwitcher
            title={formatWeekRange(priorityWeek, toISODate(addDays(parseISODate(priorityWeek), 6)))}
            detail={isWeekDefined(storedWeek) ? `${checkedCount(storedWeek)} von 3 erledigt` : "Noch nicht vollständig benannt"}
            onPrevious={() => setPriorityOffset((value) => value - 1)}
            onNext={() => setPriorityOffset((value) => Math.min(0, value + 1))}
            previousDisabled={priorityOffset <= -26}
            nextDisabled={priorityOffset >= 0}
          />
        </div>
        {storedWeek?.demo ? (
          <Badge variant="outline" className="mt-4">
            Demo
          </Badge>
        ) : null}
        <ol className="mt-4 space-y-3">
          {items.map((item, index) => {
            const id = `priority-${priorityWeek}-${index}`
            return (
              <li key={id} className="flex items-center gap-3">
                <Checkbox
                  id={`${id}-check`}
                  checked={done[index]}
                  disabled={item.trim().length === 0 || priorityWeek > toISODate(startOfISOWeek(parseISODate(today)))}
                  onCheckedChange={(checked) => togglePriority(index, checked)}
                  aria-label={`Priorität ${index + 1} erledigt`}
                  className="size-5"
                />
                <Label htmlFor={id} className="sr-only">
                  Priorität {index + 1}
                </Label>
                <Input
                  id={id}
                  value={item}
                  maxLength={120}
                  placeholder={`Priorität ${index + 1}`}
                  onChange={(event) => updatePriority(index, event.target.value)}
                  className="h-10 bg-background text-base md:text-base"
                />
              </li>
            )
          })}
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">Bestwert {streak.best} Wochen. Eine Woche zählt, sobald alle drei Felder gefüllt sind.</p>
      </article>

      <article className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
        <h2 className="font-serif text-2xl tracking-tight text-balance">Habe ich heute eher reagiert oder gestaltet?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Eine schnelle Einordnung, keine Rechtfertigung.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Tagesreflexion">
          {REFLECTION_SCALE.map((level) => {
            const selected = reflection?.score === level.score
            return (
              <button
                key={level.score}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => chooseScore(level.score)}
                className={cn(
                  "rounded-xl border px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  selected ? "border-strategic bg-[#e7f3ef]" : "border-border bg-background hover:bg-muted",
                )}
              >
                <span className="block font-serif text-2xl tabular-nums">{level.score}</span>
                <span className="mt-1 block text-sm font-medium">{level.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{level.hint}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="reflection-note">Notiz, optional</Label>
          <Textarea
            id="reflection-note"
            value={noteDraft}
            maxLength={280}
            placeholder="Was hat den Tag in die eine oder andere Richtung gezogen?"
            onChange={(event) => {
              const value = event.target.value
              setNoteDraft(value)
              if (reflection) saveReflection(today, reflection.score, value)
            }}
            className="min-h-24 bg-background text-base md:text-base"
          />
          {!reflection ? <p className="text-sm text-muted-foreground">Wähle zuerst eine Stufe, dann bleibt auch die Notiz gespeichert.</p> : null}
        </div>
        {recentReflections.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-sm font-medium">Zuletzt</h3>
            <ul className="mt-2 divide-y divide-border">
              {recentReflections.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {formatLongDate(entry.date)} · {entry.score} {REFLECTION_SCALE.find((level) => level.score === entry.score)?.label}
                    </p>
                    {entry.note ? <p className="text-sm text-muted-foreground">{entry.note}</p> : null}
                  </div>
                  {entry.demo ? <Badge variant="outline">Demo</Badge> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>
    </div>
  )
}
