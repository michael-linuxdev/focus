// „Mein Landkreis“: Steckbrief eines Kreises mit Einordnung unter allen Kreisen und im Bundesland.
import { formatNumber } from "../lib/format.ts";
import { KREIS_METRICS, LAENDER, kreisRanking, standing, type KreisMetric } from "../lib/kreise.ts";
import type { Kreis, KreisData } from "../lib/types.ts";
import { loadKreise } from "../state.ts";
import { barList } from "../ui/bars.ts";
import { lineChart } from "../ui/chart.ts";
import { h, set } from "../ui/dom.ts";

const STORAGE_KEY = "lagebild.kreis";
const NEIGHBOURS = 3;

function readKreis(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function kreisHref(code: string, metric?: string): string {
  const params = new URLSearchParams();
  if (code) params.set("k", code);
  if (metric) params.set("m", metric);
  return `#/kreis?${params.toString()}`;
}

const show = (metric: KreisMetric, value: number): string => formatNumber(value, metric.decimals) + (metric.unit ? ` ${metric.unit}` : "");

/** Lage eines Werts zwischen kleinstem und größtem Kreis, als schmale Skala mit Marke für den mittleren Kreis. */
function positionBar(rank: number, of: number): HTMLElement {
  const share = of > 1 ? (1 - (rank - 1) / (of - 1)) * 100 : 50;
  return h("div", { class: "rankbar", role: "img", "aria-label": `Platz ${rank} von ${of}` }, h("span", { class: "rankbar-mid" }), h("span", { class: "rankbar-dot", style: `left:${share}%` }));
}

export function viewKreis(params: URLSearchParams): HTMLElement {
  const body = h("div", {}, h("p", { class: "muted" }, "Daten werden geladen …"));
  const root = h(
    "div",
    {},
    h("h1", {}, "Mein Landkreis"),
    h("p", { class: "lead" }, "Wähle deinen Landkreis oder deine kreisfreie Stadt und sieh, wo er unter allen Kreisen in Deutschland und im eigenen Bundesland steht."),
    body,
  );

  loadKreise().then(
    (data: KreisData) => {
      const byCode = new Map(data.kreise.map((k) => [k.code, k]));
      const kreis = byCode.get(params.get("k") ?? "") ?? byCode.get(readKreis()) ?? null;
      const metric = KREIS_METRICS.find((m) => m.id === params.get("m")) ?? KREIS_METRICS[0]!;
      if (kreis) {
        try {
          localStorage.setItem(STORAGE_KEY, kreis.code);
        } catch {
          // Ohne Speicher gilt die Auswahl nur bis zum Neuladen.
        }
      }

      // ---------- Auswahl ----------
      const results = h("div", { class: "picker-results" });
      const input = h("input", { type: "search", placeholder: "Kreis oder Stadt suchen, z. B. Gießen, Leipzig, Rosenheim", "aria-label": "Kreis oder Stadt suchen" });
      const renderResults = (): void => {
        const words = input.value.toLocaleLowerCase("de").split(/\s+/).filter(Boolean);
        const found = words.length ? data.kreise.filter((k) => words.every((w) => `${k.name} ${LAENDER[k.code.slice(0, 2)] ?? ""}`.toLocaleLowerCase("de").includes(w))).slice(0, 12) : [];
        set(
          results,
          found.length
            ? h(
                "ul",
                { class: "chips", style: "margin-top:8px" },
                ...found.map((k) => h("li", {}, h("a", { class: "chip-link", href: kreisHref(k.code, params.get("m") ?? undefined) }, k.name, h("span", { class: "muted small" }, ` · ${LAENDER[k.code.slice(0, 2)] ?? ""}`)))),
              )
            : words.length
              ? h("p", { class: "muted", style: "margin-top:8px" }, "Kein Kreis passt zu dieser Suche.")
              : null,
        );
      };
      input.addEventListener("input", renderResults);
      const picker = h("div", { class: "panel" }, input, results);

      if (!kreis) {
        set(body, picker, h("p", { class: "note" }, `${data.kreise.length} Landkreise und kreisfreie Städte stehen zur Auswahl. Die Auswahl bleibt nur in diesem Browser gespeichert.`));
        return;
      }
      const land = LAENDER[kreis.code.slice(0, 2)] ?? "";

      // ---------- Steckbrief ----------
      const cards = KREIS_METRICS.map((m) => {
        const place = standing(data, m, kreis);
        if (!place) return null;
        return h(
          "a",
          { class: `card tile${m.id === metric.id ? " current" : ""}`, href: kreisHref(kreis.code, m.id), "aria-current": m.id === metric.id ? "true" : undefined },
          h("div", { class: "label" }, m.title),
          h("div", { class: "value" }, formatNumber(place.value, m.decimals), m.unit ? h("span", { class: "unit" }, ` ${m.unit}`) : null),
          positionBar(place.rank, place.of),
          h("div", { class: "delta" }, `Platz ${place.rank} von ${place.of}`),
          h(
            "div",
            { class: "meta" },
            `Mittlerer Kreis: ${show(m, place.median)}${place.landMedian !== null ? ` · in ${land}: ${show(m, place.landMedian)}` : ""} · Stand ${data.stand[m.stand] ?? "unbekannt"}`,
          ),
        );
      });

      // ---------- Rangliste zur gewählten Kennzahl ----------
      const ranking = kreisRanking(data, metric);
      const position = ranking.findIndex((r) => r.kreis.code === kreis.code);
      const row = (r: { kreis: Kreis; value: number }, i: number) => ({
        label: `${i + 1}. ${r.kreis.name}`,
        value: r.value,
        highlight: r.kreis.code === kreis.code,
        onClick: r.kreis.code === kreis.code ? undefined : () => (location.hash = kreisHref(r.kreis.code, metric.id)),
      });
      const format = (v: number): string => show(metric, v);
      const slice = (from: number, to: number) => ranking.slice(Math.max(0, from), Math.min(ranking.length, to)).map((r, i) => row(r, Math.max(0, from) + i));
      const around = position >= 0 ? slice(position - NEIGHBOURS, position + NEIGHBOURS + 1) : [];
      const inLand = ranking.filter((r) => r.kreis.code.slice(0, 2) === kreis.code.slice(0, 2));

      const population: [number, number][] = kreis.population.map(([year, value]) => [Date.UTC(year, 0, 1), value / 1000]);

      set(
        body,
        picker,
        h("h2", {}, kreis.name, h("span", { class: "badge" }, land)),
        h("p", { class: "muted small", style: "margin-bottom:10px" }, "Jede Kachel zeigt den Wert, den Platz unter allen Kreisen (Platz 1 = höchster Wert, das ist keine Wertung) und zum Vergleich den mittleren Kreis. Der Punkt auf der Skala zeigt die Lage zwischen niedrigstem (links) und höchstem Rang (rechts), der Strich die Mitte. Ein Tipp öffnet die Rangliste."),
        h("div", { class: "grid" }, ...cards),
        h("h2", {}, `Rangliste: ${metric.title}`),
        h("p", { class: "note" }, `${metric.hint} Stand ${data.stand[metric.stand] ?? "unbekannt"}.`),
        h(
          "div",
          { class: "cols" },
          h("div", { class: "panel" }, h("h3", {}, "Rund um deinen Kreis"), around.length ? barList(around, format, `${metric.title}: Nachbarn in der Rangliste`) : h("p", { class: "muted" }, "Für diesen Kreis liegt kein Wert vor.")),
          h("div", { class: "panel" }, h("h3", {}, "Höchste Werte"), barList(slice(0, 8), format, `${metric.title}: höchste Werte`)),
          h("div", { class: "panel" }, h("h3", {}, "Niedrigste Werte"), barList(slice(ranking.length - 8, ranking.length), format, `${metric.title}: niedrigste Werte`)),
        ),
        inLand.length >= 3
          ? h(
              "details",
              { class: "panel" },
              h("summary", {}, `Alle ${inLand.length} Kreise in ${land}`),
              barList(
                inLand.map((r) => row(r, ranking.indexOf(r))),
                format,
                `${metric.title}: alle Kreise in ${land}`,
              ),
            )
          : null,
        population.length > 1
          ? h(
              "div",
              { class: "panel" },
              h("h3", {}, "Einwohner über die Zeit"),
              h("p", { class: "muted small" }, "In Tausend, jeweils am 31. Dezember. Der Rückgang 2022 in vielen Kreisen geht auf die Neuberechnung nach dem Zensus zurück, nicht auf Abwanderung."),
              lineChart({ series: [{ name: kreis.name, slot: 1, data: population }], frequency: "jährlich", decimals: 1, unit: "Tsd.", height: 240, label: `Einwohner in ${kreis.name} je Jahr` }),
            )
          : null,
        h(
          "p",
          { class: "muted small" },
          "Quelle: Statistisches Bundesamt (Destatis), GENESIS-Online, Tabellen 12411-0015, 12411-0017, 11111-0002, 12521-0040, 31231-0020, 46251-0020, 46251-0021 und 22922-0042. Einkommen, Arbeitslosigkeit und Wirtschaftsleistung je Kreis führt nur die Regionaldatenbank der Statistischen Ämter; sie sind hier noch nicht enthalten.",
        ),
      );
    },
    (error: unknown) => set(body, h("p", { class: "note" }, String(error))),
  );
  return root;
}
