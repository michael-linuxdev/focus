import { euroScale, isRate, notable, resolve, search, staleDays, yearChange, type Resolved } from "./lib/catalog.ts";
import { HEADLINES, PRESETS, type SeriesRef } from "./lib/curated.ts";
import { formatDate, formatNumber, formatShortDate, formatSigned, formatValue } from "./lib/format.ts";
import { clip, comovement, deflate, describeComovement, indexTo100, leadLag, perCapita } from "./lib/stats.ts";
import type { Catalog, Frequency, IndicatorMeta } from "./lib/types.ts";
import { legend, lineChart, sparkline, type ChartSeries } from "./ui/chart.ts";
import { loadData, loadSeries, store } from "./state.ts";
import { h, set } from "./ui/dom.ts";
import { YEAR, dataTable, rangeControl, sourcesLine } from "./ui/parts.ts";
import { viewGeld } from "./views/geld.ts";
import { viewJahrgang } from "./views/jahrgang.ts";
import { viewLaender } from "./views/laender.ts";
import { viewPreise } from "./views/preise.ts";

const MAX_COMPARE = 6;
const FREQUENCY_ORDER: Frequency[] = ["täglich", "wöchentlich", "monatlich", "vierteljährlich", "jährlich"];

const app = document.getElementById("app")!;
let catalog: Catalog;
// ---------- Vergleichsauswahl in der Adresse ----------

interface Pick {
  indicator: string;
  index: number;
  slot: number;
}

function parsePicks(value: string | null): Pick[] {
  const picks: Pick[] = [];
  for (const part of (value ?? "").split(",")) {
    const [indicator, index, slot] = part.split("~");
    const meta = catalog.indicators.find((i) => i.id === indicator);
    const idx = Number(index);
    const sl = Number(slot);
    if (!meta || !meta.series[idx] || !(sl >= 1 && sl <= 8)) continue;
    if (picks.some((p) => (p.indicator === indicator && p.index === idx) || p.slot === sl)) continue;
    picks.push({ indicator: indicator!, index: idx, slot: sl });
  }
  return picks.slice(0, MAX_COMPARE);
}

function compareHref(picks: Pick[], years: number, mode?: string, transforms: string[] = []): string {
  const params = new URLSearchParams();
  if (picks.length) params.set("s", picks.map((p) => `${p.indicator}~${p.index}~${p.slot}`).join(","));
  params.set("r", String(years));
  if (mode) params.set("m", mode);
  if (transforms.length) params.set("t", transforms.join(","));
  return `#/vergleich?${params.toString()}`;
}

function refsToPicks(refs: SeriesRef[]): Pick[] {
  const picks: Pick[] = [];
  for (const ref of refs) {
    const found = resolve(catalog, ref);
    if (found) picks.push({ indicator: found.indicator.id, index: found.index, slot: picks.length + 1 });
  }
  return picks;
}

function freeSlot(picks: Pick[]): number {
  for (let slot = 1; slot <= 8; slot++) if (!picks.some((p) => p.slot === slot)) return slot;
  return 8;
}

// ---------- Bausteine ----------

function changeText(found: Resolved): string {
  const change = yearChange(found.indicator, found.series);
  if (!change) return "";
  const arrow = change.value > 0 ? "▲" : change.value < 0 ? "▼" : "▬";
  const amount = change.unit === "%" ? `${formatSigned(change.value, 1)} %` : `${formatSigned(change.value, found.indicator.decimals)} Punkte`;
  return `${arrow} ${amount} zum Vorjahr`;
}

function headlineTile(label: string, found: Resolved): HTMLElement {
  const { indicator, series } = found;
  return h(
    "a",
    { class: "card tile", href: `#/i/${indicator.id}` },
    h("div", { class: "label" }, label),
    h(
      "div",
      { class: "row" },
      h("div", { class: "value" }, formatNumber(series.last[1], indicator.decimals), indicator.unit ? h("span", { class: "unit" }, `\u00a0${indicator.unit}`) : null),
      sparkline(series.spark),
    ),
    h("div", { class: "delta" }, changeText(found)),
    h("div", { class: "meta" }, [indicator.intro, `Stand ${formatDate(series.last[0], indicator.frequency)}`].filter(Boolean).join(" · ")),
  );
}

