// Rechenwege für „Mein Geld“: persönliche Teuerung, Arbeitszeit, Erschwinglichkeit. Reine Funktionen.
import { valueAt } from "./stats.ts";
import type { Point, PriceItems } from "./types.ts";

export interface PriceGroup {
  code: string;
  name: string;
  /** Preisindex der Ausgabengruppe. */
  data: Point[];
}

function at(data: Point[], time: number): number | null {
  const first = data[0]?.[0];
  const last = data[data.length - 1]?.[0];
  if (first === undefined || last === undefined || time < first || time > last) return null;
  return valueAt(data, time);
}

/**
 * Preisindex eines eigenen Warenkorbs: Die Preisentwicklung jeder Ausgabengruppe seit `base` wird mit dem
 * eigenen Ausgabenanteil gewichtet (Startzeitpunkt = 100). Mit den amtlichen Gewichten ergibt das näherungsweise
 * den amtlichen Index; Abweichungen entstehen, weil die amtliche Rechnung feiner gegliedert ist.
 */
export function personalIndex(groups: PriceGroup[], weights: Map<string, number>, base: number): Point[] {
  const used = groups.filter((g) => (weights.get(g.code) ?? 0) > 0 && at(g.data, base));
  const total = used.reduce((sum, g) => sum + weights.get(g.code)!, 0);
  if (total <= 0) return [];
  const times = [...new Set(used.flatMap((g) => g.data.map((p) => p[0])))].filter((t) => t >= base).sort((a, b) => a - b);
  const out: Point[] = [];
  for (const time of times) {
    let sum = 0;
    let complete = true;
    for (const g of used) {
      const now = at(g.data, time);
      if (now === null) {
        complete = false;
        break;
      }
      sum += (weights.get(g.code)! / total) * (now / at(g.data, base)!);
    }
    if (complete) out.push([time, sum * 100]);
  }
  return out;
}

export interface Contribution {
  code: string;
  name: string;
  /** Preisänderung der Gruppe in Prozent. */
  change: number;
  /** Beitrag zur gesamten Teuerung in Prozentpunkten. */
  points: number;
}

/** Zerlegt die Teuerung zwischen zwei Zeitpunkten in die Beiträge der Ausgabengruppen. */
export function contributions(groups: PriceGroup[], weights: Map<string, number>, from: number, to: number): Contribution[] {
  const used = groups.filter((g) => (weights.get(g.code) ?? 0) > 0 && at(g.data, from) && at(g.data, to));
  const total = used.reduce((sum, g) => sum + weights.get(g.code)!, 0);
  return used.map((g) => {
    const change = (at(g.data, to)! / at(g.data, from)! - 1) * 100;
    return { code: g.code, name: g.name, change, points: (weights.get(g.code)! / total) * change };
  });
}

/** Veränderung zwischen zwei Zeitpunkten in Prozent; null, wenn einer außerhalb der Reihe liegt. */
export function changeBetween(data: Point[], from: number, to: number): number | null {
  const a = at(data, from);
  const b = at(data, to);
  return a && b !== null ? (b / a - 1) * 100 : null;
}

/**
 * Um wie viel Prozent sich die nötige Arbeitszeit für dieselbe Ware ändert, wenn der Preis um `priceChange`
 * und der Lohn um `wageChange` Prozent steigt.
 */
export function workTimeChange(priceChange: number, wageChange: number): number {
  return ((1 + priceChange / 100) / (1 + wageChange / 100) - 1) * 100;
}

/** Verhältnis zweier Reihen, auf 100 zum Zeitpunkt `base` gesetzt, zu den Zeitpunkten der ersten Reihe. */
export function ratioIndex(numerator: Point[], denominator: Point[], base: number): Point[] {
  const n0 = at(numerator, base);
  const d0 = at(denominator, base);
  if (!n0 || !d0) return [];
  const out: Point[] = [];
  for (const [time, value] of numerator) {
    if (time < base) continue;
    const d = at(denominator, time);
    if (d) out.push([time, (value / n0 / (d / d0)) * 100]);
  }
  return out;
}

/**
 * Jährliche Belastung eines voll finanzierten Kaufs je 100 Einheiten Kaufpreis: Zins plus anfängliche Tilgung.
 * `yields` in Prozent; Ergebnis ist der Preisindex mal Belastungssatz, also eine Reihe für die Monatsrate.
 */
export function financingCost(priceIndex: Point[], yields: Point[], repayment = 2): Point[] {
  const out: Point[] = [];
  for (const [time, price] of priceIndex) {
    const rate = at(yields, time);
    if (rate !== null) out.push([time, (price * (Math.max(rate, 0) + repayment)) / 100]);
  }
  return out;
}

export interface ItemChange {
  item: PriceItems["items"][number];
  /** Preisänderung zwischen den beiden Jahren in Prozent. */
  change: number;
}

/** Preisänderung jeder Position zwischen zwei Jahren, absteigend. Positionen ohne Wert in einem der Jahre entfallen. */
export function itemChanges(prices: PriceItems, fromYear: number, toYear: number): ItemChange[] {
  const a = prices.years.indexOf(fromYear);
  const b = prices.years.indexOf(toYear);
  if (a < 0 || b < 0) return [];
  const out: ItemChange[] = [];
  for (const item of prices.items) {
    const before = item.values[a];
    const after = item.values[b];
    if (before && after !== null && after !== undefined) out.push({ item, change: (after / before - 1) * 100 });
  }
  return out.sort((x, y) => y.change - x.change);
}

/** Reihe einer Position ab `fromYear`, auf 100 im Startjahr gesetzt. */
export function itemSeries(prices: PriceItems, item: PriceItems["items"][number], fromYear: number): Point[] {
  const start = prices.years.indexOf(fromYear);
  const base = start >= 0 ? item.values[start] : null;
  if (!base) return [];
  const out: Point[] = [];
  for (let i = start; i < prices.years.length; i++) {
    const value = item.values[i];
    if (value !== null && value !== undefined) out.push([Date.UTC(prices.years[i]!, 0, 1), (value / base) * 100]);
  }
  return out;
}
