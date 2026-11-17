import { describe, expect, it } from "vitest";
import { staleDays, yearChange } from "../src/lib/catalog.ts";
import { formatDate, formatSigned, formatValue } from "../src/lib/format.ts";
import { comovement, describeComovement, indexTo100, niceTicks, pearson, thin } from "../src/lib/stats.ts";
import type { IndicatorMeta, Point, SeriesMeta } from "../src/lib/types.ts";

const month = (i: number): number => Date.UTC(2020, i, 1);
const DAY = 86_400_000;

describe("Vergleichsrechnung", () => {
  it("indexiert auf 100 und verweigert nicht positive Startwerte", () => {
    expect(indexTo100([[0, 50], [1, 75]])).toEqual([[0, 100], [1, 150]]);
    expect(indexTo100([[0, 0], [1, 5]])).toBeNull();
    expect(indexTo100([[0, -2], [1, 5]])).toBeNull();
  });

  it("berechnet Pearson", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
  });

  it("misst Gleichlauf an Veränderungen, nicht am gemeinsamen Trend", () => {
    // Beide Reihen steigen stark, schwanken aber gegenläufig um ihren Trend.
    const a: Point[] = Array.from({ length: 30 }, (_, i) => [month(i), i * 10 + (i % 2 ? 3 : -3)]);
    const b: Point[] = Array.from({ length: 30 }, (_, i) => [month(i), i * 10 + (i % 2 ? -3 : 3)]);
    const levels = pearson(a.map((p) => p[1]), b.map((p) => p[1]))!;
    expect(levels).toBeGreaterThan(0.95);
    const co = comovement(a, b)!;
    expect(co.r).toBeCloseTo(-1);
    expect(co.steps).toBe(29);
    expect(describeComovement(co.r)).toBe("starker Gegenlauf");
  });

  it("gleicht Tages- und Monatsreihen über den Monat ab und verlangt zwölf Schritte", () => {
    const daily: Point[] = Array.from({ length: 600 }, (_, i) => [Date.UTC(2020, 0, 1) + i * DAY, Math.sin(i / 40)]);
    const monthlySeries: Point[] = Array.from({ length: 19 }, (_, i) => [month(i), Math.sin((i * 30.4 + 28) / 40)]);
    expect(comovement(daily, monthlySeries)!.r).toBeGreaterThan(0.9);
    expect(comovement(daily.slice(0, 200), monthlySeries)).toBeNull();
  });

  it("wählt runde Achsenmarken und dünnt aus", () => {
    expect(niceTicks(0, 100)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(-0.4, 1.3, 4)).toEqual([0, 0.5, 1]);
    const data: Point[] = Array.from({ length: 1000 }, (_, i) => [i, i]);
    const out = thin(data, 100);
    expect(out).toHaveLength(100);
    expect(out[0]).toEqual([0, 0]);
    expect(out[99]).toEqual([999, 999]);
  });
});

describe("Kennzahlen und Formate", () => {
  const series = (last: number, before: number | null): SeriesMeta => ({
    name: "s",
    axis: 0,
    count: 2,
    first: [0, 1],
    last: [Date.UTC(2026, 0, 1), last],
    yearAgo: before === null ? null : [Date.UTC(2025, 0, 1), before],
    spark: [],
  });
  const indicator = (unit: string, intro: string, frequency: IndicatorMeta["frequency"] = "monatlich", s = series(110, 100)): IndicatorMeta => ({
    id: "i",
    title: "t",
    intro,
    unit,
    decimals: 1,
    stand: "",
    frequency,
    sources: [],
    tags: [],
    series: [s],
  });

  it("gibt Niveaus in Prozent und Raten in Punkten an", () => {
    expect(yearChange(indicator("", "Index"), series(110, 100))).toEqual({ value: expect.closeTo(10), unit: "%" });
    expect(yearChange(indicator("%", "in Prozent"), series(2.5, 4))).toEqual({ value: -1.5, unit: "Punkte" });
    expect(yearChange(indicator("", "Saldo"), series(5, -20))).toEqual({ value: 25, unit: "Punkte" });
    expect(yearChange(indicator("", "Index"), series(1, null))).toBeNull();
  });

  it("meldet auffällig alte Reihen abhängig vom Rhythmus", () => {
    expect(staleDays(indicator("", "", "monatlich"), "2026-03-01T00:00:00Z")).toBeNull();
    expect(staleDays(indicator("", "", "täglich"), "2026-03-01T00:00:00Z")).toBe(59);
    expect(staleDays(indicator("", "", "monatlich"), "2026-11-17T00:00:00Z")).toBe(320);
  });

  it("formatiert deutsch", () => {
    expect(formatValue(1750.75, 0, "")).toBe("1.751");
    expect(formatValue(2.7, 1, "%")).toBe("2,7 %");
    expect(formatSigned(-0.04, 1)).toBe("±0,0");
    expect(formatSigned(1.26, 1)).toBe("+1,3");
    expect(formatDate(Date.UTC(2025, 9, 1), "vierteljährlich")).toBe("4. Quartal 2025");
    expect(formatDate(Date.UTC(2026, 2, 1), "monatlich")).toBe("März 2026");
    expect(formatDate(Date.UTC(2026, 3, 7), "täglich")).toBe("7. April 2026");
  });
});

