import { describe, expect, it } from "vitest";
import { changeBetween, contributions, financingCost, personalIndex, ratioIndex, workTimeChange, type PriceGroup } from "../src/lib/money.ts";
import { changes, combine, commonYears, median, ranking, rebase, spread, type RegionSeries } from "../src/lib/regions.ts";

const y = (year: number): number => Date.UTC(year, 0, 1);

describe("Mein Geld", () => {
  const groups: PriceGroup[] = [
    { code: "A", name: "Wohnen", data: [[y(2020), 100], [y(2021), 102], [y(2022), 104]] },
    { code: "B", name: "Verkehr", data: [[y(2020), 100], [y(2021), 110], [y(2022), 130]] },
    { code: "C", name: "Bildung", data: [[y(2021), 100], [y(2022), 100]] },
  ];

  it("gewichtet die Preisentwicklung mit dem eigenen Warenkorb", () => {
    const even = personalIndex(groups, new Map([["A", 1], ["B", 1]]), y(2020));
    expect(even.map((p) => p[1])).toEqual([100, 106, 117]);
    const noCar = personalIndex(groups, new Map([["A", 500], ["B", 0]]), y(2020));
    expect(noCar.map((p) => p[1])).toEqual([100, 102, 104]);
    // Gruppe C hat 2020 noch keinen Wert und bleibt außen vor, statt die Rechnung zu verfälschen.
    expect(personalIndex(groups, new Map([["A", 1], ["B", 1], ["C", 8]]), y(2020)).map((p) => p[1])).toEqual([100, 106, 117]);
    expect(personalIndex(groups, new Map(), y(2020))).toEqual([]);
  });

  it("zerlegt die Teuerung in Beiträge, die sich zur Gesamtteuerung addieren", () => {
    const parts = contributions(groups, new Map([["A", 3], ["B", 1]]), y(2020), y(2022));
    expect(parts.map((p) => Number(p.points.toFixed(6)))).toEqual([3, 7.5]);
    const total = personalIndex(groups, new Map([["A", 3], ["B", 1]]), y(2020)).at(-1)![1] - 100;
    expect(parts.reduce((sum, p) => sum + p.points, 0)).toBeCloseTo(total);
  });

  it("rechnet Preis- und Lohnänderung in Arbeitszeit um", () => {
    expect(workTimeChange(10, 10)).toBeCloseTo(0);
    expect(workTimeChange(21, 10)).toBeCloseTo(10);
    expect(workTimeChange(0, 25)).toBeCloseTo(-20);
    expect(changeBetween(groups[1]!.data, y(2020), y(2022))).toBeCloseTo(30);
    expect(changeBetween(groups[2]!.data, y(2020), y(2022))).toBeNull();
  });

  it("bildet Verhältnis und Finanzierungslast", () => {
    const price: [number, number][] = [[y(2020), 100], [y(2021), 120], [y(2022), 120]];
    const wage: [number, number][] = [[y(2020), 50], [y(2021), 50], [y(2022), 60]];
    expect(ratioIndex(price, wage, y(2020)).map((p) => p[1])).toEqual([100, 120, 100]);
    // Zins von 1 % auf 4 %: Bei gleichem Preis verdoppelt sich die Last aus Zins und 2 % Tilgung.
    const cost = financingCost([[y(2020), 100], [y(2022), 100]], [[y(2020), 1], [y(2022), 4]]);
    expect(cost.map((p) => p[1])).toEqual([3, 6]);
    expect(financingCost(price, [[y(2021), 1]])).toHaveLength(1);
  });
});

describe("Ländervergleich", () => {
  const gdp: RegionSeries[] = [
    { name: "Nord", data: [[y(2020), 100], [y(2024), 120]] },
    { name: "Süd", data: [[y(2020), 300], [y(2024), 330]] },
    { name: "Ohne Bevölkerung", data: [[y(2020), 1]] },
  ];
  const people: RegionSeries[] = [
    { name: "Nord", data: [[Date.UTC(2020, 11, 31), 2], [Date.UTC(2024, 11, 31), 2]] },
    { name: "Süd", data: [[Date.UTC(2020, 11, 31), 5], [Date.UTC(2024, 11, 31), 6]] },
  ];

  it("verbindet Tabellen je Land über das Jahr trotz abweichender Stichtage", () => {
    const perHead = combine(gdp, people, (a, b) => a / b);
    expect(perHead.map((s) => s.name)).toEqual(["Nord", "Süd"]);
    expect(perHead[1]!.data).toEqual([[y(2020), 60], [y(2024), 55]]);
    expect(ranking(perHead, 2024)).toEqual([{ name: "Nord", value: 60 }, { name: "Süd", value: 55 }]);
    expect(changes(perHead, 2020, 2024, false).map((r) => [r.name, Math.round(r.value * 10) / 10])).toEqual([["Nord", 20], ["Süd", -8.3]]);
    expect(changes(perHead, 2020, 2024, true)).toEqual([{ name: "Nord", value: 10 }, { name: "Süd", value: -5 }]);
    expect(commonYears(perHead)).toEqual([2020, 2024]);
    expect(commonYears(gdp)).toEqual([2020]);
  });

  it("misst die Schere und das mittlere Land", () => {
    const perHead = combine(gdp, people, (a, b) => a / b);
    const gaps = spread(perHead, [2020, 2024], false);
    expect(gaps.map((g) => [g.top.name, g.bottom.name, Number(g.gap.toFixed(3))])).toEqual([["Süd", "Nord", 1.2], ["Nord", "Süd", 1.091]]);
    expect(spread(perHead, [2020], true)[0]!.gap).toBe(10);
    expect(median(perHead, [2020])).toEqual([[y(2020), 55]]);
    expect(rebase(perHead, 2020)[0]!.data).toEqual([[y(2020), 100], [y(2024), 120]]);
    expect(rebase(perHead, 1999)).toEqual([]);
  });
});
