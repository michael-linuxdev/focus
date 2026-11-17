import type { SeriesRef } from "./curated.ts";
import type { Catalog, IndicatorMeta, SeriesMeta } from "./types.ts";

/** Reihen, deren Werte selbst schon Veränderungsraten oder Anteile sind. */
export function isRate(indicator: IndicatorMeta): boolean {
  return indicator.unit === "%" || /Veränderung|Prozentpunkt/.test(indicator.intro);
}

export interface Resolved {
  indicator: IndicatorMeta;
  index: number;
  series: SeriesMeta;
}

export function resolve(catalog: Catalog, ref: SeriesRef): Resolved | null {
  const indicator = catalog.indicators.find((i) => i.id === ref.indicator);
  if (!indicator) return null;
  const index = ref.series ? indicator.series.findIndex((sr) => sr.name === ref.series) : 0;
  const series = indicator.series[index];
  return series ? { indicator, index, series } : null;
}

export interface Change {
  /** Veränderung zum Vorjahr: in Prozent, bei Raten in Prozentpunkten. */
  value: number;
  unit: "%" | "Punkte";
}

export function yearChange(indicator: IndicatorMeta, series: SeriesMeta): Change | null {
  if (!series.yearAgo) return null;
  const before = series.yearAgo[1];
  const now = series.last[1];
  if (isRate(indicator) || before <= 0 || now <= 0) return { value: now - before, unit: "Punkte" };
  return { value: (now / before - 1) * 100, unit: "%" };
}

export function search(catalog: Catalog, query: string): IndicatorMeta[] {
  const words = query.toLocaleLowerCase("de").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return catalog.indicators.filter((i) => {
    const hay = [i.title, i.intro, ...i.tags, ...i.series.map((sr) => sr.name)].join(" ").toLocaleLowerCase("de");
    return words.every((w) => hay.includes(w));
  });
}

const DAY = 86_400_000;
const STALE_AFTER_DAYS: Record<IndicatorMeta["frequency"], number> = {
  täglich: 21,
  wöchentlich: 45,
  monatlich: 150,
  vierteljährlich: 300,
  jährlich: 900,
};

/** Tage seit dem jüngsten Wert, falls die Reihe für ihren Rhythmus auffällig alt ist; sonst null. */
export function staleDays(indicator: IndicatorMeta, fetchedAt: string): number | null {
  const newest = Math.max(...indicator.series.map((sr) => sr.last[0]));
  const days = Math.floor((Date.parse(fetchedAt) - newest) / DAY);
  return days > STALE_AFTER_DAYS[indicator.frequency] ? days : null;
}
