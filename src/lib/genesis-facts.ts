// Querschnittsdaten aus GENESIS für den Bereich „Mein Geld“: Gewichte des Warenkorbs und Verdienste.
import { dimensions, filterRows, parseGermanNumber, type Row } from "./genesis-table.ts";
import type { Facts, PriceItems } from "./types.ts";

/** Gewichte der zwölf Ausgabengruppen (COICOP-Zweisteller) in Promille. */
export function weightsFromRows(rows: Row[]): Pick<Facts, "weights" | "weightsYear"> {
  const weights: Facts["weights"] = [];
  for (const row of filterRows(rows, { where: { CC13A2: "*" }, includeRates: true })) {
    const dim = dimensions(row).find((d) => d.code === "CC13A2")!;
    const permille = parseGermanNumber(row.value ?? "");
    if (permille !== null) weights.push({ code: dim.attribute, label: dim.label, permille });
  }
  weights.sort((a, b) => a.code.localeCompare(b.code));
  return { weights, weightsYear: rows[0]?.time ?? "" };
}

const EARNING_FIELDS: Record<string, "hourlyMean" | "monthlyMean" | "hourlyMedian" | "monthlyMedian"> = {
  VST045: "hourlyMean",
  VST047: "monthlyMean",
  VST051: "hourlyMedian",
  VST052: "monthlyMedian",
};

/** Verdienste je Geschlecht und Altersgruppe; leere Kennung bedeutet „insgesamt“. */
export function earningsFromRows(rows: Row[]): Pick<Facts, "earnings" | "earningsStand"> {
  const byKey = new Map<string, Facts["earnings"][number]>();
  for (const row of rows) {
    const field = EARNING_FIELDS[row.value_variable_code ?? ""];
    const value = parseGermanNumber(row.value ?? "");
    if (!field || value === null) continue;
    const dims = dimensions(row);
    const sexDim = dims.find((d) => d.code === "GES");
    const ageDim = dims.find((d) => d.code.startsWith("ALT"));
    const sex = sexDim?.attribute ? sexDim.label : "";
    const age = ageDim?.attribute ? ageDim.label : "";
    const key = `${sex}|${age}`;
    if (!byKey.has(key)) byKey.set(key, { sex, age });
    byKey.get(key)![field] = value;
  }
  const stand = /^(\d{4})-(\d{2})/.exec(rows[0]?.time ?? "");
  return { earnings: [...byKey.values()], earningsStand: stand ? `${stand[2]}/${stand[1]}` : "" };
}

/** Alle Positionen des Verbraucherpreisindex (Zwei- bis Fünfsteller) mit Jahreswerten und Gewicht. */
export function priceItemsFromRows(indexRows: Row[], weightRows: Row[]): PriceItems {
  const position = (row: Row): { code: string; label: string; level: number } | null => {
    for (const dim of dimensions(row)) {
      const level = /^CC13A(\d)$/.exec(dim.code);
      if (level && dim.attribute) return { code: dim.attribute, label: dim.label, level: Number(level[1]) };
    }
    return null;
  };
  const weights = new Map<string, number>();
  for (const row of weightRows) {
    const pos = position(row);
    const value = parseGermanNumber(row.value ?? "");
    if (pos && value !== null) weights.set(pos.code, value);
  }
  const byCode = new Map<string, { code: string; label: string; level: number; byYear: Map<number, number> }>();
  const yearSet = new Set<number>();
  for (const row of indexRows) {
    if ((row.value_unit ?? "").trim() === "%") continue;
    const pos = position(row);
    const value = parseGermanNumber(row.value ?? "");
    const year = Number(row.time);
    if (!pos || value === null || !Number.isInteger(year)) continue;
    if (!byCode.has(pos.code)) byCode.set(pos.code, { ...pos, byYear: new Map() });
    byCode.get(pos.code)!.byYear.set(year, value);
    yearSet.add(year);
  }
  const years = [...yearSet].sort((a, b) => a - b);
  const items = [...byCode.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((entry) => ({
      code: entry.code,
      label: entry.label,
      level: entry.level,
      ...(weights.has(entry.code) ? { weight: weights.get(entry.code)! } : {}),
      values: years.map((year) => entry.byYear.get(year) ?? null),
    }));
  return { years, items };
}
