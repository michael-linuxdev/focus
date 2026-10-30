"use client"

import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useFocus } from "@/components/focus-provider"
import {
  HABITS,
  PAIN_OPTIONS,
  ROLE_LABEL,
  ROLE_OPTIONS,
  suggestHabits,
  TIME_OPTIONS,
  WINGS,
} from "@/lib/modules"
import type { EnabledHabits, PainChoice, RoleChoice, TimeChoice } from "@/lib/types"
import { cn } from "@/lib/utils"

export function OnboardingGate({
  open,
  onOpen,
  onClose,
  onDismiss,
}: {
  open: boolean
  onOpen: () => void
  onClose: () => void
  onDismiss: () => void
}) {
  const { state } = useFocus()

  if (state.onboarding.status === "offer" && !open) {
    return (
      <section className="mb-6 rounded-3xl bg-[#14241f] px-5 py-5 text-[#f6f1ea]">
        <p className="text-[11px] tracking-[0.16em] text-white/55">NEU IM PALAST</p>
        <h2 className="mt-1 font-serif text-3xl tracking-tight text-balance">Entscheidungen und Grenzen</h2>
        <p className="mt-2 max-w-xl text-sm text-white/70 text-pretty">
          Drei kurze Fragen, dann ein Vorschlag. Deine bisherigen Fokus-Gewohnheiten bleiben.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex h-11 items-center rounded-xl bg-white px-4 text-sm font-medium text-[#14241f]"
          >
            Einrichten
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium text-white/80 hover:bg-white/10"
          >
            Nicht mehr fragen
          </button>
        </div>
      </section>
    )
  }

  if (!open || typeof document === "undefined") return null
  return createPortal(<WizardDialog onClose={onClose} onDismiss={onDismiss} />, document.body)
}

function WizardDialog({ onClose, onDismiss }: { onClose: () => void; onDismiss: () => void }) {
  const { state, completeOnboarding } = useFocus()
  const titleId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const dismissRef = useRef(onDismiss)
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<RoleChoice | null>(state.onboarding.role)
  const [pain, setPain] = useState<PainChoice | null>(state.onboarding.pain)
  const [time, setTime] = useState<TimeChoice | null>(state.onboarding.time)
  const [enabled, setEnabled] = useState<EnabledHabits>(state.settings.enabledHabits)

  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    headingRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismissRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function next() {
    if (step < 2) {
      setStep((value) => value + 1)
      return
    }
    if (pain && time) {
      setEnabled(suggestHabits(pain, time))
      setStep(3)
    }
  }

  const canContinue = (step === 0 && role) || (step === 1 && pain) || (step === 2 && time)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#101c19]/80 p-4 backdrop-blur-sm sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-auto my-4 w-full max-w-xl rounded-[1.75rem] bg-card p-5 text-foreground shadow-2xl sm:my-10 sm:p-7"
      >
        <p className="text-[11px] tracking-[0.16em] text-muted-foreground">
          {step < 3 ? `FRAGE ${step + 1} VON 3` : "VORSCHLAG"}
        </p>
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className="mt-1 font-serif text-3xl tracking-tight text-balance outline-none">
          {step === 0 && "Welche Rolle trägst du?"}
          {step === 1 && "Was drückt gerade am meisten?"}
          {step === 2 && "Wie viel Zeit am Tag?"}
          {step === 3 && role && `Für ${ROLE_LABEL[role]}`}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          {step < 3
            ? "Drei Antworten, danach sind die Gewohnheiten schon angehakt. Du schaltest nur um, was nicht passt."
            : "Alles andere bleibt aus, bis du es einschaltest. Der Palast verliert dabei nichts."}
        </p>

        {step === 0 ? (
          <div className="mt-5 grid gap-2">
            {ROLE_OPTIONS.map((option) => (
              <Choice key={option.id} selected={role === option.id} onClick={() => setRole(option.id)} title={option.title} />
            ))}
          </div>
        ) : null}
        {step === 1 ? (
          <div className="mt-5 grid gap-2">
            {PAIN_OPTIONS.map((option) => (
              <Choice
                key={option.id}
                selected={pain === option.id}
                onClick={() => setPain(option.id)}
                title={option.title}
                hint={option.hint}
              />
            ))}
          </div>
        ) : null}
        {step === 2 ? (
          <div className="mt-5 grid gap-2">
            {TIME_OPTIONS.map((option) => (
              <Choice
                key={option.id}
                selected={time === option.id}
                onClick={() => setTime(option.id)}
                title={option.title}
                hint={option.hint}
              />
            ))}
          </div>
        ) : null}
        {step === 3 ? (
          <div className="mt-5 space-y-4">
            {WINGS.map((wing) => (
              <div key={wing.id}>
                <h3 className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">{wing.title}</h3>
                <ul className="mt-2 space-y-2">
                  {HABITS.filter((habit) => habit.module === wing.id).map((habit) => {
                    const on = enabled[habit.key]
                    return (
                      <li key={habit.key}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => setEnabled((current) => ({ ...current, [habit.key]: !current[habit.key] }))}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left",
                            on ? "border-[#1f6f5b] bg-[#e7f3ef]" : "border-border bg-background",
                          )}
                        >
                          <span>
                            <span className="block text-sm font-medium">{habit.title}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{habit.description}</span>
                          </span>
                          <span
                            className={cn(
                              "grid size-6 shrink-0 place-items-center rounded-full text-xs",
                              on ? "bg-[#1f6f5b] text-white" : "bg-muted text-muted-foreground",
                            )}
                            aria-hidden="true"
                          >
                            {on ? "✓" : ""}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={onDismiss} className="h-11 px-2 text-sm text-muted-foreground hover:text-foreground">
            {state.onboarding.status === "done" ? "Abbrechen" : "Später"}
          </button>
          <div className="flex gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((value) => value - 1)}
                className="inline-flex h-11 items-center rounded-xl border border-border bg-background px-4 text-sm font-medium"
              >
                Zurück
              </button>
            ) : null}
            {step < 3 ? (
              <button
                type="button"
                disabled={!canContinue}
                onClick={next}
                className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                Weiter
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!role || !pain || !time) return
                  completeOnboarding({ role, pain, time, enabled })
                  onClose()
                }}
                className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                So starten
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Choice({
  selected,
  onClick,
  title,
  hint,
}: {
  selected: boolean
  onClick: () => void
  title: string
  hint?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected ? "border-[#1f6f5b] bg-[#e7f3ef]" : "border-border bg-background hover:bg-muted",
      )}
    >
      <span className="block text-base font-medium">{title}</span>
      {hint ? <span className="mt-0.5 block text-sm text-muted-foreground">{hint}</span> : null}
    </button>
  )
}