function indicatorCard(indicator: IndicatorMeta): HTMLElement {
  const first = indicator.series[0]!;
  const more = indicator.series.length - 1;
  return h(
    "a",
    { class: "card tile", href: `#/i/${indicator.id}` },
    h("h3", {}, indicator.title),
    h("div", { class: "desc" }, indicator.intro),
    h(
      "div",
      { class: "row" },
      h(
        "div",
        {},
        h("div", { class: "value" }, formatValue(first.last[1], indicator.decimals, indicator.unit)),
        h("div", { class: "delta" }, more > 0 ? `${first.name} · ${more} weitere ${more === 1 ? "Reihe" : "Reihen"}` : first.name),
      ),
      sparkline(first.spark),
    ),
    h("div", { class: "meta" }, `${indicator.frequency} · Stand ${indicator.stand || formatDate(first.last[0], indicator.frequency)}`),
  );
}

// ---------- Ansichten ----------

function viewHome(): HTMLElement {
  const tiles = HEADLINES.map((hl) => {
    const found = resolve(catalog, hl) ?? (hl.fallback ? resolve(catalog, hl.fallback) : null);
    return found ? headlineTile(hl.label, found) : null;
  });
  const unusual = notable(catalog, 6);
  const presets = PRESETS.map((preset) => {
    const picks = refsToPicks(preset.series);
    if (picks.length < 2) return null;
    return h(
      "a",
      { class: "card", href: compareHref(picks, preset.years) },
      h("h3", {}, preset.title),
      h("div", { class: "desc" }, preset.question),
    );
  });
  return h(
    "div",
    {},
    h("h1", {}, "Lagebild Deutschland"),
    h(
      "p",
      { class: "lead" },
      `${catalog.indicators.length} Indikatoren des Statistischen Bundesamts aus Dashboard Deutschland und GENESIS-Online – an einem Ort, mit Vorjahresvergleich und frei kombinierbar.`,
    ),
    h("h2", {}, "Auf einen Blick"),
    h("div", { class: "grid" }, ...tiles),
    h("h2", {}, "Für dich gerechnet"),
    h(
      "div",
      { class: "grid wide" },
      catalog.indicators.some((i) => i.id === "genesis_61111-0003")
        ? h("a", { class: "card", href: "#/geld" }, h("h3", {}, "Mein Geld"), h("div", { class: "desc" }, "Deine persönliche Teuerung mit eigenem Warenkorb, Lohn gegen Preise in deiner Branche, Arbeitszeit statt Euro und die Erschwinglichkeit von Wohneigentum."))
        : null,
      catalog.indicators.some((i) => i.id === "genesis_61111-0003")
        ? h("a", { class: "card", href: "#/preise" }, h("h3", {}, "Preise im Detail"), h("div", { class: "desc" }, "Was ist am stärksten teurer geworden, was billiger? Alle Positionen des amtlichen Warenkorbs durchsuchen, von Butter bis Bahnfahrt."))
        : null,
      catalog.indicators.some((i) => i.id === "genesis_12612-0001")
        ? h("a", { class: "card", href: "#/jahrgang" }, h("h3", {}, "Mein Jahrgang"), h("div", { class: "desc" }, "Wie groß war dein Geburtsjahrgang, wie groß ist er heute, und welche Lebenserwartung nennt die Statistik für dein Alter?"))
        : null,
      catalog.indicators.some((i) => i.region)
        ? h("a", { class: "card", href: "#/laender" }, h("h3", {}, "Bundesländer im Vergleich"), h("div", { class: "desc" }, "Einkommen, Kaufkraft, Mieten, Arbeitslosigkeit und Lebenserwartung: Wo steht dein Land, und geht die Schere auf oder zu?"))
        : null,
    ),
    ...(unusual.length
      ? [
          h("h2", {}, "Gerade auffällig"),
          h("p", { class: "muted small", style: "margin-bottom:10px" }, "Reihen, deren jüngster Wert seit mindestens fünf Jahren nicht so hoch oder so niedrig war. Automatisch aus allen Reihen ermittelt; veraltete Reihen sind ausgenommen."),
          h(
            "div",
            { class: "grid wide" },
            ...unusual.map((n) =>
              h(
                "a",
                { class: "card", href: `#/i/${n.indicator.id}` },
                h("h3", {}, n.series.name === n.indicator.title || n.indicator.series.length === 1 ? n.indicator.title : `${n.series.name}`),
                n.indicator.series.length > 1 && n.series.name !== n.indicator.title ? h("div", { class: "meta", style: "margin-top:0" }, n.indicator.title) : null,
                h("div", { class: "desc" }, h("strong", {}, n.value), ` – ${n.text}`),
                h("div", { class: "meta" }, `Stand ${formatDate(n.series.last[0], n.indicator.frequency)}`),
              ),
            ),
          ),
        ]
      : []),
    h("h2", {}, "Zusammenhänge"),
    h("p", { class: "muted small", style: "margin-bottom:10px" }, "Vorbereitete Vergleiche über Themengrenzen hinweg. Jeder lässt sich um weitere Reihen ergänzen."),
    h("div", { class: "grid wide" }, ...presets),
    h("h2", {}, "Themen"),
    h(
      "div",
      { class: "grid wide" },
      ...catalog.themes.map((theme) =>
        h(
          "a",
          { class: "card", href: `#/thema/${theme.id}` },
          h("h3", {}, theme.name),
          h("div", { class: "desc" }, theme.description.length > 150 ? `${theme.description.slice(0, 147).trimEnd()}…` : theme.description),
          h("div", { class: "meta" }, `${theme.indicatorIds.length} Indikatoren`),
        ),
      ),
    ),
  );
}

