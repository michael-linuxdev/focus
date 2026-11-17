// Bereich „Mein Geld“: persönliche Teuerung, Lohn gegen Preise, Arbeitszeit, Erschwinglichkeit von Wohneigentum.
import { formatDate, formatNumber, formatSigned } from "../lib/format.ts";
import { changeBetween, contributions, financingCost, personalIndex, ratioIndex, workTimeChange, type PriceGroup } from "../lib/money.ts";
import { clip, indexTo100 } from "../lib/stats.ts";
import type { Facts, Point } from "../lib/types.ts";
import { loadData, loadFacts, loadSeries, store } from "../state.ts";
import { barList } from "../ui/bars.ts";
import { legend, lineChart } from "../ui/chart.ts";
import { h, set } from "../ui/dom.ts";

const PRICE_GROUPS = "genesis_61111-0003";
const WAGES = "genesis_62361-0026";
// Gesamtgröße mit der längsten Reihe; „A-S“ (einschließlich Landwirtschaft) gibt es erst seit 2022.
const WAGE_TOTALS = ["WZ08-B-S", "WZ08-A-S"];
const HOUSE_PRICES = "genesis_61262-0002";
const YIELDS = "data_umlaufrenditen_bundesanleihen";
const FUEL = "tile_1667921381760";
const STORAGE_KEY = "lagebild.gewichte";
const TANK_LITRES = 50;

const jan = (year: number): number => Date.UTC(year, 0, 1);
const yearOf = (time: number): number => new Date(time).getUTCFullYear();
const pct = (value: number, decimals = 1): string => `${formatSigned(value, decimals)} %`;

function readWeights(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : null;
  } catch {
    return null;
  }
}

function writeWeights(weights: Map<string, number> | null): void {
  try {
    if (weights) localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(weights)));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ohne Speicher gelten die Eingaben nur bis zum Neuladen.
  }
}

/** Jahresmittel einer Reihe mit Tages- oder Monatswerten. */
function yearlyMean(data: Point[]): Map<number, number> {
  const sums = new Map<number, { sum: number; n: number }>();
  for (const [t, v] of data) {
    const entry = sums.get(yearOf(t)) ?? { sum: 0, n: 0 };
    entry.sum += v;
    entry.n++;
    sums.set(yearOf(t), entry);
  }
  return new Map([...sums].map(([year, { sum, n }]) => [year, sum / n]));
}

interface Loaded {
  groups: PriceGroup[];
  facts: Facts;
  wages: { code: string; name: string; data: Point[] }[];
  house: Point[] | null;
  yields: Point[] | null;
  fuel: Point[] | null;
}

