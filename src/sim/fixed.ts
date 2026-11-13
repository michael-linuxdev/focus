/**
 * Ganzzahl-Arithmetik der Spiellogik.
 *
 * Alle Größen der Simulation sind 32-Bit-Ganzzahlen:
 * - Zeit in Ticks (Dauer eines Ticks: 1000 / ticksPerSecond ms)
 * - Strecken in Tausendstel-Kacheln ("Milli")
 * - Anteile in Promille
 *
 * C#-Entsprechung: `int`, Division mit `/` (schneidet ebenfalls zur Null hin ab),
 * `mulDiv` als `(int)((long)a * b / c)`.
 */

/** Tausendstel-Kacheln pro Kachel. */
export const MILLI = 1000;

/** Promille-Basis. */
export const PERMILLE = 1000;

/** Ganzzahl-Division, schneidet zur Null hin ab (wie `/` auf `int` in C#). */
export function idiv(a: number, b: number): number {
  if (b === 0) throw new Error('idiv: Division durch 0');
  return Math.trunc(a / b);
}

/**
 * a * b / c mit abschneidender Division. Das Zwischenprodukt muss unter 2^53 bleiben
 * (für int32-Operanden immer erfüllt, wenn |a| < 2^21 oder |b| < 2^21 ...); geprüft wird hart.
 */
export function mulDiv(a: number, b: number, c: number): number {
  const p = a * b;
  if (!Number.isSafeInteger(p)) throw new Error('mulDiv: Zwischenprodukt zu groß');
  return idiv(p, c);
}

/** Anteil in Promille, abgeschnitten. */
export function permille(value: number, share: number): number {
  return mulDiv(value, share, PERMILLE);
}