function viewTheme(id: string): HTMLElement {
  const theme = catalog.themes.find((t) => t.id === id);
  if (!theme) return viewMissing();
  const indicators = theme.indicatorIds.map((iid) => catalog.indicators.find((i) => i.id === iid)).filter((i) => i !== undefined);
  return h(
    "div",
    {},
    h("p", { class: "crumbs" }, h("a", { href: "#/" }, "Überblick"), " › Thema"),
    h("h1", {}, theme.name),
    h("p", { class: "lead" }, theme.description),
    h("h2", {}, `${indicators.length} Indikatoren`),
    h("div", { class: "grid wide" }, ...indicators.map(indicatorCard)),
  );
}

function viewSearch(query: string): HTMLElement {
  const results = search(catalog, query);
  return h(
    "div",
    {},
    h("h1", {}, `Suche: „${query}“`),
    h("p", { class: "lead" }, results.length ? `${results.length} Treffer in Titeln, Reihen und Schlagworten.` : "Kein Indikator passt zu dieser Suche."),
    h("div", { class: "grid wide", style: "margin-top:16px" }, ...results.map(indicatorCard)),
  );
}

function viewMissing(): HTMLElement {
  return h("div", {}, h("h1", {}, "Nicht gefunden"), h("p", { class: "lead" }, "Diese Seite gibt es nicht. ", h("a", { href: "#/" }, "Zum Überblick")));
}

