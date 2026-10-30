"use client"

import { useState } from "react"
import Link from "next/link"
import { HabitStrip } from "@/components/dashboard/habit-strip"
import { Heatmap } from "@/components/dashboard/heatmap"
import { HeroMetric } from "@/components/dashboard/hero-metric"
import { ReflectionChart } from "@/components/dashboard/reflection-chart"
import { TrendChart } from "@/components/dashboard/trend-chart"
import { useFocus } from "@/components/focus-provider"
import { WeekSwitcher } from "@/components/week-switcher"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { addDays, isoWeekNumber, parseISODate, toISODate, weekStartOffset } from "@/lib/dates"
import { formatLongDate, formatMinutes, formatTimeRange, formatWeekRange } from "@/lib/format"
import { buildInsights, summarize, weekSeries } from "@/lib/stats"
import { CategoryPill } from "@/components/category-pill"

export function DashboardView() {
  const { state, today, hasDemo, loadDemo } = useFocus()
  const [offset, setOffset] = useState(0)
  const weekStart = weekStartOffset(parseISODate(today), offset)
  const weekEnd = toISODate(addDays(parseISODate(weekStart), 6))
  const summary = summarize(state.timeBlocks, weekStart, weekEnd)
  const trend = weekSeries(state.timeBlocks, weekStart, 8)
  const previousStart = toISODate(addDays(parseISODate(weekStart), -7))
  const previous = summarize(state.timeBlocks, previousStart, toISODate(addDays(parseISODate(previousStart), 6)))
  const insights = buildInsights(summary, trend)
  const reflectionFrom = toISODate(addDays(parseISODate(weekStart), -21))
  const reflectionTo = weekEnd < today ? weekEnd : today
  const reflections = state.reflections.filter(
    (reflection) => reflection.date >= reflectionFrom && reflection.date <= reflectionTo,
  )
  const weekBlocks = state.timeBlocks
    .filter((block) => block.date >= weekStart && block.date <= weekEnd && block.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || (a.start ?? "").localeCompare(b.start ?? ""))
  const hasBlocks = state.timeBlocks.length > 0
  const current = offset === 0
  const unfinished = current && today < weekEnd
  const weekNumber = isoWeekNumber(parseISODate(weekStart))

  return (
    <div className="space-y-6">
      <WeekSwitcher
        title={`KW ${weekNumber} · ${formatWeekRange(weekStart, weekEnd)}`}
        detail={current ? "Aktuelle Woche" : "Vergangene Woche"}
        onPrevious={() => setOffset((value) => Math.max(-26, value - 1))}
        onNext={() => setOffset((value) => Math.min(0, value + 1))}
        previousDisabled={offset <= -26}
        nextDisabled={offset >= 0}
      />

      {summary.totalMinutes === 0 ? (
        <article className="rounded-3xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
          <h1 className="font-serif text-4xl tracking-tight text-balance">Keine Zeiten in dieser Woche</h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground text-pretty">
            {hasBlocks
              ? "Für diese Woche ist noch nichts erfasst. Andere Wochen bleiben in der Verlaufsgrafik sichtbar."
              : "Trag den ersten Block ein. Schon wenige Tage machen sichtbar, wie viel Zeit wirklich gestaltend ist — und wie viel nur reagiert."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href="/zeit" />} className="h-10 px-4">
              Zeit erfassen
            </Button>
            {!hasDemo ? (
              <Button type="button" variant="outline" className="h-10 bg-card px-4" onClick={loadDemo}>
                Demodaten laden
              </Button>
            ) : null}
          </div>
        </article>
      ) : (
        <HeroMetric
          summary={summary}
          targetPercent={state.settings.targetPercent}
          insights={insights}
          previousPercent={previous.percent}
          unfinished={unfinished}
          current={current}
        />
      )}

      {summary.totalMinutes > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="text-base">
            <CardHeader>
              <CardDescription>Strategisch</CardDescription>
              <p className="font-serif text-3xl tabular-nums">{formatMinutes(summary.strategicMinutes)}</p>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{summary.strategicCount} Blöcke</CardContent>
          </Card>
          <Card className="text-base">
            <CardHeader>
              <CardDescription>Operativ</CardDescription>
              <p className="font-serif text-3xl tabular-nums">{formatMinutes(summary.operationalMinutes)}</p>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{summary.operationalCount} Blöcke</CardContent>
          </Card>
          <Card className="text-base">
            <CardHeader>
              <CardDescription>Längster strategischer Block</CardDescription>
              <p className="font-serif text-3xl tabular-nums">
                {summary.longestStrategic ? formatMinutes(summary.longestStrategic.durationMinutes) : "–"}
              </p>
            </CardHeader>
            <CardContent className="line-clamp-2 text-sm text-muted-foreground">
              {summary.longestStrategic
                ? `${formatLongDate(summary.longestStrategic.date)}${summary.longestStrategic.note ? ` · ${summary.longestStrategic.note}` : ""}`
                : "In dieser Woche kein strategischer Block."}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {hasBlocks ? (
        <Card className="text-base">
          <CardHeader>
            <h2 className="font-serif text-2xl tracking-tight">Wochenverlauf</h2>
            <CardDescription>Acht Wochen bis zur gewählten Woche. Säulen sind Stunden, die Linie ist der strategische Anteil.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart weeks={trend} targetPercent={state.settings.targetPercent} />
          </CardContent>
        </Card>
      ) : null}

      {hasBlocks ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="text-base lg:col-span-3">
            <CardHeader>
              <h2 className="font-serif text-2xl tracking-tight">Strategische Zeit</h2>
              <CardDescription>Jeder Tag der letzten acht Wochen. Satter heißt mehr gestaltende Minuten.</CardDescription>
            </CardHeader>
            <CardContent>
              <Heatmap blocks={state.timeBlocks} endWeekStart={weekStart} today={today} />
            </CardContent>
          </Card>
          <Card className="text-base lg:col-span-2">
            <CardHeader>
              <h2 className="font-serif text-2xl tracking-tight">Reflexion</h2>
              <CardDescription>Vier Wochen: eher reagiert oder eher gestaltet.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReflectionChart reflections={reflections} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-serif text-2xl tracking-tight">Aktuelle Serien</h2>
          <Link href="/fokus" className="text-sm font-medium text-strategic underline-offset-4 hover:underline">
            Gewohnheiten öffnen
          </Link>
        </div>
        <HabitStrip state={state} today={today} />
      </section>

      {weekBlocks.length > 0 ? (
        <Card className="text-base">
          <CardHeader>
            <h2 className="font-serif text-2xl tracking-tight">Blöcke dieser Woche</h2>
            <CardDescription>Die Einträge, aus denen der Anteil entsteht.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {weekBlocks.slice(0, 8).map((block) => (
                <li key={block.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{block.note || "Ohne Notiz"}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatLongDate(block.date)}
                      {formatTimeRange(block.start, block.end) ? ` · ${formatTimeRange(block.start, block.end)}` : ""}
                      {" · "}
                      {formatMinutes(block.durationMinutes)}
                    </p>
                  </div>
                  <CategoryPill category={block.category} />
                </li>
              ))}
            </ul>
            {weekBlocks.length > 8 ? (
              <Button nativeButton={false} render={<Link href="/zeit" />} variant="outline" className="mt-3 h-10 bg-card px-4">
                Alle Blöcke in der Zeiterfassung
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
