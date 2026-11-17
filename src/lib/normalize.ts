// Übersetzt die Rohantworten der Dashboard-Deutschland-API in das schlanke Format der App.
// Reine Funktionen ohne Netz und Dateizugriff, damit sie sich testen lassen.
import type { Frequency, IndicatorData, IndicatorMeta, Point, SeriesMeta, Source, Theme } from "./types.ts";

const DAY = 86_400_000;

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferFrequency(times: number[]): Frequency {
  if (times.length < 2) return "jährlich";
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) gaps.push(times[i]! - times[i - 1]!);
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)]! / DAY;
  if (median < 3) return "täglich";
  if (median < 10) return "wöchentlich";
  if (median < 45) return "monatlich";
  if (median < 135) return "vierteljährlich";
  return "jährlich";
}

/** Letzter Punkt, der höchstens `tolerance` vom Zielzeitpunkt entfernt liegt. */
export function pointNear(data: Point[], target: number, tolerance: number): Point | null {
  let best: Point | null = null;
  let bestDist = Infinity;
  for (const p of data) {
    const dist = Math.abs(p[0] - target);
    if (dist < bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  return best && bestDist <= tolerance ? best : null;
}

export function sparkline(data: Point[], maxPoints = 48, years = 5): number[] {
  if (data.length === 0) return [];
  const from = data[data.length - 1]![0] - years * 365.25 * DAY;
  const recent = data.filter((p) => p[0] >= from);
  const base = recent.length >= 8 ? recent : data;
  if (base.length <= maxPoints) return base.map((p) => p[1]);
  const out: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(base[Math.round((i * (base.length - 1)) / (maxPoints - 1))]![1]);
  }
  return out;
}

/** Kennwerte einer Reihe für den Katalog. `data` muss zeitlich sortiert sein und mindestens einen Punkt haben. */
export function seriesMeta(name: string, data: Point[], axis = 0): SeriesMeta {
  const last = data[data.length - 1]!;
  return {
    name,
    axis,
    count: data.length,
    first: data[0]!,
    last,
    yearAgo: pointNear(data, last[0] - 365.25 * DAY, 20 * DAY),
    spark: sparkline(data),
  };
}

function round(value: number): number {
  return Number(value.toPrecision(9));
}

interface RawSeries {
  name?: string;
  yAxis?: number;
  data?: unknown[];
}

export interface RawTooltip {
  mathOperation?: string;
  mathPow?: string | number;
  valueSuffix?: string | null;
  suffix?: string | null;
  decimals?: number | null;
  valueDecimals?: number | null;
}

interface RawTile {
  id: string;
  title?: string;
  introtext?: string;
  dataVersionDate?: string;
  tags?: string[];
  sources?: { name?: string; link?: string }[];
  components?: { type?: string; chart?: { series?: RawSeries[]; tooltip?: RawTooltip } }[];
}

// Die Quelle pflegt Einheiten uneinheitlich: Währungszeichen stehen dort ohne Größenordnung
// („€“ bei Milliardenwerten). Solche Angaben lassen wir weg; die Größenordnung nennt der Introtext.
const AMBIGUOUS_UNITS = new Set(["€", "$", "Millionen", "Personen", "Index", "Punkte"]);

export function unitOf(tooltip: RawTooltip, intro: string): string {
  for (const candidate of [tooltip.valueSuffix, tooltip.suffix]) {
    const unit = (candidate ?? "").replace(/^[\s:]+/, "").trim();
    if (unit && !AMBIGUOUS_UNITS.has(unit)) return unit;
  }
  if (/Prozent(?!punkt)/.test(intro) && !/Prozentpunkt/.test(intro)) return "%";
  return "";
}

/**
 * Manche Reihen liegen in Grundeinheiten vor, obwohl der Introtext „in Mio.“ oder „in Tausend“
 * ankündigt (die Quelle rechnet erst in der Achsbeschriftung um). Dann rechnen wir hier um.
 */
export function introScale(intro: string, magnitude: number): number {
  if (/\bMio\./.test(intro) && magnitude >= 1e5) return 1e-6;
  if (/\b(Tsd\.|Tausend)/.test(intro) && magnitude >= 1e3) return 1e-3;
  return 1;
}

function scaleOf(tooltip: RawTooltip): number {
  const pow = Number(tooltip.mathPow ?? 1);
  if (!Number.isFinite(pow) || pow === 0) return 1;
  return tooltip.mathOperation === "MATH_DIVIDER" ? 1 / pow : pow;
}

function cleanPoints(raw: unknown[] | undefined, scale: number): Point[] {
  const points: Point[] = [];
  for (const item of raw ?? []) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const [t, v] = item as [unknown, unknown];
    if (typeof t !== "number" || typeof v !== "number") continue;
    if (!Number.isFinite(t) || !Number.isFinite(v) || t < 1e11) continue;
    points.push([t, round(v * scale)]);
  }
  points.sort((a, b) => a[0] - b[0]);
  return points;
}

