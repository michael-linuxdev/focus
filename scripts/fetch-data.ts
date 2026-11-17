// Holt alle Themen und Indikatoren von Dashboard Deutschland (Statistisches Bundesamt)
// und legt sie aufbereitet unter public/data/ ab. Aufruf: npm run data
import { mkdir, rm, writeFile } from "node:fs/promises";
import { normalizeIndicator, normalizeThemes } from "../src/lib/normalize.ts";
import type { Catalog, IndicatorMeta } from "../src/lib/types.ts";

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

const indicators: IndicatorMeta[] = [];
const skipped: string[] = [];
await rm(new URL("series/", OUT), { recursive: true, force: true });
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
  indicators.push(normalized.meta);
  await writeFile(new URL(`series/${entry.id}.json`, OUT), JSON.stringify(normalized.data));
}

if (indicators.length < ids.length / 2) {
  throw new Error(`Nur ${indicators.length} von ${ids.length} Indikatoren lesbar, Abbruch.`);
}

const catalog: Catalog = {
  fetchedAt: new Date().toISOString(),
  themes: normalizeThemes(dashboards, new Set(indicators.map((i) => i.id))),
  indicators,
};
await writeFile(new URL("catalog.json", OUT), JSON.stringify(catalog));
console.log(`${indicators.length} Indikatoren in ${catalog.themes.length} Themen gespeichert.`);
if (skipped.length) console.log(`Übersprungen (kein lesbares Diagramm): ${skipped.join(", ")}`);
