import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function HabitToggle({
  pressed,
  label,
  onClick,
  warn = false,
}: {
  pressed: boolean
  label: string
  onClick: () => void
  warn?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        pressed && "border-transparent bg-[#1f6f5b] text-white",
        !pressed && !warn && "border-border bg-card text-foreground hover:bg-muted",
        warn && "border-[#e4c2b6] bg-[#f8ebe6] text-lag",
      )}
    >
      <span
        className={cn(
          "grid size-5 place-items-center rounded-full",
          pressed ? "bg-white/20" : "bg-background",
        )}
      >
        {pressed ? <Check className="size-3.5" aria-hidden="true" /> : null}
      </span>
      {label}
    </button>
  )
}