async function load(): Promise<Loaded> {
  const catalog = store.catalog;
  const priceMeta = catalog.indicators.find((i) => i.id === PRICE_GROUPS);
  const wageMeta = catalog.indicators.find((i) => i.id === WAGES);
  if (!priceMeta || !wageMeta) throw new Error("Die Preis- und Verdiensttabellen aus GENESIS-Online fehlen im Datenstand.");
  const [prices, wageData, facts, house, yields, fuel] = await Promise.all([
    loadData(PRICE_GROUPS),
    loadData(WAGES),
    loadFacts(),
    loadSeries(HOUSE_PRICES, "Häuserpreisindex"),
    loadSeries(YIELDS, "10 Jahre"),
    loadSeries(FUEL, "Super E10"),
  ]);
  return {
    groups: priceMeta.series
      .map((meta, i) => ({ code: meta.code ?? meta.name, name: meta.name, data: prices.series[i]!.data }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    facts,
    wages: wageMeta.series.map((meta, i) => ({ code: meta.code ?? meta.name, name: meta.name, data: wageData.series[i]!.data })),
    house: house?.data ?? null,
    yields: yields?.data ?? null,
    fuel: fuel?.data ?? null,
  };
}

export function viewGeld(): HTMLElement {
  const body = h("div", {}, h("p", { class: "muted" }, "Daten werden geladen …"));
  const root = h(
    "div",
    {},
    h("h1", {}, "Mein Geld"),
    h("p", { class: "lead" }, "Die amtliche Teuerung gilt für einen Durchschnittshaushalt. Hier rechnest du mit deinem eigenen Warenkorb und deiner Branche: Was ist für dich teurer geworden, und hat der Lohn mitgehalten?"),
    body,
  );

  load().then(
    (loaded) => {
      const { groups, facts } = loaded;
      const official = new Map(facts.weights.map((w) => [w.code, w.permille / 10]));
      const stored = readWeights();
      const weights = new Map(groups.map((g) => [g.code, stored?.[g.code] ?? official.get(g.code) ?? 0]));
      const lastYear = Math.min(...groups.map((g) => yearOf(g.data[g.data.length - 1]![0])));
      const firstYear = Math.max(...groups.map((g) => yearOf(g.data[0]![0])));
      const totalWage = WAGE_TOTALS.map((code) => loaded.wages.find((w) => w.code === code)).find((w) => w !== undefined) ?? loaded.wages[0]!;
      let baseYear = Math.min(2020, lastYear - 1);
      let sector = totalWage.code;

      const results = h("div", {});

      const renderResults = (): void => {
        const from = jan(baseYear);
        const to = jan(lastYear);
        const mine = personalIndex(groups, weights, from);
        const avg = personalIndex(groups, official, from);
        const mineChange = (mine[mine.length - 1]?.[1] ?? 100) - 100;
        const avgChange = (avg[avg.length - 1]?.[1] ?? 100) - 100;
        const customised = [...weights].some(([code, value]) => Math.abs(value - (official.get(code) ?? 0)) > 0.05);
        const parts = contributions(groups, weights, from, to).sort((a, b) => b.points - a.points);

        // ---------- Teuerung ----------
        const inflation = h(
          "div",
          { class: "cols" },
          h(
            "div",
            { class: "panel" },
            h("h3", {}, `Dein Preisanstieg ${baseYear} bis ${lastYear}`),
            h("p", { class: "big" }, pct(mineChange)),
            h(
              "p",
              { class: "muted small" },
              customised
                ? `Mit dem amtlichen Warenkorb wären es ${pct(avgChange)}. Dein Warenkorb ist also ${Math.abs(mineChange - avgChange) < 0.05 ? "gleich stark" : mineChange > avgChange ? `um ${formatNumber(mineChange - avgChange, 1)} Punkte stärker` : `um ${formatNumber(avgChange - mineChange, 1)} Punkte schwächer`} betroffen.`
                : "Das ist der amtliche Warenkorb. Stelle oben deinen eigenen ein, um deinen Wert zu sehen.",
            ),
            customised ? legend([{ name: "dein Warenkorb", slot: 1 }, { name: "amtlicher Warenkorb", slot: 2 }]) : null,
            lineChart({
              series: customised ? [{ name: "dein Warenkorb", slot: 1, data: mine }, { name: "amtlicher Warenkorb", slot: 2, data: avg }] : [{ name: "amtlicher Warenkorb", slot: 1, data: avg }],
              frequency: "jährlich",
              decimals: 1,
              unit: "",
              height: 240,
              label: `Preisindex deines Warenkorbs, ${baseYear} = 100`,
            }),
            h("p", { class: "muted small" }, `Index, ${baseYear} = 100, Jahresdurchschnitte.`),
          ),
          h(
            "div",
            { class: "panel" },
            h("h3", {}, "Woher der Anstieg kommt"),
            h("p", { class: "muted small" }, "Beitrag jeder Ausgabengruppe in Prozentpunkten: Preisänderung mal dein Ausgabenanteil."),
            barList(parts.map((p) => ({ label: p.name, value: p.points })), (v) => formatSigned(v, 1), "Beiträge der Ausgabengruppen zur Teuerung in Prozentpunkten"),
          ),
        );

        // ---------- Lohn ----------
        const wageSeries = loaded.wages.find((w) => w.code === sector) ?? totalWage;
        const wageFirstYear = yearOf(wageSeries.data[0]![0]);
        const wageLastYear = yearOf(wageSeries.data[wageSeries.data.length - 1]![0]);
        const wageBase = Math.max(baseYear, wageFirstYear);
        const wageEnd = Math.min(lastYear, wageLastYear);
        const mineFromWageBase = personalIndex(groups, weights, jan(wageBase));
        const priceChange = changeBetween(mineFromWageBase, jan(wageBase), jan(wageEnd));
        const wageChange = changeBetween(wageSeries.data, jan(wageBase), jan(wageEnd));
        const wageIndexed = indexTo100(clip(wageSeries.data, jan(wageBase), jan(wageEnd))) ?? [];
        const real = priceChange !== null && wageChange !== null ? ((1 + wageChange / 100) / (1 + priceChange / 100) - 1) * 100 : null;
        const wagePanel = h(
          "div",
          { class: "panel" },
          h("h3", {}, `Hält der Lohn mit? ${wageBase} bis ${wageEnd}`),
          real !== null && wageChange !== null && priceChange !== null
            ? h(
                "div",
                {},
                h("p", { class: "big" }, pct(real)),
                h(
                  "p",
                  { class: "muted small" },
                  `Kaufkraft eines durchschnittlichen Bruttoverdienstes (${wageSeries.name}): Verdienste ${pct(wageChange)}, deine Preise ${pct(priceChange)}.`,
                  wageBase > baseYear ? ` Die Verdienstreihe beginnt erst ${wageFirstYear}.` : "",
                ),
              )
            : h("p", { class: "muted" }, "Für diesen Zeitraum liegen keine Verdienstdaten vor."),
          legend([{ name: `Verdienste: ${wageSeries.name}`, slot: 3 }, { name: "deine Preise", slot: 1 }]),
          lineChart({
            series: [{ name: `Verdienste: ${wageSeries.name}`, slot: 3, data: wageIndexed }, { name: "deine Preise", slot: 1, data: clip(mineFromWageBase, jan(wageBase), jan(wageEnd)) }],
            frequency: "jährlich",
            decimals: 1,
            unit: "",
            height: 240,
            label: `Verdienste und Preise, ${wageBase} = 100`,
          }),
          h("p", { class: "muted small" }, `Index, ${wageBase} = 100. Bruttomonatsverdienste einschließlich Sonderzahlungen; Steuern und Abgaben sind nicht berücksichtigt.`),
        );

        // ---------- Arbeitszeit ----------
        const timeItems =
          wageChange === null
            ? []
            : groups
                .map((g) => ({ label: g.name, change: changeBetween(g.data, jan(wageBase), jan(wageEnd)) }))
                .filter((item): item is { label: string; change: number } => item.change !== null)
                .map((item) => ({ label: item.label, value: workTimeChange(item.change, wageChange) }))
                .sort((a, b) => b.value - a.value);
        const hourly = facts.earnings.find((e) => !e.sex && !e.age)?.hourlyMean;
        let tank: HTMLElement | null = null;
        if (hourly && loaded.fuel) {
          const fuelByYear = yearlyMean(loaded.fuel);
          const wageByYear = new Map(totalWage.data.map(([t, v]) => [yearOf(t), v]));
          const refYear = Number(facts.earningsStand.split("/")[1]);
          const refIndex = wageByYear.get(refYear);
          const years = [...fuelByYear.keys()].filter((year) => wageByYear.has(year)).sort((a, b) => a - b);
          const minutes = (year: number): number => ((TANK_LITRES * fuelByYear.get(year)!) / ((hourly * wageByYear.get(year)!) / refIndex!)) * 60;
          if (refIndex && years.length >= 2) {
            const a = years[0]!;
            const b = years[years.length - 1]!;
            tank = h(
              "p",
              { class: "note" },
              `Beispiel Tankfüllung: ${TANK_LITRES} Liter Super E10 kosteten ${a} rund ${formatNumber(minutes(a), 0)} Minuten Arbeit, ${b} rund ${formatNumber(minutes(b), 0)} Minuten – gerechnet mit dem durchschnittlichen Bruttostundenverdienst (${formatNumber(hourly, 2)} Euro im Stichmonat ${facts.earningsStand}, mit dem Verdienstindex auf die Jahre übertragen) und dem Jahresmittel der Tankstellenpreise.`,
            );
          }
        }
        const timePanel = h(
          "div",
          { class: "panel" },
          h("h3", {}, `Arbeitszeit statt Euro: ${wageBase} bis ${wageEnd}`),
          h("p", { class: "muted small" }, `Wie viel länger oder kürzer man für dieselben Waren arbeiten muss, in Prozent. Preisänderung der Gruppe gegen Verdienständerung (${wageSeries.name}).`),
          timeItems.length ? barList(timeItems, (v) => pct(v), "Veränderung der nötigen Arbeitszeit je Ausgabengruppe in Prozent") : h("p", { class: "muted" }, "Keine Verdienstdaten für diesen Zeitraum."),
          tank,
        );

        // ---------- Wohneigentum ----------
        let housePanel: HTMLElement | null = null;
        if (loaded.house) {
          const houseBase = Math.max(baseYear, yearOf(totalWage.data[0]![0]), yearOf(loaded.house[0]![0]));
          const priceToWage = ratioIndex(loaded.house, totalWage.data, jan(houseBase));
          const series = [{ name: "Hauspreise gemessen am Verdienst", slot: 1, data: priceToWage }];
          let rateNote = "";
          if (loaded.yields) {
            const rateBase = Math.max(jan(houseBase), loaded.yields[0]![0]);
            const burden = ratioIndex(financingCost(loaded.house, loaded.yields), totalWage.data, loaded.house.find((p) => p[0] >= rateBase)?.[0] ?? rateBase);
            if (burden.length > 1) {
              series.push({ name: "Rate aus Zins und Tilgung gemessen am Verdienst", slot: 2, data: burden });
              rateNote = ` Die Rate unterstellt volle Finanzierung, zwei Prozent Tilgung und als Zins die Rendite zehnjähriger Bundesanleihen; echte Bauzinsen liegen darüber, bewegen sich aber ähnlich. Sie beginnt ${formatDate(burden[0]![0], "vierteljährlich")} bei 100, weil die Zinsreihe nicht weiter zurückreicht.`;
            }
          }
          const lastRatio = priceToWage[priceToWage.length - 1];
          housePanel = h(
            "div",
            { class: "panel" },
            h("h3", {}, `Wohneigentum: Wie erschwinglich ist ein Haus? Seit ${houseBase}`),
            lastRatio
              ? h(
                  "p",
                  { class: "muted small" },
                  `Gemessen am durchschnittlichen Verdienst kostet ein Haus ${Math.abs(lastRatio[1] - 100) < 0.05 ? "so viel wie" : `${formatNumber(Math.abs(lastRatio[1] - 100), 1)} % ${lastRatio[1] > 100 ? "mehr" : "weniger"} als`} ${houseBase} (Stand ${formatDate(lastRatio[0], "vierteljährlich")}).`,
                )
              : null,
            series.length > 1 ? legend(series) : null,
            lineChart({ series, frequency: "vierteljährlich", decimals: 1, unit: "", height: 260, label: "Hauspreise und Finanzierungslast gemessen am Verdienst" }),
            h("p", { class: "muted small" }, `Index, ${houseBase} = 100: Häuserpreisindex geteilt durch den Verdienstindex (${totalWage.name}).${rateNote}`),
          );
        }

        set(results, inflation, h("div", { class: "cols" }, wagePanel, timePanel), housePanel);
      };

      // ---------- Eingaben ----------
      const sum = h("span", { class: "muted small" });
      const updateSum = (): void => {
        const total = [...weights.values()].reduce((a, b) => a + b, 0);
        sum.textContent = `Summe ${formatNumber(total, 1)} % – die Anteile werden auf 100 % umgerechnet.`;
      };
      const inputs = groups.map((g) => {
        const input = h("input", { type: "number", min: 0, max: 100, step: 0.5, value: Number((weights.get(g.code) ?? 0).toFixed(1)), "aria-label": `Ausgabenanteil ${g.name} in Prozent` });
        input.addEventListener("input", () => {
          const value = Number(input.value);
          weights.set(g.code, Number.isFinite(value) && value >= 0 ? value : 0);
          writeWeights(weights);
          updateSum();
          renderResults();
        });
        return { code: g.code, el: h("label", {}, h("span", {}, g.name), input), input };
      });
      const yearSelect = h(
        "select",
        { "aria-label": "Startjahr" },
        ...Array.from({ length: lastYear - firstYear }, (_, i) => firstYear + i).map((year) => h("option", { value: year, selected: year === baseYear }, String(year))),
      );
      yearSelect.addEventListener("change", () => {
        baseYear = Number(yearSelect.value);
        renderResults();
      });
      const sectorSelect = h(
        "select",
        { "aria-label": "Branche" },
        ...[...loaded.wages]
          .sort((a, b) => (a === totalWage ? -1 : b === totalWage ? 1 : a.name.localeCompare(b.name, "de")))
          .map((w) => h("option", { value: w.code, selected: w.code === sector }, w.name)),
      );
      sectorSelect.addEventListener("change", () => {
        sector = sectorSelect.value;
        renderResults();
      });

      set(
        body,
        h("div", { class: "filters" }, h("label", { class: "field" }, "Seit", yearSelect), h("label", { class: "field" }, "Branche", sectorSelect)),
        h(
          "details",
          { class: "panel", open: stored !== null },
          h("summary", {}, "Deinen Warenkorb einstellen"),
          h("p", { class: "muted small", style: "margin-bottom:10px" }, `Anteil jeder Gruppe an deinen Ausgaben in Prozent. Voreingestellt ist der amtliche Warenkorb (Wägungsschema ${facts.weightsYear}). Wer zum Beispiel kein Auto hat, senkt „Verkehr“; wer viel Miete zahlt, erhöht „Wohnung“. Die Eingaben bleiben nur in diesem Browser gespeichert.`),
          h("div", { class: "weights" }, ...inputs.map((i) => i.el)),
          h(
            "div",
            { class: "filters" },
            h(
              "button",
              {
                type: "button",
                onclick: () => {
                  for (const item of inputs) {
                    weights.set(item.code, official.get(item.code) ?? 0);
                    item.input.value = String(Number((official.get(item.code) ?? 0).toFixed(1)));
                  }
                  writeWeights(null);
                  updateSum();
                  renderResults();
                },
              },
              "Amtlichen Warenkorb wiederherstellen",
            ),
            sum,
          ),
        ),
        results,
        h(
          "p",
          { class: "muted small" },
          "Quellen: Statistisches Bundesamt (Destatis), GENESIS-Online, Tabellen 61111-0003, 61111-0007, 62361-0026, 62361-0031 und 61262-0002; Kraftstoffpreise und Renditen aus Dashboard Deutschland. Die Rechnung gewichtet zwölf Ausgabengruppen; die amtliche Statistik gliedert feiner, kleine Abweichungen zum amtlichen Index sind deshalb normal.",
        ),
      );
      updateSum();
      renderResults();
    },
    (error: unknown) => set(body, h("p", { class: "note" }, String(error))),
  );
  return root;
}
