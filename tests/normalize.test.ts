import { describe, expect, it } from "vitest";
import { inferFrequency, introScale, normalizeIndicator, normalizeThemes, pointNear, stripHtml, unitOf } from "../src/lib/normalize.ts";

const DAY = 86_400_000;
const month = (y: number, m: number): number => Date.UTC(y, m, 1);

function tile(overrides: Record<string, unknown> = {}, tooltip: Record<string, unknown> = {}, series?: unknown[]): string {
  return JSON.stringify({
    id: "t1",
    title: "Außen&shy;handel",
    introtext: "<p>in Mrd. Euro,&nbsp;saisonbereinigt</p>",
    dataVersionDate: "Januar 2026",
    tags: ["Export"],
    sources: [{ name: "Destatis", link: "https://www.destatis.de/" }, { link: "ohne-namen" }],
    components: [
      { type: "text", text: "…" },
      {
        type: "highcharts",
        chart: {
          tooltip: { mathOperation: "MATH_DIVIDER", mathPow: "1000000", valueSuffix: " Mrd. €", ...tooltip },
          series: series ?? [
            { name: "Exporte (linke Achse)", data: Array.from({ length: 14 }, (_, i) => [month(2025, i), 100_000_000 + i * 1_000_000]) },
            { name: "Leer", data: [] },
            { name: "Importe", yAxis: 1, data: [[month(2025, 1), 5], [month(2025, 0), 4], [month(2025, 2), null], ["x", 1]] },
          ],
        },
      },
    ],
    ...overrides,
  });
}

describe("normalizeIndicator", () => {
  it("rechnet Werte um, sortiert, verwirft Lücken und leere Reihen", () => {
    const result = normalizeIndicator(tile())!;
    expect(result.meta.series.map((s) => s.name)).toEqual(["Exporte", "Importe"]);
    expect(result.meta.unit).toBe("Mrd. €");
    expect(result.meta.intro).toBe("in Mrd. Euro, saisonbereinigt");
    expect(result.meta.stand).toBe("Januar 2026");
    expect(result.meta.frequency).toBe("monatlich");
    expect(result.meta.sources).toEqual([{ name: "Destatis", link: "https://www.destatis.de/" }]);
    expect(result.data.series[0]!.data[0]).toEqual([month(2025, 0), 100]);
    expect(result.meta.series[0]!.last).toEqual([month(2026, 1), 113]);
    expect(result.meta.series[0]!.yearAgo).toEqual([month(2025, 1), 101]);
    expect(result.data.series[1]!.data.map((p) => p[1])).toEqual([0.000004, 0.000005]);
    expect(result.meta.series[1]!.axis).toBe(1);
  });

  it("liefert null ohne Diagramm oder ohne verwertbare Reihe", () => {
    expect(normalizeIndicator(JSON.stringify({ id: "x", components: [{ type: "text" }] }))).toBeNull();
    expect(normalizeIndicator(tile({}, {}, [{ name: "a", data: [[month(2025, 0), 1]] }]))).toBeNull();
  });

  it("rechnet Grundeinheiten um, wenn der Introtext Millionen ankündigt", () => {
    const result = normalizeIndicator(
      tile({ introtext: "in Mio. Personen" }, { mathOperation: "MATH_MULTIPLIER", mathPow: 1, valueSuffix: "" }, [
        { name: "Arbeitslose", data: [[month(2025, 0), 2_900_000], [month(2025, 1), 2_950_000]] },
      ]),
    )!;
    expect(result.meta.series[0]!.last[1]).toBe(2.95);
  });
});

describe("Einheiten", () => {
  it("lässt mehrdeutige Angaben weg und erkennt Prozent aus dem Introtext", () => {
    expect(unitOf({ valueSuffix: "", suffix: " €" }, "in Mrd. Euro")).toBe("");
    expect(unitOf({ valueSuffix: " Millionen", suffix: " Personen" }, "in Mio. Personen")).toBe("");
    expect(unitOf({ valueSuffix: " TWh" }, "")).toBe("TWh");
    expect(unitOf({}, "in Prozent")).toBe("%");
    expect(unitOf({}, "in Prozentpunkten")).toBe("");
  });

  it("skaliert nur, wenn die Größenordnung dazu passt", () => {
    expect(introScale("in Mio. Personen", 45.5)).toBe(1);
    expect(introScale("in Mio. Personen", 2_900_000)).toBe(1e-6);
    expect(introScale("Kursindex, in Tausend Punkten", 23_640)).toBe(1e-3);
    expect(introScale("Index, 2015 = 100", 23_640)).toBe(1);
  });
});

describe("Hilfen", () => {
  it("erkennt den Rhythmus am mittleren Abstand", () => {
    const every = (days: number): number[] => Array.from({ length: 10 }, (_, i) => i * days * DAY);
    expect(inferFrequency(every(1))).toBe("täglich");
    expect(inferFrequency(every(7))).toBe("wöchentlich");
    expect(inferFrequency(every(30))).toBe("monatlich");
    expect(inferFrequency(every(91))).toBe("vierteljährlich");
    expect(inferFrequency(every(365))).toBe("jährlich");
  });

  it("findet den Vorjahreswert nur innerhalb der Toleranz", () => {
    const data: [number, number][] = [[0, 1], [100 * DAY, 2]];
    expect(pointNear(data, 95 * DAY, 10 * DAY)).toEqual([100 * DAY, 2]);
    expect(pointNear(data, 50 * DAY, 10 * DAY)).toBeNull();
  });

  it("entfernt Markup und Entitäten", () => {
    expect(stripHtml("<p>a&nbsp;&amp; <b>b</b></p>")).toBe("a & b");
  });

  it("ordnet Themen und lässt unbekannte Indikatoren weg", () => {
    const themes = normalizeThemes(
      [
        { id: "a", name: "A", layoutTiles: [{ indicatorid: "y", orderIndex: 2 }, { indicatorid: "x", orderIndex: 1 }, { indicatorid: "x", orderIndex: 3 }, { indicatorid: "z" }] },
        { id: "leer", layoutTiles: [{ indicatorid: "z" }] },
      ],
      new Set(["x", "y"]),
    );
    expect(themes).toEqual([{ id: "a", name: "A", description: "", indicatorIds: ["x", "y"] }]);
  });
});
