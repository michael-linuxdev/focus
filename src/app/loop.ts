/**
 * Fester Zeitschritt: wandelt verstrichene Echtzeit in ganze Ticks um.
 * Die Bildrate bestimmt nur, wie oft gezeichnet wird, nie das Ergebnis.
 */
export interface TickBudget {
  readonly ticks: number;
  readonly restMs: number;
}

/** Höchstens so viele Ticks pro Bild nachholen (nach einem Hänger läuft das Spiel weiter statt zu springen). */
export const MAX_CATCH_UP_TICKS = 10;

export function consumeTicks(restMs: number, elapsedMs: number, tickMs: number): TickBudget {
  const total = restMs + Math.max(0, elapsedMs);
  const ticks = Math.floor(total / tickMs);
  if (ticks > MAX_CATCH_UP_TICKS) return { ticks: MAX_CATCH_UP_TICKS, restMs: 0 };
  return { ticks, restMs: total - ticks * tickMs };
}
