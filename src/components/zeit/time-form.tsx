"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useFocus } from "@/components/focus-provider"
import { CATEGORY_META } from "@/lib/labels"
import { formatMinutes } from "@/lib/format"
import { resolveDuration } from "@/lib/time"
import type { Category, TimeBlock } from "@/lib/types"
import { cn } from "@/lib/utils"

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const PRESETS: Array<{ label: string; minutes: number; category: Category; note: string }> = [
  { label: "90 Min Strategie", minutes: 90, category: "strategic", note: "Strategieblock" },
  { label: "60 Min Meeting", minutes: 60, category: "operational", note: "Meeting" },
  { label: "30 Min E-Mail", minutes: 30, category: "operational", note: "E-Mail und Freigaben" },
]

interface FormState {
  date: string
  mode: "range" | "duration"
  start: string
  end: string
  hours: number
  minutes: number
  category: Category
  note: string
}

function fromBlock(block: TimeBlock): FormState {
  const hasRange = Boolean(block.start && block.end)
  return {
    date: block.date,
    mode: hasRange ? "range" : "duration",
    start: block.start ?? "",
    end: block.end ?? "",
    hours: Math.floor(block.durationMinutes / 60),
    minutes: block.durationMinutes % 60,
    category: block.category,
    note: block.note,
  }
}

function blank(today: string): FormState {
  return {
    date: today,
    mode: "duration",
    start: "",
    end: "",
    hours: 1,
    minutes: 30,
    category: "strategic",
    note: "",
  }
}

export function TimeForm({
  today,
  editing,
  onCancel,
}: {
  today: string
  editing: TimeBlock | null
  onCancel: () => void
}) {
  const { addTimeBlock, updateTimeBlock } = useFocus()
  const editingId = editing?.id ?? null
  const [seen, setSeen] = useState(editingId)
  const [form, setForm] = useState<FormState>(editing ? fromBlock(editing) : blank(today))
  const [error, setError] = useState<string | null>(null)

  if (seen !== editingId) {
    setSeen(editingId)
    setForm(editing ? fromBlock(editing) : blank(today))
    setError(null)
  }

  const preview = resolveDuration(form)
  const minuteChoices = form.mode === "duration" && form.minutes % 15 !== 0
    ? [0, 15, 30, 45, form.minutes].sort((a, b) => a - b)
    : [0, 15, 30, 45]

  function patch(partial: Partial<FormState>) {
    setForm((current) => ({ ...current, ...partial }))
    setError(null)
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (form.date > today) {
      setError("Zeiten lassen sich bis heute erfassen, nicht im Voraus.")
      return
    }
    if (form.note.trim().length > 280) {
      setError("Die Notiz darf höchstens 280 Zeichen haben.")
      return
    }
    const duration = resolveDuration(form)
    if (!duration.ok) {
      setError(duration.error)
      return
    }
    const draft = {
      date: form.date,
      start: duration.start,
      end: duration.end,
      durationMinutes: duration.minutes,
      category: form.category,
      note: form.note,
    }
    const saved = editing ? updateTimeBlock(editing.id, draft) : addTimeBlock(draft)
    if (!saved) {
      toast.error("Der Block ist hier sichtbar, wurde aber nicht dauerhaft gespeichert.")
      return
    }
    toast.success(editing ? "Block aktualisiert" : "Block gespeichert")
    if (editing) {
      onCancel()
      return
    }
    setForm((current) => ({
      ...current,
      note: "",
      start: current.mode === "range" ? current.end : current.start,
      end: "",
    }))
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-2xl tracking-tight">{editing ? "Block bearbeiten" : "Block erfassen"}</h2>
        {editing ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">
        Strategisch heißt gestaltend. Operativ heißt reagierend. Der Anteil entsteht nur aus dem, was du einträgst.
      </p>

      {!editing ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              className="h-9 bg-background px-3"
              onClick={() =>
                patch({
                  mode: "duration",
                  hours: Math.floor(preset.minutes / 60),
                  minutes: preset.minutes % 60,
                  category: preset.category,
                  note: preset.note,
                })
              }
            >
              {preset.label}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="block-date">Datum</Label>
          <Input
            id="block-date"
            type="date"
            max={today}
            required
            value={form.date}
            onChange={(event) => patch({ date: event.target.value })}
            className="h-10 bg-background text-base md:text-base"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium" id="mode-label">
            Erfassung
          </p>
          <div role="radiogroup" aria-labelledby="mode-label" className="grid grid-cols-2 gap-2">
            {(
              [
                ["range", "Zeitraum"],
                ["duration", "Dauer"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={form.mode === mode}
                className={cn(
                  "h-10 rounded-lg border text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  form.mode === mode ? "border-strategic bg-[#e7f3ef] text-strategic" : "border-border bg-background",
                )}
                onClick={() => patch({ mode })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {form.mode === "range" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="block-start">Beginn</Label>
              <Input
                id="block-start"
                type="time"
                required
                value={form.start}
                onChange={(event) => patch({ start: event.target.value })}
                className="h-10 bg-background text-base md:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-end">Ende</Label>
              <Input
                id="block-end"
                type="time"
                required
                value={form.end}
                onChange={(event) => patch({ end: event.target.value })}
                className="h-10 bg-background text-base md:text-base"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="block-hours">Stunden</Label>
              <select
                id="block-hours"
                className={fieldClass}
                value={form.hours}
                onChange={(event) => patch({ hours: Number(event.target.value) })}
              >
                {Array.from({ length: 13 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-minutes">Minuten</Label>
              <select
                id="block-minutes"
                className={fieldClass}
                value={form.minutes}
                onChange={(event) => patch({ minutes: Number(event.target.value) })}
              >
                {minuteChoices.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {preview.ok ? `Dauer: ${formatMinutes(preview.minutes)}` : "Dauer folgt aus Beginn und Ende."}
        </p>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Kategorie</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["strategic", "operational"] as const).map((category) => {
              const meta = CATEGORY_META[category]
              const selected = form.category === category
              return (
                <label
                  key={category}
                  className={cn(
                    "cursor-pointer rounded-xl border p-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
                    selected ? "border-strategic bg-[#e7f3ef]" : "border-border bg-background",
                  )}
                >
                  <input
                    type="radio"
                    name="category"
                    className="sr-only"
                    checked={selected}
                    onChange={() => patch({ category })}
                  />
                  <span className="block text-sm font-medium">
                    {meta.label} <span className="font-normal text-muted-foreground">({meta.qualifier})</span>
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{meta.description}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="block-note">Notiz, optional</Label>
          <Textarea
            id="block-note"
            value={form.note}
            maxLength={280}
            placeholder="Worum ging es?"
            onChange={(event) => patch({ note: event.target.value })}
            className="min-h-20 bg-background text-base md:text-base"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-lag">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="h-11 w-full px-4 text-base">
          {editing ? "Änderungen speichern" : "Block speichern"}
        </Button>
      </div>
    </form>
  )
}
