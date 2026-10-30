"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useFocus } from "@/components/focus-provider"

export function DemoBanner() {
  const { hasDemo, clearDemo } = useFocus()
  const [open, setOpen] = useState(false)
  if (!hasDemo) return null

  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#e4d3a1] bg-[#fbf6ea] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-pretty">
        <span className="font-medium">Demodaten.</span> Sechs Wochen eines Geschäftsführers: Zeit, Entscheidungen
        und Grenzen, klar als Beispiel markiert. Eigene Einträge bleiben erhalten, wenn du die Demo entfernst.
      </p>
      <Button type="button" variant="outline" className="h-10 shrink-0 bg-card px-3" onClick={() => setOpen(true)}>
        Demodaten entfernen
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demodaten entfernen?</DialogTitle>
            <DialogDescription>
              Beispielblöcke, Beispielgewohnheiten, Beispielentscheidungen und Beispielreflexionen werden gelöscht. Was
              du selbst erfasst hast, bleibt in diesem Browser.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Behalten
            </Button>
            <Button
              type="button"
              onClick={() => {
                clearDemo()
                setOpen(false)
                toast.success("Demodaten entfernt")
              }}
            >
              Entfernen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