function viewIndicator(id: string): HTMLElement {
  const indicator = catalog.indicators.find((i) => i.id === id);
  if (!indicator) return viewMissing();
  const themes = catalog.themes.filter((t) => t.indicatorIds.includes(id));
  const spanYears = (Math.max(...indicator.series.map((sr) => sr.last[0])) - Math.min(...indicator.series.map((sr) => sr.first[0]))) / YEAR;
  let years = spanYears > 12 ? 10 : 0;
  // Farbplätze bleiben an der Reihe, solange sie eingeblendet ist.
  const visible = new Map<number, number>();
  indicator.series.slice(0, 5).forEach((_, i) => visible.set(i, i + 1));

  const stale = staleDays(indicator, catalog.fetchedAt);
  const body = h("div", {}, h("p", { class: "muted" }, "Daten werden geladen …"));
  const root = h(
    "div",
    {},
    h(
      "p",
      { class: "crumbs" },
      h("a", { href: "#/" }, "Überblick"),
      ...themes.slice(0, 1).flatMap((t) => [" › ", h("a", { href: `#/thema/${t.id}` }, t.name)]),
    ),
    h("h1", {}, indicator.title),
    h("p", { class: "lead" }, indicator.intro),
    stale !== null
      ? h("p", { class: "note" }, `Der jüngste Wert ist ${stale} Tage alt. Für eine Reihe mit ${indicator.frequency === "täglich" ? "täglichem" : indicator.frequency === "wöchentlich" ? "wöchentlichem" : indicator.frequency === "monatlich" ? "monatlichem" : indicator.frequency === "vierteljährlich" ? "vierteljährlichem" : "jährlichem"} Rhythmus ist das ungewöhnlich; die Quelle hat sie offenbar nicht fortgeschrieben.`)
      : null,
    body,
  );

  loadData(id).then(
    (data) => {
      const render = (): void => {
        const end = Math.max(...data.series.map((sr) => sr.data[sr.data.length - 1]![0]));
        const from = years ? end - years * YEAR : -Infinity;
        const shown = [...visible.entries()].sort((a, b) => a[0] - b[0]);
        const axes = [...new Set(shown.map(([i]) => indicator.series[i]!.axis))].sort();
        const panels = axes.map((axis) => {
          const group: ChartSeries[] = shown
            .filter(([i]) => indicator.series[i]!.axis === axis)
            .map(([i, slot]) => ({ name: data.series[i]!.name, slot, data: clip(data.series[i]!.data, from) }));
          return h(
            "div",
            { class: "panel" },
            group.length > 1 || axes.length > 1 ? legend(group) : null,
            lineChart({ series: group, frequency: indicator.frequency, decimals: indicator.decimals, unit: indicator.unit, label: `${indicator.title}: ${group.map((g) => g.name).join(", ")}` }),
          );
        });
        const chips =
          indicator.series.length > 1
            ? h(
                "ul",
                { class: "chips", "aria-label": "Reihen ein- und ausblenden" },
                ...indicator.series.map((sr, i) =>
                  h(
                    "li",
                    {},
                    h(
                      "button",
                      {
                        type: "button",
                        "aria-pressed": String(visible.has(i)),
                        onclick: () => {
                          if (visible.has(i)) {
                            if (visible.size > 1) visible.delete(i);
                          } else if (visible.size < 8) {
                            const used = new Set(visible.values());
                            let slot = 1;
                            while (used.has(slot)) slot++;
                            visible.set(i, slot);
                          }
                          render();
                        },
                      },
                      h("span", { class: visible.has(i) ? `key slot-${visible.get(i)}` : "key off" }),
                      sr.name,
                    ),
                  ),
                ),
              )
            : null;
        const comparePicks = shown.slice(0, MAX_COMPARE).map(([i, slot]) => ({ indicator: id, index: i, slot: Math.min(slot, 8) }));
        set(body, 
          h(
            "div",
            { class: "filters" },
            rangeControl(years, spanYears, (value) => {
              years = value;
              render();
            }),
            h("a", { href: compareHref(comparePicks, years || 10) }, "Mit anderen Reihen vergleichen →"),
          ),
          chips ?? "",
          indicator.series.length > 8 ? h("p", { class: "muted small", style: "margin:-6px 0 10px" }, "Höchstens acht Reihen gleichzeitig, damit die Farben unterscheidbar bleiben.") : null,
          axes.length > 1 ? h("p", { class: "note" }, "Die Reihen haben unterschiedliche Skalen und stehen deshalb in getrennten Diagrammen.") : null,
          ...panels,
          dataTable(shown.map(([i]) => ({ name: data.series[i]!.name, data: clip(data.series[i]!.data, from) })), indicator.frequency, indicator.decimals),
          sourcesLine(indicator),
        );
      };
      render();
    },
    (error: unknown) => set(body, h("p", { class: "note" }, String(error))),
  );
  return root;
}

