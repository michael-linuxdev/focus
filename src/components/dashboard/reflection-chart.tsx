"use client"

import { formatShortDay } from "@/lib/format"
import { reflectionLabel } from "@/lib/labels"
import type { Reflection, ReflectionScore } from "@/lib/types"
import { usePrefersReducedMotion } from "@/components/use-reduced-motion"
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface Point {
  date: string
  label: string
  score: ReflectionScore
  note: string
}

function ReflectionTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: Point }>
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="max-w-56 rounded-xl bg-foreground px-3 py-2 text-xs text-background shadow-lg">
      <p className="font-medium">{point.label}</p>
      <p className="mt-1">{reflectionLabel(point.score)}</p>
      {point.note ? <p className="mt-1 text-background/80">{point.note}</p> : null}
    </div>
  )
}

const TICKS: Record<number, string> = {
  1: "reagiert",
  3: "gemischt",
  5: "gestaltet",
}

export function ReflectionChart({ reflections }: { reflections: Reflection[] }) {
  const reduce = usePrefersReducedMotion()
  const points: Point[] = [...reflections]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((reflection) => ({
      date: reflection.date,
      label: formatShortDay(reflection.date),
      score: reflection.score,
      note: reflection.note,
    }))

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">In diesem Zeitraum liegt noch keine Reflexion.</p>
  }

  return (
    <figure>
      <figcaption className="sr-only">
        Verlauf der Tagesreflexion von stark reagiert bis klar gestaltet.
      </figcaption>
      <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e7e0d4" />
            <XAxis dataKey="label" tick={{ fill: "#6f675c", fontSize: 12 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 3, 5]}
              width={72}
              tick={{ fill: "#6f675c", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => TICKS[value] ?? ""}
            />
            <Tooltip content={<ReflectionTooltip />} />
            <ReferenceLine y={3} stroke="#e7e0d4" />
            <Line
              dataKey="score"
              stroke="var(--strategic)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--strategic)" }}
              isAnimationActive={!reduce}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
