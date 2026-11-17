// Rechenwege für den Vergleich von Zeitreihen. Reine Funktionen.
import type { Point } from "./types.ts";

export function clip(data: Point[], from: number, to = Infinity): Point[] {
  return data.filter((p) => p[0] >= from && p[0] <= to);
}

/** Rechnet eine Reihe so um, dass ihr erster Wert 100 ist. Null, wenn der Startwert nicht positiv ist. */
export function indexTo100(data: Point[]): Point[] | null {
  const base = data[0]?.[1];
  if (base === undefined || base <= 0) return null;
  return data.map(([t, v]) => [t, (v / base) * 100]);
}

/** Letzter Wert je Kalendermonat, Schlüssel „JJJJ-MM“. */
export function monthly(data: Point[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const [t, v] of data) {
    const d = new Date(t);
    out.set(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, v);
  }
  return out;
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]!;
    sy += ys[i]!;
  }
  const mx = sx / n;
  const my = sy / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}

export interface Comovement {
  /** Korrelation der Veränderungen von Monat zu Monat, −1 bis +1. */
  r: number;
  /** Zahl der verglichenen Veränderungen. */
  steps: number;
}

/**
 * Gleichlauf zweier Reihen: Korrelation ihrer Veränderungen zwischen aufeinanderfolgenden
 * gemeinsamen Monaten (bei Quartalsreihen also von Quartal zu Quartal). Veränderungen statt Niveaus, weil zwei beliebige Reihen mit Trend
 * sonst immer stark zusammenzuhängen scheinen. Null bei weniger als zwölf gemeinsamen Veränderungen.
 */
export function comovement(a: Point[], b: Point[]): Comovement | null {
  const ma = monthly(a);
  const mb = monthly(b);
  const keys = [...ma.keys()].filter((k) => mb.has(k)).sort();
  const da: number[] = [];
  const db: number[] = [];
  for (let i = 1; i < keys.length; i++) {
    da.push(ma.get(keys[i]!)! - ma.get(keys[i - 1]!)!);
    db.push(mb.get(keys[i]!)! - mb.get(keys[i - 1]!)!);
  }
  if (da.length < 12) return null;
  const r = pearson(da, db);
  return r === null ? null : { r, steps: da.length };
}

export function describeComovement(r: number): string {
  const strength = Math.abs(r);
  if (strength < 0.2) return "kein erkennbarer Gleichlauf";
  const word = strength < 0.5 ? "schwacher" : strength < 0.75 ? "deutlicher" : "starker";
  return r > 0 ? `${word} Gleichlauf` : `${word} Gegenlauf`;
}

/** „Schöne“ Achsenmarken zwischen min und max. */
export function niceTicks(min: number, max: number, target = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

/** Dünnt eine Reihe auf höchstens `max` Punkte aus, erster und letzter Punkt bleiben. */
export function thin(data: Point[], max: number): Point[] {
  if (data.length <= max) return data;
  const out: Point[] = [];
  for (let i = 0; i < max; i++) out.push(data[Math.round((i * (data.length - 1)) / (max - 1))]!);
  return out;
}
