"use client"

import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { HabitToggle } from "@/components/habit-toggle"
import { ModuleWeek } from "@/components/module-week"
import { PageIntro } from "@/components/page-intro"
import { WeekSwitcher } from "@/components/week-switcher"
import { useFocus } from "@/components/focus-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { addDays, parseISODate, toISODate, weekStartOffset } from "@/lib/dates"
import { formatLongDate, formatWeekRange } from "@/lib/format"
import { budgetRemaining, habitsFor, importantCount, isHabitDone, isModuleHabitKind, pendingReviews } from "@/lib/modules"
import type { DecisionImportance } from "@/lib/types"
import { cn } from "@/lib/utils"

const WEIGHTS: Array<{ id: DecisionImportance; label: string }> = [
  { id: "klein", label: "Klein" },
  { id: "wichtig", label: "Wichtig" },
  { id: "gross", label: "Groß" },
]

export function EntscheidungenView() {
  const {
    state,
    today,
    addDecision,
    deleteDecision,
    saveLearning,
    updateSettings,
    toggleModuleHabit,
  } = useFocus()
  const [offset, setOffset] = useState(0)
  const [title, setTitle] = useState("")
  const [importance, setImportance] = useState<DecisionImportance>("wichtig")
  const [sleptOn, setSleptOn] = useState(false)
  const [proContra, setProContra] = useState(false)
  const weekStart = weekStartOffset(parseISODate(today), offset)
  const count = importantCount(state, today)
  const remaining = budgetRemaining(state, today)
  const reviews = pendingReviews(state, today)
  const history = [...state.decisions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const over = remaining < 0

  function submit(event: FormEvent) {
    event.preventDefault()
    const ok = addDecision({ title, importance, sleptOn, proContra })
    if (!ok) return
    setTitle("")
    setSleptOn(false)
    setProContra(false)
    setImportance("wichtig")
    toast.success("Entscheidung festgehalten")
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Entscheidungs-Hygiene"
        title="Weniger entscheiden, besser entscheiden"
        lede="Eine Nacht darüber schlafen, ein kurzes Pro und Contra, ein Budget für den Tag und danach die Frage: Was habe ich gelernt?"
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <section className={cn("rounded-3xl p-5 ring-1 ring-foreground/10 sm:p-6 lg:col-span-2", over ? "bg-[#f8ebe6]" : "bg-card")}>
          <p className="text-sm text-muted-foreground">Wichtige Entscheidungen heute</p>
          <p className="mt-2 font-serif text-6xl tabular-nums tracking-tight">
            {count}
            <span className="text-3xl text-muted-foreground"> / {state.settings.decisionBudget}</span>
          </p>
          <p className="mt-2 text-sm text-pretty">
            {over
              ? "Über dem Budget. Weitere wichtige Entscheidungen wandern auf morgen."
              : remaining === 0
                ? "Budget ausgeschöpft. Kleine Dinge zählen nicht mit."
                : remaining === 1
                  ? "Noch eine wichtige Entscheidung. Kleine zählen nicht mit."
                  : `Noch ${remaining} wichtige Entscheidungen. Kleine zählen nicht mit.`}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 bg-background px-3"
              onClick={() => updateSettings({ decisionBudget: state.settings.decisionBudget - 1 })}
              disabled={state.settings.decisionBudget <= 1}
            >
              Budget −
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 bg-background px-3"
              onClick={() => updateSettings({ decisionBudget: state.settings.decisionBudget + 1 })}
              disabled={state.settings.decisionBudget >= 6}
            >
              Budget +
            </Button>
          </div>
        </section>

        <form onSubmit={submit} className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6 lg:col-span-3">
          <h2 className="font-serif text-2xl tracking-tight">Entscheidung notieren</h2>
          <label htmlFor="entscheidung-titel" className="mt-4 block text-sm font-medium">
            Worum geht es?
          </label>
          <Input
            id="entscheidung-titel"
            value={title}
            maxLength={140}
            required
            placeholder="Zum Beispiel: Preisstrategie Industrie"
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 h-11 bg-background text-base md:text-base"
          />
          <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Gewicht">
            {WEIGHTS.map((weight) => (
              <button
                key={weight.id}
                type="button"
                role="radio"
                aria-checked={importance === weight.id}
                onClick={() => setImportance(weight.id)}
                className={cn(
                  "h-10 rounded-full border px-4 text-sm font-medium",
                  importance === weight.id ? "border-[#8c6232] bg-[#f8f1e4] text-[#6d4c28]" : "border-border bg-background",
                )}
              >
                {weight.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <HabitToggle pressed={sleptOn} label="Eine Nacht geschlafen" onClick={() => setSleptOn((value) => !value)} />
            <HabitToggle pressed={proContra} label="Pro und Contra" onClick={() => setProContra((value) => !value)} />
          </div>
          <Button type="submit" className="mt-4 h-11 px-4">
            Festhalten
          </Button>
        </form>
      </div>

      {reviews.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl tracking-tight">Nachfassen</h2>
          <p className="text-sm text-muted-foreground">Ein Satz reicht: Was habe ich gelernt?</p>
          <ul className="space-y-3">
            {reviews.slice(0, 3).map((decision) => (
              <ReviewCard
                key={decision.id}
                id={decision.id}
                title={decision.title}
                date={decision.date}
                onSave={(learning) => {
                  saveLearning(decision.id, learning)
                  toast.success("Nachlese gespeichert")
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
        <h2 className="font-serif text-2xl tracking-tight">Heute im Flügel</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {habitsFor("decisions").map((habit) => {
            const key = habit.key
            const done = isHabitDone(state, key, today)
            const warn = key === "decision-budget" && over
            if (!isModuleHabitKind(key)) return null
            return (
              <HabitToggle
                key={key}
                pressed={done && !warn}
                warn={warn}
                label={warn ? "Budget überzogen" : habit.short}
                onClick={() => toggleModuleHabit(key, today)}
              />
            )
          })}
        </div>
        <div className="mt-6">
          <WeekSwitcher
            title={formatWeekRange(weekStart, toISODate(addDays(parseISODate(weekStart), 6)))}
            detail="Budget antippen, um einen Tag nachzutragen"
            onPrevious={() => setOffset((value) => Math.max(-26, value - 1))}
            onNext={() => setOffset((value) => Math.min(0, value + 1))}
            previousDisabled={offset <= -26}
            nextDisabled={offset >= 0}
          />
          <div className="mt-4">
            <ModuleWeek kind="decision-budget" weekStart={weekStart} today={today} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
        <h2 className="font-serif text-2xl tracking-tight">Zuletzt</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Noch keine Entscheidung notiert.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {history.slice(0, 12).map((decision) => (
              <li key={decision.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{decision.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatLongDate(decision.date)}
                    {" · "}
                    {decision.importance === "gross" ? "Groß" : decision.importance === "wichtig" ? "Wichtig" : "Klein"}
                    {decision.sleptOn ? " · Nacht" : ""}
                    {decision.proContra ? " · Pro/Contra" : ""}
                  </p>
                  {decision.learning ? <p className="mt-1 text-sm text-pretty">„{decision.learning}“</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  {decision.demo ? <Badge variant="outline">Demo</Badge> : null}
                  {decision.demo ? null : (
                    <button
                      type="button"
                      onClick={() => deleteDecision(decision.id)}
                      className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                    >
                      Entfernen
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ReviewCard({
  id,
  title,
  date,
  onSave,
}: {
  id: string
  title: string
  date: string
  onSave: (learning: string) => void
}) {
  const [learning, setLearning] = useState("")
  return (
    <li className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{formatLongDate(date)}</p>
      <label className="mt-3 block text-sm font-medium" htmlFor={`lernen-${id}`}>
        Was habe ich gelernt?
      </label>
      <Textarea
        id={`lernen-${id}`}
        value={learning}
        maxLength={280}
        placeholder="Ein Satz."
        onChange={(event) => setLearning(event.target.value)}
        className="mt-2 min-h-20 bg-background text-base md:text-base"
      />
      <Button
        type="button"
        className="mt-3 h-10 px-4"
        disabled={learning.trim().length === 0}
        onClick={() => onSave(learning)}
      >
        Notiz speichern
      </Button>
    </li>
  )
}
