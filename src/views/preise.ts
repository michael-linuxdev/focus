// „Preise im Detail“: alle Positionen des Verbraucherpreisindex durchsuchen und nach Preisänderung ordnen.
import { formatNumber, formatSigned } from "../lib/format.ts";
import { itemChanges, itemSeries, type ItemChange } from "../lib/money.ts";
import type { PriceItems } from "../lib/types.ts";
import { loadPrices } from "../state.ts";
import { barList } from "../ui/bars.ts";
import { legend, lineChart, type ChartSeries } from "../ui/chart.ts";
import { h, set } from "../ui/dom.ts";

const MAX_SELECTED = 5;
const TOP = 12;
const LEVELS: [number, string][] = [
  [5, "einzelne Waren und Dienstleistungen"],
  [3, "Warengruppen"],
  [2, "Hauptgruppen"],
];

export function viewPreise(): HTMLElement {
  const body = h("div", {}, h("p", { class: "muted" }, "Daten werden geladen …"));
  const root = h(
    "div",
    {},
    h("p", { class: "crumbs" }, h("a", { href: "#/geld" }, "Mein Geld"), " › Preise im Detail"),
    h("h1", {}, "Preise im Detail"),
    h("p", { class: "lead" }, "Was ist am stärksten teurer geworden, was billiger? Alle Positionen des amtlichen Warenkorbs, von Butter bis Bahnfahrt."),
    body,
  );

  loadPrices().then(
    (prices: PriceItems) => {
      const lastYear = prices.years[prices.years.length - 1]!;
      let fromYear = prices.years.includes(2020) ? 2020 : prices.years[0]!;
      let level = 5;
      let query = "";
      // Farbplatz je gewählter Position; bleibt, solange sie gewählt ist.
      const selected = new Map<string, number>();
      let seeded = false;

      const output = h("div", {});
      const render = (): void => {
        const all = itemChanges(prices, fromYear, lastYear);
        const atLevel = all.filter((c) => c.item.level === level);
        if (!seeded) {
          seeded = true;
          const picks = [atLevel[0], atLevel[atLevel.length - 1]].filter((c): c is ItemChange => c !== undefined);
          picks.forEach((c, i) => selected.set(c.item.code, i + 1));
        }
        const toggle = (code: string): void => {
          if (selected.has(code)) selected.delete(code);
          else if (selected.size < MAX_SELECTED) {
            const used = new Set(selected.values());
            let slot = 1;
            while (used.has(slot)) slot++;
            selected.set(code, slot);
          }
          render();
        };
        const rows = (list: ItemChange[]) =>
          list.map((c) => ({
            label: c.item.label,
            value: c.change,
            onClick: () => toggle(c.item.code),
            pressed: selected.has(c.item.code),
          }));
        const format = (v: number): string => `${formatSigned(v, 1)} %`;

        const words = query.toLocaleLowerCase("de").split(/\s+/).filter(Boolean);
        const matches = words.length ? all.filter((c) => words.every((w) => c.item.label.toLocaleLowerCase("de").includes(w))) : [];

        const lines: ChartSeries[] = [...selected.entries()]
          .map(([code, slot]) => {
            const item = prices.items.find((i) => i.code === code)!;
            return { name: item.label, slot, data: itemSeries(prices, item, fromYear) };
          })
          .filter((line) => line.data.length > 1);
        const median = atLevel.length ? atLevel[atLevel.length >> 1]!.change : null;

        set(
          output,
          words.length
            ? h(
                "div",
                { class: "panel" },
                h("h3", {}, `Suche: ${matches.length} ${matches.length === 1 ? "Position" : "Positionen"}`),
                matches.length ? barList(rows(matches.slice(0, 40)), format, `Preisänderung ${fromYear} bis ${lastYear} der gefundenen Positionen`) : h("p", { class: "muted" }, "Keine Position passt zu dieser Suche."),
                matches.length > 40 ? h("p", { class: "muted small" }, "Gezeigt sind die ersten 40 Treffer.") : null,
              )
            : h(
                "div",
                { class: "cols" },
                h("div", { class: "panel" }, h("h3", {}, `Am stärksten teurer, ${fromYear} bis ${lastYear}`), barList(rows(atLevel.slice(0, TOP)), format, "Positionen mit dem stärksten Preisanstieg")),
                h(
                  "div",
                  { class: "panel" },
                  h("h3", {}, `Am wenigsten teurer oder billiger, ${fromYear} bis ${lastYear}`),
                  barList(rows(atLevel.slice(-TOP).reverse()), format, "Positionen mit dem schwächsten Preisanstieg oder Preisrückgang"),
                ),
              ),
          median !== null && !words.length
            ? h("p", { class: "note" }, `Unter ${atLevel.length} Positionen dieser Ebene liegt die mittlere Preisänderung bei ${format(median)}. Positionen ohne Wert im Startjahr fehlen.`)
            : null,
          h(
            "div",
            { class: "panel" },
            h("h3", {}, "Verlauf der gewählten Positionen"),
            h("p", { class: "muted small" }, `Index, ${fromYear} = 100. Ein Tipp auf eine Position oben fügt sie hinzu oder entfernt sie (höchstens ${MAX_SELECTED}).`),
            lines.length ? legend(lines) : null,
            lines.length ? lineChart({ series: lines, frequency: "jährlich", decimals: 1, unit: "", height: 280, label: `Preisverlauf: ${lines.map((l) => l.name).join(", ")}` }) : h("p", { class: "muted" }, "Noch keine Position gewählt."),
            lines.length
              ? h(
                  "details",
                  {},
                  h("summary", {}, "Werte als Tabelle"),
                  h(
                    "div",
                    { class: "table-wrap" },
                    h(
                      "table",
                      {},
                      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Jahr"), ...lines.map((l) => h("th", { scope: "col" }, l.name)))),
                      h(
                        "tbody",
                        {},
                        ...prices.years
                          .filter((y) => y >= fromYear)
                          .reverse()
                          .map((year) =>
                            h(
                              "tr",
                              {},
                              h("td", {}, String(year)),
                              ...lines.map((l) => {
                                const point = l.data.find((p) => new Date(p[0]).getUTCFullYear() === year);
                                return h("td", {}, point ? formatNumber(point[1], 1) : "–");
                              }),
                            ),
                          ),
                      ),
                    ),
                  ),
                )
              : null,
          ),
        );
      };

      const yearSelect = h("select", { "aria-label": "Startjahr" }, ...prices.years.slice(0, -1).map((year) => h("option", { value: year, selected: year === fromYear }, String(year))));
      yearSelect.addEventListener("change", () => {
        fromYear = Number(yearSelect.value);
        render();
      });
      const levelSelect = h("select", { "aria-label": "Gliederung" }, ...LEVELS.map(([value, text]) => h("option", { value, selected: value === level }, text)));
      levelSelect.addEventListener("change", () => {
        level = Number(levelSelect.value);
        render();
      });
      const search = h("input", { type: "search", placeholder: "Position suchen, z. B. Butter, Strom, Friseur", "aria-label": "Position suchen" });
      search.addEventListener("input", () => {
        query = search.value;
        render();
      });

      set(
        body,
        h("div", { class: "filters" }, h("label", { class: "field" }, "Seit", yearSelect), h("label", { class: "field" }, "Ebene", levelSelect), h("div", { style: "flex:1 1 240px;max-width:360px" }, search)),
        output,
        h("p", { class: "muted small" }, "Quelle: Statistisches Bundesamt (Destatis), GENESIS-Online, Tabelle 61111-0003. Jahresdurchschnitte des Verbraucherpreisindex; ein Index zeigt die Preisentwicklung, nicht den Preis in Euro."),
      );
      render();
    },
    (error: unknown) => set(body, h("p", { class: "note" }, String(error))),
  );
  return root;
}
