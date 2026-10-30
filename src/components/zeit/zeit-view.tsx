"use client"

import { useState } from "react"
import { PageIntro } from "@/components/page-intro"
import { useFocus } from "@/components/focus-provider"
import { TimeForm } from "@/components/zeit/time-form"
import { TimeList } from "@/components/zeit/time-list"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { addDays, parseISODate, startOfISOWeek, toISODate } from "@/lib/dates"
import { formatMinutes } from "@/lib/format"
import { summarize } from "@/lib/stats"
import type { TimeBlock } from "@/lib/types"

type Filter = "today" | "week" | "all"

export function ZeitView() {
  const { state, today } = useFocus()
  const [filter, setFilter] = useState<Filter>("week")
  const [editing, setEditing] = useState<TimeBlock | null>(null)
  const weekStart = toISODate(startOfISOWeek(parseISODate(today)))
  const weekEnd = toISODate(addDays(parseISODate(weekStart), 6))
  const blocks = state.timeBlocks.filter((block) => {
    if (filter === "today") return block.date === today
    if (filter === "week") return block.date >= weekStart && block.date <= weekEnd
    return true
  })
  const summary = summarize(
    blocks,
    filter === "all" ? "0000-01-01" : filter === "today" ? today : weekStart,
    filter === "all" ? "9999-12-31" : filter === "today" ? today : weekEnd,
  )

  return (
    <div>
      <PageIntro
        eyebrow="Zeiterfassung"
        title="Blöcke, nicht Bauchgefühl"
        lede="Trag Beginn und Ende oder nur die Dauer ein und ordne den Block zu. Strategisch ist gestaltend, operativ ist reagierend."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6">
          <TimeForm today={today} editing={editing} onCancel={() => setEditing(null)} />
        </div>
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
              <TabsList className="h-10">
                <TabsTrigger value="today" className="px-3">
                  Heute
                </TabsTrigger>
                <TabsTrigger value="week" className="px-3">
                  Diese Woche
                </TabsTrigger>
                <TabsTrigger value="all" className="px-3">
                  Alle
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-sm text-muted-foreground">
              {blocks.length} Blöcke · {formatMinutes(summary.strategicMinutes)} strategisch ·{" "}
              {formatMinutes(summary.operationalMinutes)} operativ
            </p>
          </div>
          <TimeList
            blocks={blocks}
            editingId={editing?.id ?? null}
            onEdit={(block) => {
              setEditing((current) => (current?.id === block.id ? null : block))
              document.getElementById("inhalt")?.scrollIntoView({ block: "start" })
            }}
          />
        </div>
      </div>
    </div>
  )
}
