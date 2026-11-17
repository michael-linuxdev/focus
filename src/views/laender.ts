// Ländervergleich: Rangliste, Veränderung und Schere zwischen den Bundesländern, auch für abgeleitete Kennzahlen.
import { formatNumber, formatSigned } from "../lib/format.ts";
import { changes, combine, commonYears, median, ranking, rebase, spread, type RegionSeries } from "../lib/regions.ts";
import { loadData, store } from "../state.ts";
import { barList } from "../ui/bars.ts";
import { legend, lineChart, type ChartSeries } from "../ui/chart.ts";
import { h, set } from "../ui/dom.ts";

const POPULATION = "genesis_12411-0010";
const GDP = "genesis_82111-0010";
const INCOME = "genesis_82411-0010";
const PRICES = "genesis_61111-0010";
const RENTS = "genesis_61111-0020";
const STORAGE_KEY = "lagebild.land";

interface Metric {
  id: string;
  title: string;
  /** Was die Zahl bedeutet und woraus sie berechnet ist. */
  intro: string;
  sources: string[];
  build: (get: (id: string) => RegionSeries[]) => RegionSeries[];
  unit: string;
  decimals: number;
  /** Stände sind zwischen Ländern vergleichbar. Bei Indizes nicht: Dort zählt nur die Veränderung. */
  level: boolean;
  /** Veränderung in Punkten statt Prozent (Quoten, Lebensjahre). */
  points?: string;
}

const METRICS: Metric[] = [
  {
    id: "einkommen",
    title: "Verfügbares Einkommen je Einwohner",
    intro: "Verfügbares Einkommen der privaten Haushalte in Euro je Einwohner und Jahr.",
    sources: [INCOME],
    build: (get) => get(INCOME),
    unit: "€",
    decimals: 0,
    level: true,
  },
  {
    id: "kaufkraft",
    title: "Einkommen nach Abzug der Teuerung",
    intro: "Verfügbares Einkommen je Einwohner, bereinigt mit dem Verbraucherpreisindex des jeweiligen Landes. Zeigt, wie sich die Kaufkraft entwickelt hat. Unterschiede im Preisniveau zwischen den Ländern sind nicht enthalten, deshalb gibt es hier keine Rangliste der Stände.",
    sources: [INCOME, PRICES],
    build: (get) => combine(get(INCOME), get(PRICES), (income, index) => (income / index) * 100),
    unit: "",
    decimals: 1,
    level: false,
  },
  {
    id: "bip",
    title: "Wirtschaftsleistung je Einwohner",
    intro: "Bruttoinlandsprodukt in jeweiligen Preisen geteilt durch die Bevölkerung am Jahresende, in Euro.",
    sources: [GDP, POPULATION],
    build: (get) => combine(get(GDP), get(POPULATION), (gdp, people) => (gdp / people) * 1000),
    unit: "€",
    decimals: 0,
    level: true,
  },
  {
    id: "arbeitslosigkeit",
    title: "Arbeitslosenquote",
    intro: "Arbeitslosenquote aller zivilen Erwerbspersonen in Prozent, Jahresdurchschnitt.",
    sources: ["genesis_13211-0007_quote"],
    build: (get) => get("genesis_13211-0007_quote"),
    unit: "%",
    decimals: 1,
    level: true,
    points: "Punkte",
  },
  {
    id: "mieten",
    title: "Nettokaltmieten",
    intro: "Index der Nettokaltmieten. Ein Index zeigt nur die Entwicklung, nicht die Höhe der Miete; deshalb gibt es hier keine Rangliste der Stände.",
    sources: [RENTS],
    build: (get) => get(RENTS),
    unit: "",
    decimals: 1,
    level: false,
  },
  {
    id: "mieten-einkommen",
    title: "Mieten gemessen am Einkommen",
    intro: "Index der Nettokaltmieten geteilt durch das verfügbare Einkommen je Einwohner. Steigt der Wert, sind die Mieten schneller gestiegen als die Einkommen.",
    sources: [RENTS, INCOME],
    build: (get) => combine(get(RENTS), get(INCOME), (rent, income) => (rent / income) * 1000),
    unit: "",
    decimals: 1,
    level: false,
  },
  {
    id: "preise",
    title: "Verbraucherpreise",
    intro: "Verbraucherpreisindex je Land. Ein Index zeigt nur die Entwicklung, nicht das Preisniveau; deshalb gibt es hier keine Rangliste der Stände.",
    sources: [PRICES],
    build: (get) => get(PRICES),
    unit: "",
    decimals: 1,
    level: false,
  },
  {
    id: "bevoelkerung",
    title: "Bevölkerung",
    intro: "Bevölkerung in Mio. Personen am 31. Dezember.",
    sources: [POPULATION],
    build: (get) => get(POPULATION),
    unit: "Mio.",
    decimals: 2,
    level: true,
  },
  {
    id: "lebenserwartung-frauen",
    title: "Lebenserwartung der Frauen",
    intro: "Lebenserwartung bei Geburt in Jahren, Sterbetafel über drei Jahre.",
    sources: ["genesis_12621-0004_w"],
    build: (get) => get("genesis_12621-0004_w"),
    unit: "Jahre",
    decimals: 1,
    level: true,
    points: "Jahre",
  },
  {
    id: "lebenserwartung-maenner",
    title: "Lebenserwartung der Männer",
    intro: "Lebenserwartung bei Geburt in Jahren, Sterbetafel über drei Jahre.",
    sources: ["genesis_12621-0004_m"],
    build: (get) => get("genesis_12621-0004_m"),
    unit: "Jahre",
    decimals: 1,
    level: true,
    points: "Jahre",
  },
];

