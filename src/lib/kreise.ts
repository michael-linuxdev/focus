// „Mein Landkreis“: Aufbereitung der Kreistabellen aus GENESIS-Online und Kennzahlen daraus. Reine Funktionen.
import { dimensions, parseGermanNumber, type Row } from "./genesis-table.ts";
import type { Kreis, KreisData } from "./types.ts";

export const LAENDER: Record<string, string> = {
  "01": "Schleswig-Holstein",
  "02": "Hamburg",
  "03": "Niedersachsen",
  "04": "Bremen",
  "05": "Nordrhein-Westfalen",
  "06": "Hessen",
  "07": "Rheinland-Pfalz",
  "08": "Baden-Württemberg",
  "09": "Bayern",
  "10": "Saarland",
  "11": "Berlin",
  "12": "Brandenburg",
  "13": "Mecklenburg-Vorpommern",
  "14": "Sachsen",
  "15": "Sachsen-Anhalt",
  "16": "Thüringen",
};

interface Cell {
  code: string;
  name: string;
  time: string;
  value: number;
  row: Row;
}

/** Zeilen mit Zahlenwert und Kreisschlüssel; `keep` wählt z. B. „Insgesamt“ oder eine Fahrzeugart. */
function cells(rows: Row[], keep: (row: Row, attribute: (dimension: string) => string | undefined) => boolean = () => true): Cell[] {
  const out: Cell[] = [];
  for (const row of rows) {
    const dims = dimensions(row);
    const kreis = dims.find((d) => d.code === "KREISE");
    const value = parseGermanNumber(row.value ?? "");
    if (!kreis || value === null || !/^\d{5}$/.test(kreis.attribute)) continue;
    if (!keep(row, (dimension) => dims.find((d) => d.code === dimension)?.attribute)) continue;
    out.push({ code: kreis.attribute, name: kreis.label, time: row.time ?? "", value, row });
  }
  return out;
}

/** Werte des jüngsten Zeitpunkts, summiert je Kreis. */
function latest(found: Cell[]): { time: string; byCode: Map<string, number> } {
  const time = found.reduce((max, c) => (c.time > max ? c.time : max), "");
  const byCode = new Map<string, number>();
  for (const c of found) if (c.time === time) byCode.set(c.code, (byCode.get(c.code) ?? 0) + c.value);
  return { time, byCode };
}

function standText(time: string): string {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(time);
  return date ? `${Number(date[3])}.${Number(date[2])}.${date[1]}` : time;
}

export interface KreisTables {
  population: Row[];
  area: Row[];
  ages: Row[];
  foreigners: Row[];
  housing: Row[];
  vehicles: Row[];
  carsByFuel: Row[];
  fathers: Row[];
}

/** Untergrenze einer Altersgruppe aus Schlüsseln wie „ALT018B20“ oder „ALT075UM“. */
function lowerAge(attribute: string): number | null {
  const match = /^ALT(\d{3})(B\d+|UM)$/.exec(attribute);
  return match ? Number(match[1]) : null;
}

export function kreiseFromTables(tables: KreisTables): KreisData {
  const byCode = new Map<string, Kreis>();
  const population = cells(tables.population);
  for (const c of population) {
    if (!byCode.has(c.code)) byCode.set(c.code, { code: c.code, name: c.name, population: [] });
    byCode.get(c.code)!.population.push([Number(c.time.slice(0, 4)), c.value]);
  }
  const lastYear = Math.max(0, ...population.map((c) => Number(c.time.slice(0, 4))));
  // Aufgelöste Kreise stehen weiter in den Tabellen, haben aber keinen aktuellen Wert.
  for (const [code, kreis] of byCode) {
    kreis.population.sort((a, b) => a[0] - b[0]);
    if (kreis.population[kreis.population.length - 1]?.[0] !== lastYear) byCode.delete(code);
  }

  const stand: Record<string, string> = { population: `31.12.${lastYear}` };
  const assign = (key: keyof Kreis, label: string, found: Cell[], scale = 1): void => {
    const { time, byCode: values } = latest(found);
    if (!time) return;
    stand[label] = standText(time);
    for (const [code, value] of values) {
      const kreis = byCode.get(code);
      if (kreis) (kreis as unknown as Record<string, number>)[key] = value * scale;
    }
  };

  assign("areaKm2", "area", cells(tables.area));
  const ageCells = cells(tables.ages, (_row, attribute) => lowerAge(attribute("ALTX20") ?? "") !== null);
  const ageOf = (c: Cell): number => lowerAge(dimensions(c.row).find((d) => d.code === "ALTX20")!.attribute)!;
  assign("under18", "ages", ageCells.filter((c) => ageOf(c) < 18));
  assign("over65", "ages", ageCells.filter((c) => ageOf(c) >= 65));
  assign("agesTotal", "ages", ageCells);
  assign("foreigners", "foreigners", cells(tables.foreigners, (_row, attribute) => attribute("GES") === ""));
  assign("flats", "housing", cells(tables.housing, (row) => row.value_variable_code === "WOH001"));
  assign("livingAreaM2", "housing", cells(tables.housing, (row) => row.value_variable_code === "FLC001"), 1000);
  assign("cars", "cars", cells(tables.vehicles, (_row, attribute) => attribute("KFZAT2") === "PKWINS"));
  assign("electricCars", "cars", cells(tables.carsByFuel, (_row, attribute) => attribute("KSTAT1") === "KS-ELEKTRO" && attribute("EMIGR1") === ""));
  assign("fathersShare", "fathers", cells(tables.fathers));

  return { kreise: [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, "de")), stand };
}

