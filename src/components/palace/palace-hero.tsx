"use client"

import Link from "next/link"
import { PalaceScene } from "@/components/palace/palace-scene"
import { useFocus } from "@/components/focus-provider"
import { buildPalace, type WingVisual } from "@/lib/palace"

const TONE = {
  waiting: "Grundriss",
  resting: "Verblasst",
  bright: "Hell",
} as const

const STREAK: Record<WingVisual["id"], string> = {
  focus: "Strategieblock",
  decisions: "Budget",
  boundaries: "Abendritual",
}

function WingLink({ wing }: { wing: WingVisual }) {
  return (
    <Link
      href={wing.href}
      className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-serif text-2xl tracking-tight">{wing.title}</p>
        <p className="text-[11px] tracking-[0.14em] text-white/55 uppercase">{TONE[wing.tone]}</p>
      </div>
      <p className="mt-1 text-sm text-white/70 text-pretty">{wing.caption}</p>
      {wing.best > 0 ? (
        <p className="mt-2 text-xs text-white/50">
          {STREAK[wing.id]}: Serie {wing.streak}, Bestwert {wing.best}
        </p>
      ) : null}
    </Link>
  )
}

export function PalaceHero() {
  const { state, today } = useFocus()
  const model = buildPalace(state, today)
  const wings = [model.wings.focus, model.wings.decisions, model.wings.boundaries]

  return (
    <section aria-labelledby="palast-titel" className="overflow-hidden rounded-[2rem] bg-[#101c19] text-[#f6f1ea]">
      <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-end sm:justify-between sm:px-7 sm:pt-6">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-[#d7efe6]/70">GEDANKENPALAST</p>
          <h2 id="palast-titel" className="mt-1 font-serif text-4xl tracking-tight text-balance">
            Ein Haus, drei Flügel
          </h2>
        </div>
        <p className="max-w-sm text-sm text-white/65 text-pretty">{model.summary}</p>
      </div>
      <PalaceScene model={model} />
      <div className="grid gap-2 px-4 pb-4 sm:grid-cols-3 sm:px-5 sm:pb-5">
        {wings.map((wing) => (
          <WingLink key={wing.id} wing={wing} />
        ))}
      </div>
    </section>
  )
}
