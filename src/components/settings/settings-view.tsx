"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PageIntro } from "@/components/page-intro"
import { useFocus } from "@/components/focus-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { formatMinutes } from "@/lib/format"
import { STRATEGY_BLOCK_OPTIONS } from "@/lib/labels"
import { STORAGE_KEY } from "@/lib/types"
import { cn } from "@/lib/utils"

export function SettingsView() {
  const { state, hasDemo, updateSettings, clearDemo, loadDemo, clearAll } = useFocus()
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDemo, setConfirmDemo] = useState(false)

  return (
    <div className="max-w-2xl space-y-6">
      <PageIntro
        eyebrow="Einstellungen"
        title="Ziel und Schutz"
        lede="Lege fest, welcher Anteil strategisch sein soll und wie lang ein Strategieblock mindestens ist. Alles bleibt in diesem Browser."
      />

      <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl tracking-tight">Zielanteil</h2>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Der Anteil strategischer Zeit an allem, was du erfasst. Viele Geschäftsführer sehen hier zum ersten Mal, wie weit der Alltag vom eigenen Anspruch entfernt ist.
            </p>
          </div>
          <p className="font-serif text-5xl tabular-nums">{state.settings.targetPercent} %</p>
        </div>
        <Slider
          className="mt-6"
          aria-label="Zielanteil strategische Zeit in Prozent"
          min={10}
          max={80}
          step={5}
          value={[state.settings.targetPercent]}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value
            updateSettings({ targetPercent: next })
          }}
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>10 %</span>
          <span>80 %</span>
        </div>
      </section>

      <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
        <h2 className="font-serif text-2xl tracking-tight">Länge des Strategieblocks</h2>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Ab dieser Dauer gilt ein strategischer Block als gehalten. Die Serie auf der Fokus-Seite folgt deiner Markierung, der Hinweis daneben diesem Wert.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Länge des Strategieblocks">
          {STRATEGY_BLOCK_OPTIONS.map((minutes) => {
            const selected = state.settings.strategyBlockMinutes === minutes
            return (
              <button
                key={minutes}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  updateSettings({ strategyBlockMinutes: minutes })
                  toast.success(`Strategieblock: ${formatMinutes(minutes)}`)
                }}
                className={cn(
                  "h-11 rounded-xl border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  selected ? "border-strategic bg-[#e7f3ef] text-strategic" : "border-border bg-background",
                )}
              >
                {formatMinutes(minutes)}
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
        <h2 className="font-serif text-2xl tracking-tight">Was die Kategorien meinen</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-medium">Strategisch, gestaltend</dt>
            <dd className="text-muted-foreground">
              Arbeit an Richtung, Position und Zukunft. Eine Entscheidung vorbereiten, ein Portfolio schärfen, eine Wachstumsoption vergleichen.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Operativ, reagierend</dt>
            <dd className="text-muted-foreground">
              Arbeit, die den Betrieb am Laufen hält: Freigaben, Eskalationen, Jour fixe, E-Mail, das Problem von heute Nachmittag.
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10 sm:p-6">
        <h2 className="font-serif text-2xl tracking-tight">Daten in diesem Browser</h2>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Es gibt kein Konto. Einträge liegen lokal unter dem Schlüssel {STORAGE_KEY}. Die App spricht nur mit einer Speicher-Schnittstelle, damit später ein Server dieselbe Stelle einnehmen kann.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {hasDemo ? (
            <Button type="button" variant="outline" className="h-10 bg-background px-4" onClick={() => setConfirmDemo(true)}>
              Demodaten entfernen
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-10 bg-background px-4"
              onClick={() => {
                loadDemo()
                toast.success("Demodaten geladen")
              }}
            >
              Demodaten laden
            </Button>
          )}
          <Button type="button" variant="destructive" className="h-10 px-4" onClick={() => setConfirmClear(true)}>
            Alle Daten löschen
          </Button>
        </div>
      </section>

      <Dialog open={confirmDemo} onOpenChange={setConfirmDemo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demodaten entfernen?</DialogTitle>
            <DialogDescription>
              Beispielblöcke, Beispielgewohnheiten und Beispielreflexionen werden gelöscht. Eigene Einträge bleiben.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDemo(false)}>
              Behalten
            </Button>
            <Button
              type="button"
              onClick={() => {
                clearDemo()
                setConfirmDemo(false)
                toast.success("Demodaten entfernt")
              }}
            >
              Entfernen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alle Daten löschen?</DialogTitle>
            <DialogDescription>
              Zeitblöcke, Gewohnheiten, Reflexionen und Einstellungen in diesem Browser werden entfernt. Das lässt sich nicht rückgängig machen. Danach kannst du die Demodaten neu laden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmClear(false)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                clearAll()
                setConfirmClear(false)
                toast.success("Alle Daten gelöscht")
              }}
            >
              Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
