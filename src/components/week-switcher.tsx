import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function WeekSwitcher({
  title,
  detail,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
}: {
  title: string
  detail?: string
  onPrevious: () => void
  onNext: () => void
  previousDisabled?: boolean
  nextDisabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        {detail ? <p className="truncate text-sm text-muted-foreground">{detail}</p> : null}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 bg-card"
          onClick={onPrevious}
          disabled={previousDisabled}
          aria-label="Vorige Woche"
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 bg-card"
          onClick={onNext}
          disabled={nextDisabled}
          aria-label="Nächste Woche"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
