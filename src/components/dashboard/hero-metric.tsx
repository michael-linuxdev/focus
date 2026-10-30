"use client"

import { formatHours, formatMinutes, formatPercent, punkteLabel } from "@/lib/format"
import type { RangeSummary } from "@/lib/stats"
import { Cell, Pie, PieChart } from "recharts"

export function HeroMetric({
  summary,
  targetPercent,
  insights,
  previousPercent,
  unfinished,
  current,
}: {
  summary: RangeSummary
  targetPercent: number
  insights: string[]
  previousPercent: number | null
  unfinished: boolean
  current: boolean
}) {
  const percent = summary.percent ?? 0
  const rounded = Math.round(percent)
  const gap = targetPercent - rounded
  const slices = [
    { name: "Strategisch", value: summary.strategicMinutes, fill: "var(--strategic)" },
    { name: "Operativ", value: summary.operationalMinutes, fill: "var(--operational)" },
  ].filter((slice) => slice.value > 0)

  return (
    <article className="relative overflow-hidden rounded-3xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
      <div
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[oklch(0.93_0.03_165)] blur-2xl"
        aria-hidden="true"
      />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)] lg:items-center">
        <div>
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Ziel {formatPercent(targetPercent)} %
          </p>
          <h1 className="mt-3 text-balance">
            <span className="block font-serif text-6xl tracking-tight tabular-nums sm:text-7xl">{formatPercent(percent)} %</span>
            <span className="mt-2 block text-xl font-medium sm:text-2xl">
              deiner Zeit war {current ? (unfinished ? "bisher diese Woche" : "diese Woche") : "in dieser Woche"} strategisch
            </span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Bezogen auf die erfasste Zeit, nicht auf den Kalendertag.</p>
          <div
            className="relative mt-6 h-10"
            role="img"
            aria-label={`Strategischer Anteil ${formatPercent(percent)} Prozent, Ziel ${formatPercent(targetPercent)} Prozent`}
          >
            <div
              className="absolute top-0 text-[11px] font-medium text-lag"
              style={{ left: `${targetPercent}%`, transform: targetPercent > 85 ? "translateX(-100%)" : "translateX(-50%)" }}
            >
              Ziel
            </div>
            <div className="absolute top-5 h-2 w-full rounded-full bg-[#e7e1d6]">
              <div className="h-full rounded-full bg-strategic" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
            </div>
            <div className="absolute top-4 h-4 w-0.5 rounded-full bg-lag" style={{ left: `${targetPercent}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={
                gap > 0
                  ? "rounded-full bg-[#f8ebe6] px-3 py-1 text-sm font-medium text-lag"
                  : gap < 0
                    ? "rounded-full bg-[#e5f2ee] px-3 py-1 text-sm font-medium text-strategic"
                    : "rounded-full bg-secondary px-3 py-1 text-sm font-medium"
              }
            >
              {gap > 0
                ? `${punkteLabel(gap)} unter dem Ziel`
                : gap < 0
                  ? `${punkteLabel(gap)} über dem Ziel`
                  : "Auf dem Ziel"}
            </span>
            {previousPercent !== null ? (
              <span className="text-sm text-muted-foreground">Vorwoche {formatPercent(previousPercent)} %</span>
            ) : null}
          </div>
          {unfinished ? (
            <p className="mt-3 text-sm text-muted-foreground">Die Woche ist noch nicht vorbei. Der Anteil kann sich noch verschieben.</p>
          ) : null}
          {insights.length > 0 ? (
            <div className="mt-4 space-y-1.5 text-sm leading-6 text-pretty">
              {insights.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col">
          <div className="relative size-52">
            <PieChart width={208} height={208} accessibilityLayer>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={68}
                outerRadius={90}
                startAngle={90}
                endAngle={-270}
                stroke="transparent"
                paddingAngle={slices.length > 1 ? 2 : 0}
                isAnimationActive={false}
              >
                {slices.map((slice) => (
                  <Cell key={slice.name} fill={slice.fill} />
                ))}
              </Pie>
            </PieChart>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="font-serif text-3xl tabular-nums">{formatHours(summary.strategicMinutes)}</p>
                <p className="text-xs text-muted-foreground">Stunden strategisch</p>
              </div>
            </div>
          </div>
          <dl className="w-full space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-strategic" aria-hidden="true" />
                Strategisch
              </dt>
              <dd className="tabular-nums">{formatMinutes(summary.strategicMinutes)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-operational" aria-hidden="true" />
                Operativ
              </dt>
              <dd className="tabular-nums">{formatMinutes(summary.operationalMinutes)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  )
}
