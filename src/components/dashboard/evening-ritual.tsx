"use client"

import { useFocus } from "@/components/focus-provider"
import { reflectionOn } from "@/lib/habits"
import { ENERGY_LABELS, energyOn, isModuleHabitDone } from "@/lib/modules"
import type { EnergyLevel, ReflectionScore } from "@/lib/types"
import { cn } from "@/lib/utils"

const QUICK: Array<{ score: ReflectionScore; label: string; match: (score: ReflectionScore) => boolean }> = [
  { score: 2, label: "Reagiert", match: (score) => score <= 2 },
  { score: 3, label: "Gemischt", match: (score) => score === 3 },
  { score: 4, label: "Gestaltet", match: (score) => score >= 4 },
]

export function EveningRitual({ prominent = false }: { prominent?: boolean }) {
  const { state, today, saveEnergy, saveReflection, setModuleHabit } = useFocus()
  const level = energyOn(state, today) ?? 3
  const reflection = reflectionOn(state, today)
  const shutdown = isModuleHabitDone(state, "shutdown", today)
  const showShutdown = prominent || state.settings.enabledHabits.shutdown

  return (
    <section
      id="abend"
      aria-labelledby="abend-titel"
      className={cn(
        "rounded-3xl px-5 py-5 ring-1 ring-foreground/10",
        prominent ? "bg-[#f8f4ee]" : "bg-card",
      )}
    >
      <h2 id="abend-titel" className="font-serif text-2xl tracking-tight">
        Abend, dreißig Sekunden
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Energie, eine Frage, Laptop zu.</p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="energie" className="text-sm font-medium">
            Energie heute
          </label>
          <p className="font-serif text-3xl tabular-nums leading-none">{level}</p>
        </div>
        <input
          id="energie"
          type="range"
          min={1}
          max={5}
          step={1}
          value={level}
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={level}
          aria-valuetext={ENERGY_LABELS[level - 1]}
          onChange={(event) => saveEnergy(today, Number(event.target.value) as EnergyLevel)}
          className="mt-3 h-10 w-full cursor-pointer accent-[#1f6f5b]"
        />
        <div className="mt-1 grid grid-cols-5 text-center text-[11px] text-muted-foreground">
          {ENERGY_LABELS.map((word) => (
            <span key={word}>{word}</span>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium">Reagiert oder gestaltet?</p>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Reagiert oder gestaltet">
          {QUICK.map((choice) => {
            const selected = reflection ? choice.match(reflection.score) : false
            return (
              <button
                key={choice.label}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => saveReflection(today, choice.score, reflection?.note ?? "")}
                className={cn(
                  "min-h-12 rounded-xl border text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  selected ? "border-[#1f6f5b] bg-[#e7f3ef] text-strategic" : "border-border bg-background hover:bg-muted",
                )}
              >
                {choice.label}
              </button>
            )
          })}
        </div>
      </div>

      {showShutdown ? (
        <button
          type="button"
          aria-pressed={shutdown}
          onClick={() => setModuleHabit("shutdown", today, !shutdown)}
          className={cn(
            "mt-5 flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            shutdown ? "border-transparent bg-[#1f6f5b] text-white" : "border-border bg-background",
          )}
        >
          <span>Laptop zu, Tag geschlossen</span>
          <span className="text-xs tracking-wide uppercase">{shutdown ? "Gehalten" : "Offen"}</span>
        </button>
      ) : null}
    </section>
  )
}
