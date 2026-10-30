"use client"

import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { CategoryPill } from "@/components/category-pill"
import { useFocus } from "@/components/focus-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatLongDate, formatMinutes, formatTimeRange } from "@/lib/format"
import type { TimeBlock } from "@/lib/types"
import { cn } from "@/lib/utils"

function groupBlocks(blocks: TimeBlock[]) {
  const sorted = [...blocks].sort(
    (a, b) => b.date.localeCompare(a.date) || (a.start ?? "99:99").localeCompare(b.start ?? "99:99"),
  )
  const groups: Array<{ date: string; blocks: TimeBlock[] }> = []
  for (const block of sorted) {
    const last = groups[groups.length - 1]
    if (!last || last.date !== block.date) groups.push({ date: block.date, blocks: [block] })
    else last.blocks.push(block)
  }
  return groups
}

export function TimeList({
  blocks,
  editingId,
  onEdit,
}: {
  blocks: TimeBlock[]
  editingId: string | null
  onEdit: (block: TimeBlock) => void
}) {
  const { deleteTimeBlock } = useFocus()
  const [pending, setPending] = useState<TimeBlock | null>(null)
  const groups = groupBlocks(blocks)

  if (blocks.length === 0) {
    return (
      <p className="rounded-3xl bg-card px-5 py-8 text-sm text-muted-foreground ring-1 ring-foreground/10">
        In dieser Auswahl liegt noch kein Block.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.date}>
          <h3 className="text-sm font-medium text-muted-foreground">{formatLongDate(group.date)}</h3>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
            {group.blocks.map((block) => (
              <li
                key={block.id}
                className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center", editingId === block.id && "bg-accent")}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{block.note || "Ohne Notiz"}</p>
                    {block.demo ? <Badge variant="outline">Demo</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatTimeRange(block.start, block.end) ?? "Ohne Uhrzeit"}
                    {" · "}
                    {formatMinutes(block.durationMinutes)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CategoryPill category={block.category} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10 bg-background"
                    aria-label={`${block.note || "Block"} bearbeiten`}
                    onClick={() => onEdit(block)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10 bg-background"
                    aria-label={`${block.note || "Block"} löschen`}
                    onClick={() => setPending(block)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block löschen?</DialogTitle>
            <DialogDescription>
              {pending
                ? `${pending.note || "Dieser Block"} (${formatMinutes(pending.durationMinutes)}) verschwindet aus dem Anteil.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPending(null)}>
              Behalten
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!pending) return
                deleteTimeBlock(pending.id)
                if (editingId === pending.id) onEdit(pending)
                setPending(null)
                toast.success("Block gelöscht")
              }}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
