// Bausteine, die mehrere Ansichten teilen.
import { formatDate, formatNumber } from "../lib/format.ts";
import type { Frequency, IndicatorMeta, Point } from "../lib/types.ts";
import { h } from "./dom.ts";

export const YEAR = 365.25 * 86_400_000;

export function rangeControl(years: number, spanYears: number, onPick: (years: number) => void): HTMLElement {
  const options: [string, number][] = [
    ["1 Jahr", 1],
    ["5 Jahre", 5],
    ["10 Jahre", 10],
    ["Alles", 0],
  ];
  return h(
    "div",
    { class: "seg", role: "group", "aria-label": "Zeitraum" },
    ...options
      .filter(([, value]) => value === 0 || value < spanYears + 0.5)
      .map(([text, value]) => h("button", { type: "button", "aria-pressed": String(value === years), onclick: () => onPick(value) }, text)),
  );
}

export function dataTable(columns: { name: string; data: Point[] }[], frequency: Frequency, decimals: number): HTMLElement {
  const times = [...new Set(columns.flatMap((c) => c.data.map((p) => p[0])))].sort((a, b) => b - a);
  const limit = 60;
  const lookups = columns.map((c) => new Map(c.data));
  const table = h(
    "table",
    {},
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Zeitpunkt"), ...columns.map((c) => h("th", { scope: "col" }, c.name)))),
    h(
      "tbody",
      {},
      ...times.slice(0, limit).map((time) =>
        h(
          "tr",
          {},
          h("td", {}, formatDate(time, frequency)),
          ...lookups.map((lookup) => {
            const value = lookup.get(time);
            return h("td", {}, value === undefined ? "–" : formatNumber(value, decimals));
          }),
        ),
      ),
    ),
  );
  return h(
    "details",
    {},
    h("summary", {}, "Werte als Tabelle"),
    h("div", { class: "table-wrap" }, table),
    times.length > limit ? h("p", { class: "muted small" }, `Gezeigt sind die jüngsten ${limit} von ${times.length} Zeitpunkten.`) : null,
  );
}

export function sourcesLine(indicator: IndicatorMeta): HTMLElement {
  const p = h("p", { class: "muted small" }, "Quelle: ");
  indicator.sources.forEach((source, i) => {
    if (i) p.append(", ");
    p.append(/^https?:\/\//.test(source.link) ? h("a", { href: source.link, rel: "noopener", target: "_blank" }, source.name) : source.name);
  });
  if (indicator.sources.length === 0) p.append("Dashboard Deutschland");
  p.append(` · Datenstand ${indicator.stand || "unbekannt"} · ${indicator.frequency}`);
  return p;
}
