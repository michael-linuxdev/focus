import Link from "next/link"
import { checkedCount, dailyHabitStreak, isDailyHabitDone, prioritiesForWeek, priorityStreak, reflectionOn } from "@/lib/habits"
import { reflectionLabel } from "@/lib/labels"
import { parseISODate, startOfISOWeek, toISODate } from "@/lib/dates"
import type { AppState } from "@/lib/types"

function Mini({
  title,
  value,
  detail,
}: {
  title: string
  value: string
  detail: string
}) {
  return (
    <Link
      href="/fokus"
      className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-2 font-serif text-3xl tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </Link>
  )
}

export function HabitStrip({ state, today }: { state: AppState; today: string }) {
  const strategy = dailyHabitStreak(state, "strategy-block", today)
  const deep = dailyHabitStreak(state, "deep-work", today)
  const priorities = priorityStreak(state, today)
  const weekStart = toISODate(startOfISOWeek(parseISODate(today)))
  const week = prioritiesForWeek(state, weekStart)
  const reflection = reflectionOn(state, today)
  const strategyToday = isDailyHabitDone(state, "strategy-block", today)
  const deepToday = isDailyHabitDone(state, "deep-work", today)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Mini
        title="Strategie-Block"
        value={`${strategy.current}`}
        detail={strategyToday ? `Tage in Serie · heute gehalten · Bestwert ${strategy.best}` : `Tage in Serie · heute offen · Bestwert ${strategy.best}`}
      />
      <Mini
        title="Deep Work vor 10 Uhr"
        value={`${deep.current}`}
        detail={deepToday ? `Tage in Serie · heute gehalten · Bestwert ${deep.best}` : `Tage in Serie · heute offen · Bestwert ${deep.best}`}
      />
      <Mini
        title="Top 3 der Woche"
        value={`${priorities.current}`}
        detail={`Wochen definiert · ${checkedCount(week)} von 3 erledigt`}
      />
      <Mini
        title="Tagesreflexion"
        value={reflection ? String(reflection.score) : "–"}
        detail={reflection ? reflectionLabel(reflection.score) : "Heute noch offen"}
      />
    </div>
  )
}