function readLand(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function laenderHref(metric: string, years?: number): string {
  const params = new URLSearchParams({ k: metric });
  if (years !== undefined) params.set("r", String(years));
  return `#/laender?${params.toString()}`;
}

export function viewLaender(params: URLSearchParams): HTMLElement {
  const catalog = store.catalog;
  const available = METRICS.filter((m) => m.sources.every((id) => catalog.indicators.some((i) => i.id === id)));
  const metric = available.find((m) => m.id === params.get("k")) ?? available[0];
  const years = params.has("r") ? Number(params.get("r")) || 0 : 10;
  let land = readLand();

  const body = h("div", {}, h("p", { class: "muted" }, "Daten werden geladen …"));
  const root = h(
    "div",
    {},
    h("h1", {}, "Bundesländer im Vergleich"),
    h("p", { class: "lead" }, "Wo steht dein Land, wer hat aufgeholt, und geht die Schere zwischen den Ländern auf oder zu?"),
    body,
  );
  if (!metric) {
    set(body, h("p", { class: "note" }, "Die Ländertabellen aus GENESIS-Online fehlen im Datenstand."));
    return root;
  }

  Promise.all(metric.sources.map((id) => loadData(id))).then(
    (loaded) => {
      const tables = new Map(metric.sources.map((id, i) => [id, loaded[i]!.series as RegionSeries[]]));
      const series = metric.build((id) => tables.get(id) ?? []);
      const allYears = commonYears(series);
      const endYear = allYears[allYears.length - 1]!;
      const startYear = years ? (allYears.find((y) => y >= endYear - years) ?? allYears[0]!) : allYears[0]!;
      const names = series.map((sr) => sr.name).sort((a, b) => a.localeCompare(b, "de"));
      const value = (v: number): string => formatNumber(v, metric.decimals) + (metric.unit ? ` ${metric.unit}` : "");
      const change = (v: number): string => (metric.points ? `${formatSigned(v, metric.decimals)} ${metric.points}` : `${formatSigned(v, 1)} %`);

      const output = h("div", {});
      const renderOutput = (): void => {
        const mark = (name: string): { highlight?: boolean; note?: string } => (name === land ? { highlight: true, note: "dein Land" } : {});
        const ranked = ranking(series, endYear);
        const changed = changes(series, startYear, endYear, Boolean(metric.points));
        const shown = metric.level ? series : rebase(series, startYear);
        const span = allYears.filter((y) => y >= startYear);
        const gaps = spread(shown, span, Boolean(metric.points) || !metric.level);
        const first = gaps[0];
        const last = gaps[gaps.length - 1];

        let scissors: HTMLElement | null = null;
        if (first && last && first !== last) {
          const gapText = (g: number): string =>
            metric.level && !metric.points ? `das ${formatNumber(g, 2)}-Fache` : `${formatNumber(g, metric.level ? metric.decimals : 1)} ${metric.level ? metric.points : "Punkte"}`;
          const wider = last.gap > first.gap * 1.005;
          const narrower = last.gap < first.gap * 0.995;
          scissors = metric.level
            ? h(
                "p",
                {},
                `${last.year} lag ${last.top.name} vorn (${value(last.top.value)}), ${last.bottom.name} hinten (${value(last.bottom.value)}). `,
                h("strong", {}, wider ? "Die Schere ist aufgegangen" : narrower ? "Die Schere hat sich geschlossen" : "Der Abstand ist gleich geblieben"),
                `: Der Abstand zwischen höchstem und niedrigstem Land betrug ${first.year} ${gapText(first.gap)}, ${last.year} ${gapText(last.gap)}.`,
              )
            : h(
                "p",
                {},
                `Seit ${startYear} ist der Wert in ${last.top.name} am stärksten gestiegen (${formatSigned(last.top.value - 100, 1)} %), in ${last.bottom.name} am schwächsten (${formatSigned(last.bottom.value - 100, 1)} %). `,
                h("strong", {}, `Dazwischen liegen ${formatNumber(last.gap, 1)} Punkte.`),
              );
        }

        const pick = [...new Set([land, last?.top.name, last?.bottom.name].filter((n): n is string => Boolean(n)))];
        const lines: ChartSeries[] = [];
        const own = shown.find((sr) => sr.name === land);
        if (own) lines.push({ name: `${own.name} (dein Land)`, slot: 2, data: own.data.filter((p) => new Date(p[0]).getUTCFullYear() >= startYear) });
        lines.push({ name: "mittleres Land (Median)", slot: 1, data: median(shown, span) });
        for (const [name, slot] of [[last?.top.name, 3], [last?.bottom.name, 4]] as const) {
          const sr = shown.find((s) => s.name === name);
          if (sr && name !== land) lines.push({ name: sr.name, slot, data: sr.data.filter((p) => new Date(p[0]).getUTCFullYear() >= startYear) });
        }

        set(
          output,
          h(
            "div",
            { class: "cols" },
            metric.level
              ? h(
                  "div",
                  { class: "panel" },
                  h("h3", {}, `Stand ${endYear}`),
                  barList(ranked.map((r) => ({ label: r.name, value: r.value, ...mark(r.name) })), value, `${metric.title} ${endYear} je Bundesland`),
                )
              : null,
            h(
              "div",
              { class: "panel" },
              h("h3", {}, `Veränderung ${startYear} bis ${endYear}`),
              barList(changed.map((r) => ({ label: r.name, value: r.value, ...mark(r.name) })), change, `Veränderung ${metric.title} ${startYear} bis ${endYear} je Bundesland`),
            ),
          ),
          h(
            "div",
            { class: "panel" },
            h("h3", {}, "Schere zwischen den Ländern"),
            scissors,
            legend(lines),
            lineChart({ series: lines, frequency: "jährlich", decimals: metric.level ? metric.decimals : 1, unit: metric.level ? metric.unit : "", height: 280, label: `${metric.title}: ${pick.join(", ")} und mittleres Land` }),
            metric.level ? null : h("p", { class: "muted small" }, `Index, ${startYear} = 100.`),
          ),
        );
      };

      const metricSelect = h("select", { "aria-label": "Kennzahl" }, ...available.map((m) => h("option", { value: m.id, selected: m.id === metric.id }, m.title)));
      metricSelect.addEventListener("change", () => (location.hash = laenderHref(metricSelect.value, years)));
      const landSelect = h("select", { "aria-label": "Mein Land" }, h("option", { value: "" }, "nicht gewählt"), ...names.map((name) => h("option", { value: name, selected: name === land }, name)));
      landSelect.addEventListener("change", () => {
        land = landSelect.value;
        try {
          localStorage.setItem(STORAGE_KEY, land);
        } catch {
          // Ohne Speicher gilt die Auswahl nur bis zum Neuladen.
        }
        renderOutput();
      });
      const total = endYear - allYears[0]!;
      const ranges: [string, number][] = [["5 Jahre", 5], ["10 Jahre", 10], ["20 Jahre", 20], ["Alles", 0]];

      set(
        body,
        h(
          "div",
          { class: "filters" },
          h("label", { class: "field" }, "Kennzahl", metricSelect),
          h("label", { class: "field" }, "Mein Land", landSelect),
          h(
            "div",
            { class: "seg", role: "group", "aria-label": "Zeitraum" },
            ...ranges
              .filter(([, r]) => r === 0 || r < total)
              .map(([text, r]) => h("button", { type: "button", "aria-pressed": String(r === years || (r === 0 && years >= total)), onclick: () => (location.hash = laenderHref(metric.id, r)) }, text)),
          ),
        ),
        h("p", { class: "note" }, metric.intro),
        output,
        h(
          "p",
          { class: "muted small" },
          "Quelle: Statistisches Bundesamt (Destatis), GENESIS-Online. Tabellen: ",
          ...metric.sources.flatMap((id, i) => {
            const indicator = catalog.indicators.find((ind) => ind.id === id)!;
            return [i ? ", " : "", h("a", { href: `#/i/${id}` }, indicator.title)];
          }),
          ".",
        ),
      );
      renderOutput();
    },
    (error: unknown) => set(body, h("p", { class: "note" }, String(error))),
  );
  return root;
}