import { deflate, findExtreme, leadLag, perCapita, valueAt, yearOverYear } from "../src/lib/stats.ts";

describe("Vorlauf, Umrechnung, Auffälligkeit", () => {
  const m = (i: number): number => Date.UTC(2015, i, 1);
  // Unregelmäßiges, aber festes Muster ohne Zufall.
  const wave = (i: number): number => Math.sin(i * 0.9) * 5 + Math.sin(i * 0.37) * 3 + ((i * 7) % 5);

  it("erkennt, welche Reihe vorausläuft", () => {
    const a: Point[] = Array.from({ length: 80 }, (_, i) => [m(i), wave(i)]);
    const b: Point[] = Array.from({ length: 80 }, (_, i) => [m(i), wave(i - 3)]);
    const found = leadLag(a, b)!;
    expect(found.lead).toBe(3);
    expect(found.r).toBeGreaterThan(0.99);
    expect(leadLag(b, a)!.lead).toBe(-3);
    expect(leadLag(a, a)).toBeNull();
    expect(leadLag(a.slice(0, 10), b)).toBeNull();
  });

  it("liest Zwischenwerte linear und hält am Rand den Randwert", () => {
    const data: Point[] = [[0, 10], [10, 20]];
    expect(valueAt(data, 5)).toBe(15);
    expect(valueAt(data, -3)).toBe(10);
    expect(valueAt(data, 99)).toBe(20);
    expect(valueAt([], 1)).toBeNull();
  });

  it("rechnet in heutige Preise und je Kopf um", () => {
    const cpi: Point[] = [[m(0), 100], [m(12), 110], [m(24), 121]];
    expect(deflate([[m(0), 50], [m(24), 50], [m(400), 1]], cpi)).toEqual([[m(0), 60.5], [m(24), 50]]);
    expect(perCapita([[m(0), 4000]], [[m(0), 80]], 1000)).toEqual([[m(0), 50000]]);
  });

  it("bildet Vorjahresveränderungen", () => {
    const data: Point[] = Array.from({ length: 25 }, (_, i) => [m(i), 100 * 1.02 ** (i / 12)]);
    const yoy = yearOverYear(data);
    expect(yoy).toHaveLength(13);
    expect(yoy[0]![1]).toBeCloseTo(2, 5);
  });

  it("meldet einen Wert, der lange nicht erreicht wurde", () => {
    // Zehn Jahre flach mit kleinem Muster, dann ein Sprung: stärkster Anstieg im gesamten Zeitraum.
    const data: Point[] = Array.from({ length: 121 }, (_, i) => [m(i), 100 + (i % 6) + (i === 120 ? 30 : 0)]);
    const extreme = findExtreme(data, false)!;
    expect(extreme.dir).toBe("high");
    expect(extreme.since).toBeNull();
    expect(extreme.value).toBeGreaterThan(25);
    // Raten: der Stand selbst zählt; der Tiefstand von vor sieben Jahren wird als Bezug genannt.
    const rate: Point[] = Array.from({ length: 121 }, (_, i) => [m(i), i === 36 ? 1 : i === 120 ? 1.5 : 5 + (i % 4)]);
    const low = findExtreme(rate, true)!;
    expect(low.dir).toBe("low");
    expect(low.since).toBe(m(36));
    expect(low.years).toBeCloseTo(7, 1);
    expect(findExtreme(rate.slice(0, 60), true)).toBeNull();
  });
});