function decimalsFor(values: number[], hint: number | null | undefined): number {
  const max = Math.max(...values.map((v) => Math.abs(v)));
  const natural = max >= 1000 ? 0 : max >= 100 ? 1 : max >= 10 ? 1 : 2;
  if (typeof hint === "number" && hint > 0 && hint <= 3) return Math.max(hint, natural === 0 ? 0 : 1);
  return natural;
}

export interface NormalizedIndicator {
  meta: IndicatorMeta;
  data: IndicatorData;
}

/** `rawJson` ist der Inhalt des Felds `json` eines Eintrags aus `/api/tile/indicators`. */
export function normalizeIndicator(rawJson: string): NormalizedIndicator | null {
  const tile = JSON.parse(rawJson) as RawTile;
  const chart = tile.components?.find((c) => c.type === "highcharts")?.chart;
  if (!chart?.series) return null;
  const tooltip = chart.tooltip ?? {};
  const intro = stripHtml(tile.introtext ?? "");
  let scale = scaleOf(tooltip);
  if (scale === 1) {
    const magnitude = Math.max(0, ...chart.series.flatMap((s) => cleanPoints(s.data, 1).slice(-1).map((p) => Math.abs(p[1]))));
    scale = introScale(intro, magnitude);
  }

  const metas: SeriesMeta[] = [];
  const series: IndicatorData["series"] = [];
  for (const raw of chart.series) {
    const data = cleanPoints(raw.data, scale);
    if (data.length < 2) continue;
    const name = stripHtml(raw.name ?? "").replace(/\s*\((linke|rechte) Achse\)/i, "") || "Wert";
    metas.push(seriesMeta(name, data, raw.yAxis ?? 0));
    series.push({ name, data });
  }
  if (metas.length === 0) return null;

  const sources: Source[] = (tile.sources ?? [])
    .filter((s) => s.name)
    .map((s) => ({ name: s.name!, link: s.link ?? "" }));

  const meta: IndicatorMeta = {
    id: tile.id,
    title: stripHtml(tile.title ?? tile.id),
    intro,
    unit: unitOf(tooltip, intro),
    decimals: unitOf(tooltip, intro) === "%" ? 1 : decimalsFor(metas.map((m) => m.last[1]), tooltip.decimals ?? tooltip.valueDecimals),
    stand: stripHtml(tile.dataVersionDate ?? ""),
    frequency: inferFrequency(series[0]!.data.map((p) => p[0])),
    sources,
    tags: (tile.tags ?? []).map(stripHtml),
    series: metas,
  };
  return { meta, data: { id: tile.id, series } };
}

interface RawDashboard {
  id: string;
  name?: string;
  description?: string;
  layoutTiles?: { indicatorid: string; orderIndex?: number }[];
}

export function normalizeThemes(dashboards: RawDashboard[], knownIds: Set<string>): Theme[] {
  return dashboards
    .map((d) => ({
      id: d.id,
      name: d.name ?? d.id,
      description: stripHtml(d.description ?? ""),
      indicatorIds: [...(d.layoutTiles ?? [])]
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        .map((t) => t.indicatorid)
        .filter((id, i, all) => knownIds.has(id) && all.indexOf(id) === i),
    }))
    .filter((t) => t.indicatorIds.length > 0);
}
