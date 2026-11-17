// Rechenwege für den Ländervergleich. Reihen verschiedener Tabellen werden je Land über das Kalenderjahr verbunden,
// weil die Stichtage abweichen (Bevölkerung am 31.12., Jahreswerte am 1.1.).
import type { Point } from "./types.ts";

export interface RegionSeries {
  name: string;
  data: Point[];
}

const year = (time: number): number => new Date(time).getUTCFullYear();

function byYear(data: Point[]): Map<number, number> {
  return new Map(data.map(([t, v]) => [year(t), v]));
}

/** Verknüpft zwei Tabellen je Land und Jahr; Länder oder Jahre, die in einer fehlen, entfallen. */
export function combine(a: RegionSeries[], b: RegionSeries[], fn: (a: number, b: number) => number): RegionSeries[] {
  const out: RegionSeries[] = [];
  for (const left of a) {
    const right = b.find((r) => r.name === left.name);
    if (!right) continue;
    const other = byYear(right.data);
    const data: Point[] = [];
    for (const [t, v] of left.data) {
      const w = other.get(year(t));
      if (w !== undefined && Number.isFinite(fn(v, w))) data.push([Date.UTC(year(t), 0, 1), fn(v, w)]);
    }
    if (data.length) out.push({ name: left.name, data });
  }
  return out;
}

/** Setzt jede Reihe im Jahr `baseYear` auf 100. Länder ohne Wert in diesem Jahr entfallen. */
export function rebase(series: RegionSeries[], baseYear: number): RegionSeries[] {
  const out: RegionSeries[] = [];
  for (const sr of series) {
    const base = byYear(sr.data).get(baseYear);
    if (!base || base <= 0) continue;
    out.push({ name: sr.name, data: sr.data.filter(([t]) => year(t) >= baseYear).map(([t, v]) => [t, (v / base) * 100]) });
  }
  return out;
}

export interface Ranked {
  name: string;
  value: number;
}

/** Wert je Land im angegebenen Jahr, absteigend. */
export function ranking(series: RegionSeries[], atYear: number): Ranked[] {
  return series
    .map((sr) => ({ name: sr.name, value: byYear(sr.data).get(atYear) }))
    .filter((r): r is Ranked => r.value !== undefined)
    .sort((a, b) => b.value - a.value);
}

/** Veränderung je Land zwischen zwei Jahren: in Prozent oder, für Quoten, in Punkten. Absteigend. */
export function changes(series: RegionSeries[], fromYear: number, toYear: number, inPoints: boolean): Ranked[] {
  const out: Ranked[] = [];
  for (const sr of series) {
    const values = byYear(sr.data);
    const a = values.get(fromYear);
    const b = values.get(toYear);
    if (a === undefined || b === undefined) continue;
    if (inPoints) out.push({ name: sr.name, value: b - a });
    else if (a > 0) out.push({ name: sr.name, value: (b / a - 1) * 100 });
  }
  return out.sort((a, b) => b.value - a.value);
}

export function commonYears(series: RegionSeries[]): number[] {
  if (series.length === 0) return [];
  const sets = series.map((sr) => new Set(sr.data.map(([t]) => year(t))));
  return [...sets[0]!].filter((y) => sets.every((s) => s.has(y))).sort((a, b) => a - b);
}

export interface Spread {
  year: number;
  top: Ranked;
  bottom: Ranked;
  /** Abstand zwischen höchstem und niedrigstem Land: als Verhältnis, bei Quoten als Differenz. */
  gap: number;
}

/** Abstand zwischen dem höchsten und dem niedrigsten Land je Jahr. */
export function spread(series: RegionSeries[], years: number[], inPoints: boolean): Spread[] {
  const out: Spread[] = [];
  for (const y of years) {
    const ranked = ranking(series, y);
    const top = ranked[0];
    const bottom = ranked[ranked.length - 1];
    if (!top || !bottom || ranked.length < 2) continue;
    if (!inPoints && bottom.value <= 0) continue;
    out.push({ year: y, top, bottom, gap: inPoints ? top.value - bottom.value : top.value / bottom.value });
  }
  return out;
}

/** Mittleres Land je Jahr (Median), als Reihe. */
export function median(series: RegionSeries[], years: number[]): Point[] {
  const out: Point[] = [];
  for (const y of years) {
    const values = ranking(series, y).map((r) => r.value).sort((a, b) => a - b);
    if (values.length === 0) continue;
    const mid = values.length >> 1;
    out.push([Date.UTC(y, 0, 1), values.length % 2 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2]);
  }
  return out;
}
