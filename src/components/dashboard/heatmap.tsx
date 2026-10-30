"use client"

import { useState } from "react"
import { addDays, parseISODate, toISODate } from "@/lib/dates"
import { formatLongDate, formatMinutes, formatMonthShort } from "@/lib/format"
import { HEAT_COLORS, heatLevel } from "@/lib/stats"
import type { TimeBlock } from "@/lib/types"
import { cn } from "@/lib/utils"

const ROW_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

export function Heatmap({
  blocks,
  endWeekStart,
  today,
  weeks = 8,
}: {
  blocks: TimeBlock[]
  endWeekStart: string
  today: string
  weeks?: number
}) {
  const [active, setActive] = useState<string | null>(null)
  const end = parseISODate(endWeekStart)
  const columns = Array.from({ length: weeks }, (_, index) => {
    const start = addDays(end, -7 * (weeks - 1 - index))
    return toISODate(start)
  })

  const totals = new Map<string, { strategic: number; operational: number }>()
  for (const block of blocks) {
    const current = totals.get(block.date) ?? { strategic: 0, operational: 0 }
    if (block.category === "strategic") current.strategic += block.durationMinutes
    else current.operational += block.durationMinutes
    totals.set(block.date, current)
  }

  const activeDate = active
  const activeTotals = activeDate ? totals.get(activeDate) : undefined
  let detail = "Wähle einen Tag, um die strategische Zeit zu sehen."
  if (activeDate) {
    if (activeDate > today) detail = `${formatLongDate(activeDate)} liegt noch vor dir.`
    else if (!activeTotals) detail = `${formatLongDate(activeDate)}: nicht erfasst.`
    else if (activeTotals.strategic === 0) {
      detail = `${formatLongDate(activeDate)}: keine strategische Zeit, ${formatMinutes(activeTotals.operational)} operativ.`
    } else {
      detail = `${formatLongDate(activeDate)}: ${formatMinutes(activeTotals.strategic)} strategisch, ${formatMinutes(activeTotals.operational)} operativ.`
    }
  }

  return (
    <figure>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[36rem] gap-1"
          style={{ gridTemplateColumns: `2.5rem repeat(${weeks}, minmax(0, 1fr))` }}
        >
          <div />
          {columns.map((weekStart, index) => {
            const previous = index === 0 ? null : columns[index - 1]
            const showMonth = !previous || formatMonthShort(weekStart) !== formatMonthShort(previous)
            return (
              <div key={weekStart} className="truncate text-center text-[11px] text-muted-foreground">
                {showMonth ? formatMonthShort(weekStart) : ""}
              </div>
            )
          })}
          {ROW_LABELS.map((label, dayIndex) => (
            <div key={label} className="contents">
              <div className="flex items-center text-xs text-muted-foreground">{label}</div>
              {columns.map((weekStart) => {
                const date = toISODate(addDays(parseISODate(weekStart), dayIndex))
                const future = date > today
                const logged = totals.get(date)
                const strategic = logged?.strategic ?? 0
                const level = heatLevel(strategic)
                const labelText = future
                  ? `${formatLongDate(date)}, noch nicht erreicht`
                  : !logged
                    ? `${formatLongDate(date)}, nicht erfasst`
                    : `${formatLongDate(date)}, ${formatMinutes(strategic)} strategisch`
                return (
                  <button
                    key={date}
                    type="button"
                    className={cn(
                      "aspect-square w-full rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      future && "border border-dashed border-border bg-transparent",
                      !future && !logged && "ring-1 ring-inset ring-border",
                      active === date && "outline-2 outline-offset-2 outline-foreground",
                    )}
                    style={!future && logged ? { background: HEAT_COLORS[level] } : undefined}
                    aria-label={labelText}
                    aria-pressed={active === date}
                    onMouseEnter={() => setActive(date)}
                    onFocus={() => setActive(date)}
                    onClick={() => setActive(date)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 min-h-10 text-sm text-muted-foreground" aria-live="polite">
        {detail}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Weniger</span>
        {HEAT_COLORS.map((color) => (
          <span key={color} className="size-3 rounded-sm" style={{ background: color }} aria-hidden="true" />
        ))}
        <span>Mehr</span>
        <span className="ml-2 inline-flex items-center gap-1">
          <span className="size-3 rounded-sm ring-1 ring-inset ring-border" aria-hidden="true" />
          nicht erfasst
        </span>
      </div>
    </figure>
  )
}
