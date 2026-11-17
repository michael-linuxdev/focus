import type { SeriesRef } from "./curated.ts";
import { formatDate, formatSigned, formatValue } from "./format.ts";
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

export interface Notable {
  indicator: IndicatorMeta;
  series: SeriesMeta;
  /** Fertiger Satzteil, z. B. „stärkster Anstieg zum Vorjahr seit März 2011“. */
  text: string;
  value: string;
}

function sinceText(indicator: IndicatorMeta, series: SeriesMeta): string {
  const extreme = series.extreme!;
  if (extreme.since === null) return `im gesamten Zeitraum der Reihe (ab ${new Date(series.first[0]).getUTCFullYear()})`;
  return `seit ${formatDate(extreme.since, indicator.frequency)}`;
}

/** Beschreibt den auffälligen Wert einer Reihe in Worten. */
export function describeExtreme(indicator: IndicatorMeta, series: SeriesMeta): Notable | null {
  const extreme = series.extreme;
  if (!extreme) return null;
  const since = sinceText(indicator, series);
  if (isRate(indicator)) {
    return {
      indicator,
      series,
      text: `${extreme.dir === "high" ? "höchster" : "niedrigster"} Stand ${since}`,
      value: formatValue(extreme.value, indicator.decimals, indicator.unit),
    };
  }
  const rising = extreme.value >= 0;
  const text =
    extreme.dir === "high"
      ? rising
        ? `stärkster Anstieg zum Vorjahr ${since}`
        : `geringster Rückgang zum Vorjahr ${since}`
      : rising
        ? `schwächster Anstieg zum Vorjahr ${since}`
        : `stärkster Rückgang zum Vorjahr ${since}`;
  return { indicator, series, text, value: `${formatSigned(extreme.value, 1)} %` };
}

/**
 * Die auffälligsten Reihen des Katalogs: je Indikator höchstens eine, sortiert nach der Länge des Zeitraums
 * ohne vergleichbaren Wert. Veraltete Reihen und Ländertabellen bleiben außen vor.
 */
export function notable(catalog: Catalog, limit: number): Notable[] {
  const found: Notable[] = [];
  for (const indicator of catalog.indicators) {
    if (indicator.region || staleDays(indicator, catalog.fetchedAt) !== null) continue;
    const best = indicator.series.filter((sr) => sr.extreme).sort((a, b) => b.extreme!.years - a.extreme!.years)[0];
    const described = best ? describeExtreme(indicator, best) : null;
    if (described) found.push(described);
  }
  return found.sort((a, b) => b.series.extreme!.years - a.series.extreme!.years).slice(0, limit);
}

/** Geldbeträge, die sich preisbereinigen und je Einwohner umrechnen lassen; liefert den Faktor auf Euro. */
export function euroScale(indicator: IndicatorMeta): number | null {
  const text = `${indicator.intro} ${indicator.unit}`;
  if (!/Euro|€/.test(text) || /Index|preisbereinigt|je Einwohner|pro Liter|pro Megawatt|je Barrel|Prozent/i.test(text)) return null;
  if (/Mrd\./.test(text)) return 1e9;
  if (/Mio\./.test(text)) return 1e6;
  if (/Tsd\.|Tausend/.test(text)) return 1e3;
  return 1;
}
