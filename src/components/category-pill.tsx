import { cn } from "@/lib/utils"
import { CATEGORY_META } from "@/lib/labels"
import type { Category } from "@/lib/types"

export function CategoryPill({ category, className }: { category: Category; className?: string }) {
  const meta = CATEGORY_META[category]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        category === "strategic" ? "bg-strategic text-white" : "bg-[#efe6d8] text-[#5c5144]",
        className,
      )}
    >
      {meta.label}
      <span className="font-normal opacity-80">· {meta.qualifier}</span>
    </span>
  )
}
