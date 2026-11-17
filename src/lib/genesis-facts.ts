// Querschnittsdaten aus GENESIS für den Bereich „Mein Geld“: Gewichte des Warenkorbs und Verdienste.
import { dimensions, filterRows, parseGermanNumber, type Row } from "./genesis-table.ts";
import type { Facts } from "./types.ts";

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