// ---------- Kennzahlen ----------

export interface KreisMetric {
  id: string;
  title: string;
  /** Was die Zahl bedeutet. */
  hint: string;
  unit: string;
  decimals: number;
  /** Schlüssel in `KreisData.stand`. */
  stand: string;
  value: (kreis: Kreis) => number | null;
}

const ratio = (a: number | undefined, b: number | undefined, factor = 1): number | null => (a !== undefined && b ? (a / b) * factor : null);
const people = (kreis: Kreis): number | undefined => kreis.population[kreis.population.length - 1]?.[1];

export const KREIS_METRICS: KreisMetric[] = [
  { id: "einwohner", title: "Einwohner", hint: "Bevölkerung am Stichtag.", unit: "", decimals: 0, stand: "population", value: (k) => people(k) ?? null },
  {
    id: "entwicklung",
    title: "Bevölkerungsentwicklung",
    hint: "Veränderung der Einwohnerzahl seit dem ersten Jahr der Reihe.",
    unit: "%",
    decimals: 1,
    stand: "population",
    value: (k) => {
      const first = k.population[0];
      const last = k.population[k.population.length - 1];
      return first && last && first[0] !== last[0] && first[1] > 0 ? (last[1] / first[1] - 1) * 100 : null;
    },
  },
  { id: "dichte", title: "Bevölkerungsdichte", hint: "Einwohner je Quadratkilometer.", unit: "je km²", decimals: 0, stand: "area", value: (k) => ratio(people(k), k.areaKm2) },
  { id: "unter18", title: "Anteil unter 18 Jahren", hint: "Kinder und Jugendliche an allen Einwohnern.", unit: "%", decimals: 1, stand: "ages", value: (k) => ratio(k.under18, k.agesTotal, 100) },
  { id: "ab65", title: "Anteil ab 65 Jahren", hint: "Menschen ab 65 Jahren an allen Einwohnern.", unit: "%", decimals: 1, stand: "ages", value: (k) => ratio(k.over65, k.agesTotal, 100) },
  { id: "auslaender", title: "Ausländeranteil", hint: "Ausländerinnen und Ausländer laut Ausländerzentralregister je 100 Einwohner.", unit: "%", decimals: 1, stand: "foreigners", value: (k) => ratio(k.foreigners, people(k), 100) },
  { id: "wohnflaeche", title: "Wohnfläche je Einwohner", hint: "Wohnfläche aller Wohnungen geteilt durch die Einwohnerzahl.", unit: "m²", decimals: 1, stand: "housing", value: (k) => ratio(k.livingAreaM2, people(k)) },
  { id: "pkw", title: "Pkw je 1.000 Einwohner", hint: "Zugelassene Personenkraftwagen, auch gewerbliche, je 1.000 Einwohner.", unit: "", decimals: 0, stand: "cars", value: (k) => ratio(k.cars, people(k), 1000) },
  { id: "eautos", title: "Anteil Elektroautos", hint: "Rein elektrische Pkw an allen zugelassenen Pkw.", unit: "%", decimals: 1, stand: "cars", value: (k) => ratio(k.electricCars, k.cars, 100) },
  { id: "vaeter", title: "Väterbeteiligung beim Elterngeld", hint: "Anteil der Kinder, deren Vater Elterngeld bezogen hat.", unit: "%", decimals: 1, stand: "fathers", value: (k) => k.fathersShare ?? null },
];

export interface Standing {
  value: number;
  /** Platz in der absteigenden Rangliste, 1 = höchster Wert. */
  rank: number;
  of: number;
  median: number;
  /** Mittlerer Kreis des eigenen Bundeslands; null bei weniger als drei Kreisen. */
  landMedian: number | null;
}

function middle(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Wert eines Kreises samt Platz unter allen Kreisen und den mittleren Kreisen in Deutschland und im Land. */
export function standing(data: KreisData, metric: KreisMetric, kreis: Kreis): Standing | null {
  const value = metric.value(kreis);
  if (value === null) return null;
  const all = data.kreise.map((k) => ({ k, v: metric.value(k) })).filter((x): x is { k: Kreis; v: number } => x.v !== null);
  const inLand = all.filter((x) => x.k.code.slice(0, 2) === kreis.code.slice(0, 2)).map((x) => x.v);
  return {
    value,
    rank: all.filter((x) => x.v > value).length + 1,
    of: all.length,
    median: middle(all.map((x) => x.v)),
    landMedian: inLand.length >= 3 ? middle(inLand) : null,
  };
}

/** Alle Kreise mit Wert, absteigend. */
export function kreisRanking(data: KreisData, metric: KreisMetric): { kreis: Kreis; value: number }[] {
  return data.kreise
    .map((kreis) => ({ kreis, value: metric.value(kreis) }))
    .filter((x): x is { kreis: Kreis; value: number } => x.value !== null)
    .sort((a, b) => b.value - a.value);
}