function viewCompare(params: URLSearchParams): HTMLElement {
  const picks = parsePicks(params.get("s"));
  const years = Number(params.get("r") ?? 10) || 0;
  const requestedMode = params.get("m");
  const transforms = (params.get("t") ?? "").split(",").filter((t) => t === "real" || t === "kopf");
  const href = (p: Pick[] = picks, y: number = years, m: string | undefined = requestedMode ?? undefined, t: string[] = transforms): string => compareHref(p, y, m, t);
  const resolved = picks.map((p) => {
    const indicator = catalog.indicators.find((i) => i.id === p.indicator)!;
    return { pick: p, indicator, series: indicator.series[p.index]! };
  });
  const oneIndicator = new Set(resolved.map((r) => r.indicator.id)).size <= 1;
  // Reihennamen wie „Insgesamt“ sind nur innerhalb ihres Indikators eindeutig.
  const label = (r: (typeof resolved)[number]): string => {
    if (oneIndicator) return r.series.name;
    return r.indicator.title.includes(r.series.name) ? r.series.name : `${r.series.name} (${r.indicator.title})`;
  };

  // Auswahl
  const results = h("div", { class: "picker-results" });
  const renderResults = (query: string): void => {
    const found = query.trim() ? search(catalog, query).slice(0, 12) : [];
    set(results, 
      ...found.map((indicator) =>
        h(
          "div",
          { class: "item" },
          h("div", {}, indicator.title, " ", h("span", { class: "muted small" }, indicator.intro)),
          h(
            "ul",
            { class: "chips" },
            ...indicator.series.slice(0, 30).map((sr, index) => {
              const taken = picks.some((p) => p.indicator === indicator.id && p.index === index);
              return h(
                "li",
                {},
                h(
                  "button",
                  {
                    type: "button",
                    disabled: taken || picks.length >= MAX_COMPARE,
                    onclick: () => {
                      location.hash = href([...picks, { indicator: indicator.id, index, slot: freeSlot(picks) }]);
                    },
                  },
                  taken ? `✓ ${sr.name}` : `+ ${sr.name}`,
                ),
              );
            }),
          ),
        ),
      ),
      query.trim() && found.length === 0 ? h("p", { class: "muted" }, "Keine passende Reihe gefunden.") : null,
    );
  };
  const input = h("input", {
    type: "search",
    placeholder: "Reihe suchen, z. B. Strompreis, Export, Miete",
    "aria-label": "Reihe zum Vergleich suchen",
    oninput: () => renderResults(input.value),
  });

  const selection = h(
    "div",
    { class: "panel" },
    h("h3", { style: "margin-bottom:8px" }, `Ausgewählte Reihen (${picks.length} von ${MAX_COMPARE})`),
    picks.length
      ? h(
          "ul",
          { class: "selected" },
          ...resolved.map((r) =>
            h(
              "li",
              {},
              h("span", { class: `key slot-${r.pick.slot}` }),
              h("span", { class: "grow" }, h("a", { href: `#/i/${r.indicator.id}` }, r.series.name), " ", h("span", { class: "muted small" }, `${r.indicator.title} · ${r.indicator.intro}`)),
              h(
                "button",
                {
                  type: "button",
                  "aria-label": `${r.series.name} entfernen`,
                  onclick: () => {
                    location.hash = href(picks.filter((p) => p !== r.pick));
                  },
                },
                "×",
              ),
            ),
          ),
        )
      : h("p", { class: "muted" }, "Noch keine Reihe gewählt. Suche unten nach einer Reihe oder starte mit einem vorbereiteten Vergleich im Überblick."),
    picks.length < MAX_COMPARE ? input : null,
    results,
  );

  const output = h("div", {}, picks.length ? h("p", { class: "muted" }, "Daten werden geladen …") : null);
  const root = h(
    "div",
    {},
    h("h1", {}, "Reihen vergleichen"),
    h("p", { class: "lead" }, "Beliebige Reihen aus allen Themen nebeneinanderlegen: auf einen gemeinsamen Startwert umgerechnet oder in Originalwerten."),
    h("div", { style: "margin-top:16px" }, selection),
    output,
  );
  if (picks.length === 0) return root;

  const scales = resolved.map((r) => euroScale(r.indicator));
  const convertible = scales.some((scale) => scale !== null);
  Promise.all([
    Promise.all(resolved.map((r) => loadData(r.indicator.id))),
    convertible ? loadSeries("genesis_61111-0002") : null,
    convertible ? loadSeries("genesis_12411-0001") : null,
  ]).then(
    ([loaded, cpi, population]) => {
      const real = transforms.includes("real") && cpi !== null;
      const perHead = transforms.includes("kopf") && population !== null;
      // Anzeige je Reihe: Umrechnungen ändern Einheit und Beschreibung.
      const shown = resolved.map((r) => ({ unit: r.indicator.unit, decimals: r.indicator.decimals, intro: r.indicator.intro }));
      const full = resolved.map((r, i) => {
        let data = loaded[i]!.series[r.pick.index]!.data;
        const scale = scales[i];
        if (scale === null || scale === undefined) return data;
        const notes: string[] = [];
        if (real) {
          data = deflate(data, cpi.data);
          notes.push(`in Preisen von ${formatDate(cpi.data[cpi.data.length - 1]![0], "monatlich")}`);
        }
        if (perHead) {
          // Bevölkerung liegt in Mio. vor, das Ergebnis sind Euro je Einwohner.
          data = perCapita(data, population.data, scale / 1e6);
          shown[i] = { unit: "€", decimals: 0, intro: "in Euro je Einwohner" };
        }
        if (notes.length) shown[i]!.intro = [shown[i]!.intro, ...notes].filter(Boolean).join(", ");
        return data;
      });
      if (full.some((d) => d.length === 0)) {
        set(output, h("p", { class: "note" }, "Für diese Umrechnung fehlen Vergleichswerte im Zeitraum der Reihe. ", h("a", { href: href(picks, years, undefined, []) }, "Umrechnung zurücknehmen")));
        return;
      }
      const start = Math.max(...full.map((d) => d[0]![0]));
      const end = Math.max(...full.map((d) => d[d.length - 1]![0]));
      const from = years ? Math.max(start, end - years * YEAR) : start;
      const clipped = full.map((d) => clip(d, from));
      const spanYears = (end - start) / YEAR;

      const sameIndicator = resolved.every((r) => r.indicator.id === resolved[0]!.indicator.id);
      const indexable = clipped.every((d) => d.length > 1 && d.every((p) => p[1] > 0)) && !resolved.some((r) => isRate(r.indicator));
      const mode = requestedMode === "original" || !indexable ? "original" : requestedMode === "index" ? "index" : sameIndicator ? "original" : "index";
      const coarsest = resolved.map((r) => r.indicator.frequency).sort((a, b) => FREQUENCY_ORDER.indexOf(b) - FREQUENCY_ORDER.indexOf(a))[0]!;
      const finest = resolved.map((r) => r.indicator.frequency).sort((a, b) => FREQUENCY_ORDER.indexOf(a) - FREQUENCY_ORDER.indexOf(b))[0]!;

      const charts: HTMLElement[] = [];
      if (mode === "index") {
        const series: ChartSeries[] = resolved.map((r, i) => ({ name: label(r), slot: r.pick.slot, data: indexTo100(clipped[i]!) ?? [] }));
        charts.push(
          h(
            "div",
            { class: "panel" },
            h("p", { class: "muted small", style: "margin-bottom:6px" }, `Index: ${formatDate(from, coarsest)} = 100`),
            legend(series),
            lineChart({ series, frequency: finest, decimals: 1, unit: "", label: `Indexierter Vergleich: ${series.map((sr) => sr.name).join(", ")}` }),
          ),
        );
      } else if (sameIndicator) {
        const indicator = resolved[0]!.indicator;
        const series: ChartSeries[] = resolved.map((r, i) => ({ name: r.series.name, slot: r.pick.slot, data: clipped[i]! }));
        charts.push(
          h(
            "div",
            { class: "panel" },
            h("p", { class: "muted small", style: "margin-bottom:6px" }, shown[0]!.intro),
            series.length > 1 ? legend(series) : null,
            lineChart({ series, frequency: indicator.frequency, decimals: shown[0]!.decimals, unit: shown[0]!.unit, label: `${indicator.title}: ${series.map((sr) => sr.name).join(", ")}` }),
          ),
        );
      } else {
        // Verschiedene Einheiten bekommen je ein eigenes Diagramm statt einer zweiten Achse.
        resolved.forEach((r, i) => {
          const series: ChartSeries[] = [{ name: label(r), slot: r.pick.slot, data: clipped[i]! }];
          charts.push(
            h(
              "div",
              { class: "panel" },
              legend(series),
              h("p", { class: "muted small", style: "margin-bottom:6px" }, shown[i]!.intro),
              lineChart({ series, frequency: r.indicator.frequency, decimals: shown[i]!.decimals, unit: shown[i]!.unit, height: 200, label: label(r) }),
            ),
          );
        });
      }

      const summary = h(
        "table",
        {},
        h(
          "thead",
          {},
          h("tr", {}, h("th", { scope: "col" }, "Reihe"), h("th", { scope: "col" }, "Beginn"), h("th", { scope: "col" }, "Zuletzt"), h("th", { scope: "col" }, "Veränderung")),
        ),
        h(
          "tbody",
          {},
          ...resolved.map((r, i) => {
            const data = clipped[i]!;
            const first = data[0];
            const last = data[data.length - 1];
            if (!first || !last) return h("tr", {}, h("td", {}, label(r)), h("td", {}, "–"), h("td", {}, "–"), h("td", {}, "–"));
            const rate = isRate(r.indicator) || first[1] <= 0 || last[1] <= 0;
            const change = rate ? `${formatSigned(last[1] - first[1], shown[i]!.decimals)} Punkte` : `${formatSigned((last[1] / first[1] - 1) * 100, 1)} %`;
            return h(
              "tr",
              {},
              h("td", {}, h("span", { class: `key slot-${r.pick.slot}`, style: "margin-right:6px;vertical-align:middle" }), label(r)),
              h("td", {}, `${formatValue(first[1], shown[i]!.decimals, shown[i]!.unit)} (${formatDate(first[0], r.indicator.frequency)})`),
              h("td", {}, `${formatValue(last[1], shown[i]!.decimals, shown[i]!.unit)} (${formatDate(last[0], r.indicator.frequency)})`),
              h("td", {}, change),
            );
          }),
        ),
      );

      const pairs: HTMLElement[] = [];
      for (let a = 0; a < resolved.length; a++) {
        for (let b = a + 1; b < resolved.length && pairs.length < 6; b++) {
          const co = comovement(clipped[a]!, clipped[b]!);
          if (!co) continue;
          const shift = leadLag(clipped[a]!, clipped[b]!);
          const leader = shift ? (shift.lead > 0 ? resolved[a]! : resolved[b]!) : null;
          pairs.push(
            h(
              "li",
              {},
              `${label(resolved[a]!)} und ${label(resolved[b]!)}: `,
              h("strong", {}, describeComovement(co.r)),
              ` (r = ${formatSigned(co.r, 2)}, ${co.steps} gemeinsame Zeitschritte)`,
              shift && leader
                ? h(
                    "span",
                    {},
                    ". ",
                    h("strong", {}, `${label(leader)} läuft ${Math.abs(shift.lead)} ${Math.abs(shift.lead) === 1 ? "Monat" : "Monate"} voraus`),
                    `: Um diese Zeit verschoben ist der Zusammenhang am stärksten (r = ${formatSigned(shift.r, 2)})`,
                  )
                : null,
            ),
          );
        }
      }

      set(output, 
        h(
          "div",
          { class: "filters" },
          rangeControl(years, spanYears, (value) => {
            location.hash = href(picks, value);
          }),
          h(
            "div",
            { class: "seg", role: "group", "aria-label": "Darstellung" },
            h("button", { type: "button", "aria-pressed": String(mode === "index"), disabled: !indexable, onclick: () => (location.hash = href(picks, years, "index")) }, "Index (Start = 100)"),
            h("button", { type: "button", "aria-pressed": String(mode === "original"), onclick: () => (location.hash = href(picks, years, "original")) }, "Originalwerte"),
          ),
          convertible && cpi && population
            ? h(
                "ul",
                { class: "chips", style: "margin:0", "aria-label": "Umrechnung der Geldbeträge" },
                ...([["real", "preisbereinigt"], ["kopf", "je Einwohner"]] as const).map(([key, text]) =>
                  h(
                    "li",
                    {},
                    h(
                      "button",
                      {
                        type: "button",
                        "aria-pressed": String(transforms.includes(key)),
                        onclick: () => (location.hash = href(picks, years, requestedMode ?? undefined, transforms.includes(key) ? transforms.filter((t) => t !== key) : [...transforms, key])),
                      },
                      text,
                    ),
                  ),
                ),
              )
            : null,
        ),
        (real || perHead) && scales.some((scale) => scale === null)
          ? h("p", { class: "note" }, `Umgerechnet werden nur Geldbeträge: ${resolved.filter((_, i) => scales[i] !== null).map(label).join(", ")}. Indizes, Quoten und Mengen bleiben unverändert.`)
          : null,
        !indexable ? h("p", { class: "note" }, "Mindestens eine Reihe ist eine Veränderungsrate oder hat Werte bis null. Eine Umrechnung auf 100 wäre irreführend, deshalb stehen hier die Originalwerte.") : null,
        ...charts,
        h("h2", {}, "Im gewählten Zeitraum"),
        h("div", { class: "panel table-wrap" }, summary),
        pairs.length
          ? h(
              "div",
              {},
              h("h2", {}, "Gleichlauf"),
              h("ul", {}, ...pairs),
              h(
                "p",
                { class: "note" },
                "Gemessen wird, ob sich die Reihen von einem gemeinsamen Zeitpunkt zum nächsten in dieselbe Richtung bewegen (Korrelation der Veränderungen, Monats- oder Quartalsschritte). Für lückenlose Monatsreihen wird zusätzlich geprüft, ob der Zusammenhang stärker wird, wenn man eine Reihe um bis zu zwölf Monate verschiebt. Beides zeigt einen statistischen Zusammenhang, keine Ursache.",
              ),
            )
          : null,
        dataTable(
          resolved.map((r, i) => ({ name: label(r), data: clipped[i]! })),
          finest,
          Math.max(...resolved.map((r) => r.indicator.decimals)),
        ),
      );
    },
    (error: unknown) => set(output, h("p", { class: "note" }, String(error))),
  );
  return root;
}

