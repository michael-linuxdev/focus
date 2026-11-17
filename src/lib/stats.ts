// Rechenwege für den Vergleich von Zeitreihen. Reine Funktionen.
import type { Extreme, Point } from "./types.ts";

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

// ---------- Vorlauf ----------

function shiftMonth(key: string, months: number): string {
  const [y, m] = key.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export interface LeadLag {
  /** Um so viele Monate läuft die erste Reihe der zweiten voraus (negativ: sie läuft nach). */
  lead: number;
  r: number;
  steps: number;
}

/**
 * Sucht die Verschiebung, bei der die Veränderungen zweier Reihen am stärksten zusammenhängen.
 * Geprüft wird nur dort, wo beide Reihen lückenlos Monatswerte haben; Quartalsreihen werden nicht gefüllt.
 * Null, wenn keine Verschiebung den gleichzeitigen Zusammenhang deutlich übertrifft.
 */
export function leadLag(a: Point[], b: Point[], maxMonths = 12): LeadLag | null {
  const ma = monthly(a);
  const mb = monthly(b);
  const change = (m: Map<string, number>): Map<string, number> => {
    const out = new Map<string, number>();
    for (const [key, value] of m) {
      const before = m.get(shiftMonth(key, -1));
      if (before !== undefined) out.set(key, value - before);
    }
    return out;
  };
  const ca = change(ma);
  const cb = change(mb);
  const at = (lead: number): { r: number; steps: number } | null => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [key, value] of ca) {
      const other = cb.get(shiftMonth(key, lead));
      if (other !== undefined) {
        xs.push(value);
        ys.push(other);
      }
    }
    if (xs.length < 24) return null;
    const r = pearson(xs, ys);
    return r === null ? null : { r, steps: xs.length };
  };
  const now = at(0);
  if (!now) return null;
  let best: LeadLag = { lead: 0, ...now };
  for (let lead = -maxMonths; lead <= maxMonths; lead++) {
    const candidate = at(lead);
    if (candidate && Math.abs(candidate.r) > Math.abs(best.r)) best = { lead, ...candidate };
  }
  if (best.lead === 0 || Math.abs(best.r) < 0.3 || Math.abs(best.r) - Math.abs(now.r) < 0.1) return null;
  return best;
}

// ---------- Umrechnungen ----------

/** Wert einer Reihe zu einem Zeitpunkt, linear zwischen den Nachbarn; außerhalb der Reihe der Randwert. */
export function valueAt(data: Point[], time: number): number | null {
  if (data.length === 0) return null;
  if (time <= data[0]![0]) return data[0]![1];
  const last = data[data.length - 1]!;
  if (time >= last[0]) return last[1];
  let lo = 0;
  let hi = data.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (data[mid]![0] <= time) lo = mid;
    else hi = mid;
  }
  const [t0, v0] = data[lo]!;
  const [t1, v1] = data[hi]!;
  return v0 + ((v1 - v0) * (time - t0)) / (t1 - t0);
}

/** Rechnet Geldbeträge in Preise des jüngsten Indexstands um. Punkte außerhalb des Preisindex entfallen. */
export function deflate(data: Point[], priceIndex: Point[]): Point[] {
  const first = priceIndex[0]?.[0];
  const last = priceIndex[priceIndex.length - 1];
  if (first === undefined || !last) return [];
  const slack = 45 * 86_400_000;
  const out: Point[] = [];
  for (const [t, v] of data) {
    if (t < first - slack || t > last[0] + slack) continue;
    const level = valueAt(priceIndex, t);
    if (level && level > 0) out.push([t, (v * last[1]) / level]);
  }
  return out;
}

/** Teilt durch die Bevölkerung; `factor` gleicht die Größenordnungen aus (z. B. Mrd. Euro durch Mio. Personen). */
export function perCapita(data: Point[], population: Point[], factor = 1): Point[] {
  const out: Point[] = [];
  for (const [t, v] of data) {
    const people = valueAt(population, t);
    if (people && people > 0) out.push([t, (v / people) * factor]);
  }
  return out;
}

// ---------- Auffällige Werte ----------

const YEAR_MS = 365.25 * 86_400_000;

/** Veränderung zum Vorjahr in Prozent je Punkt (nur für positive Werte und wenn ein Vorjahreswert existiert). */
export function yearOverYear(data: Point[]): Point[] {
  const out: Point[] = [];
  let j = 0;
  for (const [t, v] of data) {
    const target = t - YEAR_MS;
    while (j + 1 < data.length && Math.abs(data[j + 1]![0] - target) <= Math.abs(data[j]![0] - target)) j++;
    const before = data[j]!;
    if (Math.abs(before[0] - target) > 20 * 86_400_000 || before[1] <= 0 || v <= 0) continue;
    out.push([t, (v / before[1] - 1) * 100]);
  }
  return out;
}

/**
 * Prüft, ob der jüngste Wert einer Reihe seit langer Zeit nicht so hoch oder so niedrig war.
 * Bei Raten zählt der Stand, sonst die Veränderung zum Vorjahr – ein Index mit Trend steht fast immer
 * auf Rekordhoch, auffällig ist erst ein ungewöhnlich starker Anstieg oder Rückgang.
 */
export function findExtreme(data: Point[], rate: boolean, minYears = 5): Extreme | null {
  const basis = rate ? data : yearOverYear(data);
  if (basis.length < 12) return null;
  const [lastTime, lastValue] = basis[basis.length - 1]!;
  const span = (lastTime - basis[0]![0]) / YEAR_MS;
  if (span < minYears + 1) return null;
  let best: Extreme | null = null;
  for (const dir of ["high", "low"] as const) {
    let since: number | null = null;
    for (let i = basis.length - 2; i >= 0; i--) {
      const [t, v] = basis[i]!;
      if (dir === "high" ? v >= lastValue : v <= lastValue) {
        since = t;
        break;
      }
    }
    const years = (lastTime - (since ?? basis[0]![0])) / YEAR_MS;
    if (years >= minYears && (!best || years > best.years)) best = { dir, value: lastValue, since, years };
  }
  return best;
}
