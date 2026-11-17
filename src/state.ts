// Geladene Daten, von allen Ansichten geteilt.
import type { Catalog, CohortData, Facts, IndicatorData, PriceItems } from "./lib/types.ts";

export const store: { catalog: Catalog } = { catalog: { fetchedAt: "", themes: [], indicators: [] } };

const dataCache = new Map<string, Promise<IndicatorData>>();

export function loadData(id: string): Promise<IndicatorData> {
  let pending = dataCache.get(id);
  if (!pending) {
    pending = fetch(`./data/series/${encodeURIComponent(id)}.json`).then((res) => {
      if (!res.ok) throw new Error(`Daten für ${id} nicht ladbar (HTTP ${res.status})`);
      return res.json() as Promise<IndicatorData>;
    });
    dataCache.set(id, pending);
  }
  return pending;
}

const fileCache = new Map<string, Promise<unknown>>();

function loadFile<T>(name: string, what: string): Promise<T> {
  if (!fileCache.has(name)) {
    fileCache.set(
      name,
      fetch(`./data/${name}`).then((res) => {
        if (!res.ok) throw new Error(`${what} nicht ladbar (HTTP ${res.status})`);
        return res.json() as Promise<unknown>;
      }),
    );
  }
  return fileCache.get(name) as Promise<T>;
}

export const loadFacts = (): Promise<Facts> => loadFile<Facts>("facts.json", "Querschnittsdaten");
export const loadPrices = (): Promise<PriceItems> => loadFile<PriceItems>("prices.json", "Preispositionen");
export const loadCohorts = (): Promise<CohortData> => loadFile<CohortData>("cohorts.json", "Jahrgangsdaten");

/** Zeitreihe einer Reihe, gesucht über den Namen; leerer Name = erste Reihe. Null, wenn Indikator oder Reihe fehlen. */
export async function loadSeries(indicatorId: string, seriesName = ""): Promise<IndicatorData["series"][number] | null> {
  if (!store.catalog.indicators.some((i) => i.id === indicatorId)) return null;
  const data = await loadData(indicatorId);
  return (seriesName ? data.series.find((sr) => sr.name === seriesName) : data.series[0]) ?? null;
}
