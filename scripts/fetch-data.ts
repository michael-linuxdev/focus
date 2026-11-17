// Holt alle Themen und Indikatoren von Dashboard Deutschland (Statistisches Bundesamt)
// und legt sie aufbereitet unter public/data/ ab. Aufruf: npm run data
// Mit GENESIS_USER (Benutzername oder API-Token) kommen die Tabellen aus scripts/genesis-tables.ts dazu;
// ohne Zugangsdaten bleiben die zuletzt gespeicherten GENESIS-Reihen erhalten.
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { isRate } from "../src/lib/catalog.ts";
import { earningsFromRows, weightsFromRows } from "../src/lib/genesis-facts.ts";
import { parseFlatCsv, specId, tableToIndicator } from "../src/lib/genesis-table.ts";
import { findExtreme } from "../src/lib/stats.ts";
import { normalizeIndicator, normalizeThemes } from "../src/lib/normalize.ts";
import type { Catalog, Facts, IndicatorData, IndicatorMeta, Theme } from "../src/lib/types.ts";
import { FACT_TABLES, NEW_THEMES, TABLES } from "./genesis-tables.ts";
import { authFromEnv, fetchTableCsv } from "./lib/genesis.ts";

const API = "https://www.dashboard-deutschland.de/api";
const OUT = new URL("../public/data/", import.meta.url);

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      if (attempt >= 4) throw new Error(`${url.slice(0, 90)}: ${String(err)}`);
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
}

type RawDashboard = { id: string; layoutTiles?: { indicatorid: string }[] };
type RawEntry = { id: string; json: string };

const dashboards = await getJson<RawDashboard[]>(`${API}/dashboard/get`);
const ids = [...new Set(dashboards.flatMap((d) => (d.layoutTiles ?? []).map((t) => t.indicatorid)))];

const entries: RawEntry[] = [];
for (let i = 0; i < ids.length; i += 25) {
  const chunk = ids.slice(i, i + 25);
  entries.push(...(await getJson<RawEntry[]>(`${API}/tile/indicators?ids=${chunk.join(";")}`)));
}

/** Vermerkt je Reihe, ob der jüngste Wert seit Jahren nicht so hoch oder niedrig war. */
function annotate(meta: IndicatorMeta, data: IndicatorData): void {
  meta.series.forEach((series, i) => {
    const extreme = findExtreme(data.series[i]!.data, isRate(meta));
    if (extreme) series.extreme = { ...extreme, value: Number(extreme.value.toPrecision(6)), years: Math.round(extreme.years * 10) / 10 };
  });
}

const indicators: IndicatorMeta[] = [];
const skipped: string[] = [];
await mkdir(new URL("series/", OUT), { recursive: true });
for (const entry of entries) {
  let normalized = null;
  try {
    normalized = normalizeIndicator(entry.json);
  } catch {
    normalized = null;
  }
  if (!normalized) {
    skipped.push(entry.id);
    continue;
  }
  annotate(normalized.meta, normalized.data);
  indicators.push(normalized.meta);
  await writeFile(new URL(`series/${entry.id}.json`, OUT), JSON.stringify(normalized.data));
}

if (indicators.length < ids.length / 2) {
  throw new Error(`Nur ${indicators.length} von ${ids.length} Indikatoren lesbar, Abbruch.`);
}
const themes: Theme[] = normalizeThemes(dashboards, new Set(indicators.map((i) => i.id)));

// ---------- GENESIS-Online ----------
const previous: Catalog | null = await readFile(new URL("catalog.json", OUT), "utf8").then(
  (text) => JSON.parse(text) as Catalog,
  () => null,
);
const auth = authFromEnv();
const genesis: IndicatorMeta[] = [];
const genesisFailed: string[] = [];
const tableCache = new Map<string, Promise<string>>();
function tableCsv(code: string, params: Record<string, string>): Promise<string> {
  const key = `${code}?${new URLSearchParams(params).toString()}`;
  if (!tableCache.has(key)) tableCache.set(key, fetchTableCsv(auth!, code, params));
  return tableCache.get(key)!;
}

for (const spec of TABLES) {
  const id = specId(spec);
  const kept = previous?.indicators.find((i) => i.id === id);
  if (auth) {
    try {
      const csv = await tableCsv(spec.code, { ...(spec.startyear ? { startyear: String(spec.startyear) } : {}), ...spec.params });
      const normalized = tableToIndicator(parseFlatCsv(csv), spec);
      if (!normalized) throw new Error("keine verwertbare Reihe");
      annotate(normalized.meta, normalized.data);
      genesis.push(normalized.meta);
      await writeFile(new URL(`series/${id}.json`, OUT), JSON.stringify(normalized.data));
      continue;
    } catch (error) {
      genesisFailed.push(`${id}: ${String(error).slice(0, 200)}`);
    }
  }
  // Kein Zugang oder Abruf gescheitert: den zuletzt gespeicherten Stand dieser Tabelle behalten.
  if (kept) genesis.push(kept);
}

if (auth) {
  try {
    const facts: Facts = {
      ...weightsFromRows(parseFlatCsv(await tableCsv(FACT_TABLES.weights, {}))),
      ...earningsFromRows(parseFlatCsv(await tableCsv(FACT_TABLES.earnings, {}))),
    };
    if (facts.weights.length === 0 || facts.earnings.length === 0) throw new Error("Gewichte oder Verdienste leer");
    await writeFile(new URL("facts.json", OUT), JSON.stringify(facts));
  } catch (error) {
    genesisFailed.push(`Querschnittsdaten: ${String(error).slice(0, 200)}`);
  }
}

// Amtliche Tabellen stehen in ihrem Thema vorn, in der Reihenfolge der Liste; neue Themen stehen vor den übrigen.
const existingThemeCount = themes.length;
for (const meta of [...genesis].reverse()) {
  const spec = TABLES.find((t) => specId(t) === meta.id)!;
  for (const themeId of spec.themes) {
    let theme = themes.find((t) => t.id === themeId);
    if (!theme) {
      const fresh = NEW_THEMES[themeId] ?? { name: themeId, description: "" };
      theme = { id: themeId, name: fresh.name, description: fresh.description, indicatorIds: [] };
      themes.push(theme);
    }
    theme.indicatorIds.unshift(meta.id);
  }
}
themes.unshift(...themes.splice(existingThemeCount).sort((a, b) => Object.keys(NEW_THEMES).indexOf(a.id) - Object.keys(NEW_THEMES).indexOf(b.id)));
indicators.push(...genesis);

const keep = new Set(indicators.map((i) => `${i.id}.json`));
for (const file of await readdir(new URL("series/", OUT))) {
  if (!keep.has(file)) await rm(new URL(`series/${file}`, OUT));
}

const catalog: Catalog = { fetchedAt: new Date().toISOString(), themes, indicators };
await writeFile(new URL("catalog.json", OUT), JSON.stringify(catalog));
console.log(`${indicators.length} Indikatoren in ${themes.length} Themen gespeichert, davon ${genesis.length} aus GENESIS.`);
if (skipped.length) console.log(`Übersprungen (kein lesbares Diagramm): ${skipped.join(", ")}`);
if (!auth) console.log("GENESIS_USER nicht gesetzt: GENESIS-Tabellen nicht aktualisiert.");
if (genesisFailed.length) {
  // Kein Abbruch: für gescheiterte Tabellen gilt der zuletzt gespeicherte Stand.
  console.log(`::warning::GENESIS-Abrufe gescheitert: ${genesisFailed.join(" | ")}`);
}
