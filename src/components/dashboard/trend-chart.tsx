"use client"

import { formatHours, formatMinutes, formatPercent } from "@/lib/format"
import type { WeekBucket } from "@/lib/stats"
import { usePrefersReducedMotion } from "@/components/use-reduced-motion"
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: WeekBucket }>
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-xl bg-foreground px-3 py-2 text-xs text-background shadow-lg">
      <p className="font-medium">Woche ab {point.label}</p>
      <p className="mt-1">Strategisch {formatMinutes(point.strategicMinutes)}</p>
      <p>Operativ {formatMinutes(point.operationalMinutes)}</p>
      <p>{point.percent === null ? "Keine Zeiten" : `${formatPercent(point.percent)} % strategisch`}</p>
    </div>
  )
}

export function TrendChart({ weeks, targetPercent }: { weeks: WeekBucket[]; targetPercent: number }) {
  const reduce = usePrefersReducedMotion()
  const data = weeks.map((week) => ({
    ...week,
    strategicHours: week.strategicMinutes / 60,
    operationalHours: week.operationalMinutes / 60,
    percent: week.percent,
  }))

  return (
    <figure>
      <figcaption className="sr-only">
        Säulen zeigen strategische und operative Stunden je Woche, die Linie den strategischen Anteil. Das Ziel liegt bei{" "}
        {formatPercent(targetPercent)} Prozent.
      </figcaption>
      <div className="h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e7e0d4" />
            <XAxis dataKey="label" tick={{ fill: "#6f675c", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="hours"
              tick={{ fill: "#6f675c", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(value: number) => `${value}`}
            />
            <YAxis
              yAxisId="percent"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: "#6f675c", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(value: number) => `${value} %`}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: "rgba(28, 25, 23, 0.04)" }} />
            <Bar
              yAxisId="hours"
              dataKey="strategicHours"
              name="Strategisch"
              stackId="time"
              fill="var(--strategic)"
              isAnimationActive={!reduce}
              maxBarSize={36}
            />
            <Bar
              yAxisId="hours"
              dataKey="operationalHours"
              name="Operativ"
              stackId="time"
              fill="var(--operational)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={!reduce}
              maxBarSize={36}
            />
            <Line
              yAxisId="percent"
              dataKey="percent"
              name="Anteil"
              stroke="#173f36"
              strokeWidth={2}
              dot={{ r: 3, fill: "#173f36" }}
              connectNulls={false}
              isAnimationActive={!reduce}
            />
            <ReferenceLine
              yAxisId="percent"
              y={targetPercent}
              stroke="var(--lag)"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm bg-strategic" aria-hidden="true" /> Stunden strategisch
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm bg-operational" aria-hidden="true" /> Stunden operativ
        </li>
        <li className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-[#173f36]" aria-hidden="true" /> Anteil
        </li>
        <li className="flex items-center gap-2">
          <span className="h-0 w-4 border-t-2 border-dashed border-lag" aria-hidden="true" /> Ziel {formatPercent(targetPercent)} %
        </li>
      </ul>
      <table className="sr-only">
        <caption>Stunden und strategischer Anteil je Woche</caption>
        <thead>
          <tr>
            <th>Woche</th>
            <th>Strategisch</th>
            <th>Operativ</th>
            <th>Anteil</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.weekStart}>
              <td>{week.label}</td>
              <td>{formatHours(week.strategicMinutes)} Stunden</td>
              <td>{formatHours(week.operationalMinutes)} Stunden</td>
              <td>{week.percent === null ? "keine" : `${formatPercent(week.percent)} Prozent`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
