import type { Category, ReflectionScore } from "@/lib/types"

export const CATEGORY_META: Record<
  Category,
  { label: string; qualifier: string; description: string }
> = {
  strategic: {
    label: "Strategisch",
    qualifier: "gestaltend",
    description: "Richtung, Position und Zukunft des Unternehmens — auch wenn niemand danach gefragt hat.",
  },
  operational: {
    label: "Operativ",
    qualifier: "reagierend",
    description: "Laufender Betrieb, Anfragen, Freigaben und kurzfristige Probleme.",
  },
}

export const REFLECTION_SCALE: Array<{
  score: ReflectionScore
  label: string
  hint: string
}> = [
  { score: 1, label: "Stark reagiert", hint: "Der Tag hat dich geführt." },
  { score: 2, label: "Eher reagiert", hint: "Kaum eigener Spielraum." },
  { score: 3, label: "Gemischt", hint: "Beides, ohne klares Übergewicht." },
  { score: 4, label: "Eher gestaltet", hint: "Richtung gegeben, nicht nur reagiert." },
  { score: 5, label: "Klar gestaltet", hint: "Der Tag folgte der Absicht." },
]

export function reflectionLabel(score: ReflectionScore): string {
  return REFLECTION_SCALE.find((item) => item.score === score)?.label ?? ""
}

export const STRATEGY_BLOCK_OPTIONS = [45, 60, 90, 120, 180] as const
