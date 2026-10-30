export const MAX_BLOCK_MINUTES = 12 * 60

export function minutesBetween(start: string, end: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null
  const [startHour, startMinute] = start.split(":").map(Number)
  const [endHour, endMinute] = end.split(":").map(Number)
  const startTotal = startHour * 60 + startMinute
  const endTotal = endHour * 60 + endMinute
  if (endTotal <= startTotal) return null
  return endTotal - startTotal
}

export type DurationInput = {
  mode: "range" | "duration"
  start: string
  end: string
  hours: number
  minutes: number
}

export type DurationResult =
  | { ok: true; minutes: number; start: string | null; end: string | null }
  | { ok: false; error: string }

export function resolveDuration(input: DurationInput): DurationResult {
  if (input.mode === "range") {
    if (!input.start || !input.end) {
      return { ok: false, error: "Bitte Beginn und Ende angeben." }
    }
    const minutes = minutesBetween(input.start, input.end)
    if (minutes === null) {
      return {
        ok: false,
        error: "Das Ende muss nach dem Beginn liegen. Blöcke über Mitternacht bitte aufteilen.",
      }
    }
    if (minutes > MAX_BLOCK_MINUTES) {
      return { ok: false, error: "Ein Block darf höchstens 12 Stunden dauern." }
    }
    return { ok: true, minutes, start: input.start, end: input.end }
  }

  const minutes = input.hours * 60 + input.minutes
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { ok: false, error: "Die Dauer muss größer als 0 sein." }
  }
  if (minutes > MAX_BLOCK_MINUTES) {
    return { ok: false, error: "Ein Block darf höchstens 12 Stunden dauern." }
  }
  return { ok: true, minutes, start: null, end: null }
}
