"use client"

import { Check } from "lucide-react"
import { useFocus } from "@/components/focus-provider"
import { addDays, parseISODate, toISODate } from "@/lib/dates"
import { formatLongDate, formatWeekdayShort } from "@/lib/format"
import { importantCount, isModuleHabitDone } from "@/lib/modules"
import type { ModuleHabitKind } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ModuleWeek({
  kind,
  weekStart,
  today,
}: {
  kind: ModuleHabitKind
  weekStart: string
  today: string
}) {
  const { state, setModuleHabit } = useFocus()
  const days = Array.from({ length: 7 }, (_, index) => toISODate(addDays(parseISODate(weekStart), index)))
  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {days.map((date) => {
        const done = isModuleHabitDone(state, kind, date)
        const future = date > today
        const over = kind === "decision-budget" && importantCount(state, date) > state.settings.decisionBudget
        return (
          <button
            key={date}
            type="button"
            disabled={future}
            aria-pressed={done && !over}
            aria-label={`${formatLongDate(date)} ${over ? "Budget überzogen" : done ? "gehalten" : "nicht gehalten"}`}
            onClick={() => setModuleHabit(kind, date, over ? false : !done)}
            className="flex flex-col items-center gap-1 disabled:opacity-40"
          >
            <span
              className={cn(
                "grid size-10 place-items-center rounded-full border text-sm sm:size-11",
                done && !over && "border-[#1f6f5b] bg-[#1f6f5b] text-white",
                over && "border-[#e4c2b6] bg-[#f8ebe6] text-lag",
                !done && !over && "border-border bg-background",
                date === today && "ring-2 ring-[#1f6f5b] ring-offset-2 ring-offset-card",
              )}
            >
              {done && !over ? <Check className="size-4" aria-hidden="true" /> : parseISODate(date).getDate()}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatWeekdayShort(date)}</span>
          </button>
        )
      })}
    </div>
  )
}