// ---------- Rahmen und Navigation ----------

function render(): void {
  const [path = "/", queryString = ""] = location.hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(queryString);
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  let view: HTMLElement;
  if (parts.length === 0) view = viewHome();
  else if (parts[0] === "thema" && parts[1]) view = viewTheme(parts[1]);
  else if (parts[0] === "i" && parts[1]) view = viewIndicator(parts[1]);
  else if (parts[0] === "vergleich") view = viewCompare(params);
  else if (parts[0] === "geld") view = viewGeld();
  else if (parts[0] === "preise") view = viewPreise();
  else if (parts[0] === "jahrgang") view = viewJahrgang(params);
  else if (parts[0] === "laender") view = viewLaender(params);
  else if (parts[0] === "suche") view = viewSearch(params.get("q") ?? "");
  else view = viewMissing();

  const searchInput = h("input", {
    type: "search",
    placeholder: "Indikator suchen",
    "aria-label": "Indikator suchen",
    value: parts[0] === "suche" ? (params.get("q") ?? "") : "",
  });
  const form = h(
    "form",
    {
      class: "search",
      role: "search",
      onsubmit: (event: Event) => {
        event.preventDefault();
        if (searchInput.value.trim()) location.hash = `#/suche?q=${encodeURIComponent(searchInput.value.trim())}`;
      },
    },
    searchInput,
  );
  const navLink = (href: string, text: string, current: boolean): HTMLElement => h("a", { href, "aria-current": current ? "page" : undefined }, text);

  set(app, 
    h(
      "header",
      { class: "top" },
      h(
        "div",
        { class: "bar" },
        h("a", { class: "brand", href: "#/" }, "Lagebild Deutschland"),
        h("nav", {}, navLink("#/", "Überblick", parts.length === 0), navLink("#/geld", "Mein Geld", parts[0] === "geld" || parts[0] === "preise"), navLink("#/jahrgang", "Mein Jahrgang", parts[0] === "jahrgang"), navLink("#/laender", "Länder", parts[0] === "laender"), navLink("#/vergleich", "Vergleichen", parts[0] === "vergleich")),
        form,
      ),
    ),
    h("main", {}, view),
    h(
      "footer",
      {},
      "Daten: ",
      h("a", { href: "https://www.dashboard-deutschland.de/", rel: "noopener", target: "_blank" }, "Dashboard Deutschland"),
      " und ",
      h("a", { href: "https://genesis.destatis.de/", rel: "noopener", target: "_blank" }, "GENESIS-Online"),
      `, Statistisches Bundesamt (Destatis); die Quelle jedes Indikators steht auf seiner Seite. Abgerufen am ${formatShortDate(catalog.fetchedAt)}. Kein amtliches Angebot.`,
    ),
  );
  if (parts[0] !== "vergleich" && parts[0] !== "laender") window.scrollTo(0, 0);
}

fetch("./data/catalog.json")
  .then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<Catalog>;
  })
  .then((loaded) => {
    catalog = loaded;
    store.catalog = loaded;
    window.addEventListener("hashchange", render);
    render();
  })
  .catch((error: unknown) => {
    set(app, h("main", {}, h("h1", {}, "Daten nicht ladbar"), h("p", { class: "lead" }, `Der Katalog konnte nicht geladen werden (${String(error)}).`)));
  });
