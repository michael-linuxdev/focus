// Übersetzt eine GENESIS-Tabelle im flachen CSV-Format (eine Zeile je Wert) in einen Indikator der App.
// Reine Funktionen; den Abruf erledigt scripts/lib/genesis.ts.
import { formatDate } from "./format.ts";
import { inferFrequency, seriesMeta, type NormalizedIndicator } from "./normalize.ts";
import type { Point } from "./types.ts";

export interface TableSpec {
  /** Tabellencode in GENESIS, z. B. „61111-0002“. */
  code: string;
  /** Kennung des Indikators; nötig, wenn dieselbe Tabelle mehrere Indikatoren speist. Standard: `genesis_<code>`. */
  id?: string;
  /** Weitere Abrufparameter, z. B. Filter über classifyingvariable1/classifyingkey1. */
  params?: Record<string, string>;
  /**
   * Zeilenfilter: Gliederung (Code) → verlangte Ausprägung. „“ steht für „Insgesamt“, „*“ für jede Ausprägung
   * dieser Gliederung (Zeilen anderer Gliederungsebenen entfallen), „/…/“ für einen regulären Ausdruck.
   */
  where?: Record<string, string>;
  /**
   * Fasst Ausprägungen einer Gliederung zu Gruppen zusammen (Summe je Zeitpunkt), z. B. Altersjahre zu Altersgruppen.
   * `codes` ist ein regulärer Ausdruck auf den Schlüssel der Ausprägung. Mit `share` wird jede Gruppe als Anteil
   * an der Summe aller Gruppen in Prozent ausgegeben.
   */
  aggregate?: { dimension: string; groups: { name: string; codes: string }[]; share?: boolean };
  title: string;
  /** Themen, in denen der Indikator erscheint; unbekannte Kennungen legen ein neues Thema an. */
  themes: string[];
  /** Erstes Jahr des Abrufs; ohne Angabe liefert GENESIS je nach Tabelle nur die jüngsten Jahre. */
  startyear?: number;
  /** Nur diese Merkmale (Spalte value_variable_code) übernehmen; ohne Angabe alle. */
  measures?: string[];
  /** Zeilen mit Einheit „%“ (Veränderungsraten) übernehmen. Standard: nein, die App rechnet Veränderungen selbst. */
  includeRates?: boolean;
  /** Faktor für die Werte, z. B. 1e-6 für Millionen. */
  scale?: number;
  /** Beschreibung von Einheit und Abgrenzung. Ohne Angabe aus der Einheit der Tabelle abgeleitet. */
  intro?: string;
  unit?: string;
  decimals?: number;
}

export type Row = Record<string, string>;

/** Liest CSV mit Semikolon als Trenner; Felder dürfen in Anführungszeichen stehen. */
export function parseFlatCsv(text: string): Row[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ";") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((f) => f !== "")) records.push(record);
      record = [];
    } else field += ch;
  }
  record.push(field);
  if (record.some((f) => f !== "")) records.push(record);

  const header = records[0] ?? [];
  return records.slice(1).map((values) => Object.fromEntries(header.map((name, i) => [name, values[i] ?? ""])));
}

/** „1.234,5“ → 1234.5; Platzhalter wie „-“, „.“ oder „...“ ergeben null. */
export function parseGermanNumber(text: string): number | null {
  const cleaned = text.trim().replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

interface Dimension {
  code: string;
  attribute: string;
  label: string;
}

function dimensions(row: Row): Dimension[] {
  const out: Dimension[] = [];
  for (let n = 1; row[`${n}_variable_code`] !== undefined; n++) {
    out.push({ code: row[`${n}_variable_code`]!, attribute: row[`${n}_variable_attribute_code`] ?? "", label: row[`${n}_variable_attribute_label`] ?? "" });
  }
  return out;
}

/** Zeitpunkt einer Zeile: Stichtag, oder Jahr mit Monat bzw. Quartal aus einer eigenen Spaltengruppe. */
export function rowTime(row: Row): number | null {
  const time = (row.time ?? "").trim();
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(time);
  if (date) return Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]));
  // Stichmonat „2025-04P1M“ und Zeitraum „2018-P2Y“ (2018 bis 2020, gezählt wird das Endjahr).
  const month = /^(\d{4})-(\d{2})P1M$/.exec(time);
  if (month) return Date.UTC(Number(month[1]), Number(month[2]) - 1, 1);
  const period = /^(\d{4})-P(\d+)Y$/.exec(time);
  if (period) return Date.UTC(Number(period[1]) + Number(period[2]), 0, 1);
  if (!/^\d{4}$/.test(time)) return null;
  const year = Number(time);
  for (const dim of dimensions(row)) {
    const month = /^MONAT(\d{2})$/.exec(dim.attribute);
    if (month) return Date.UTC(year, Number(month[1]) - 1, 1);
    const quarter = /^QUART(?:AL)?(\d)$/.exec(dim.attribute);
    if (quarter) return Date.UTC(year, (Number(quarter[1]) - 1) * 3, 1);
  }
  return Date.UTC(year, 0, 1);
}

const TIME_DIMENSION = /^(MONAT|QUARTG?|QUARTAL)$/;

export function specId(spec: TableSpec): string {
  return spec.id ?? `genesis_${spec.code}`;
}

export function filterRows(rows: Row[], spec: Pick<TableSpec, "measures" | "includeRates" | "where">): Row[] {
  const where = Object.entries(spec.where ?? {});
  return rows.filter((row) => {
    if (spec.measures && !spec.measures.includes(row.value_variable_code ?? "")) return false;
    if (!spec.includeRates && (row.value_unit ?? "").trim() === "%") return false;
    if (where.length === 0) return true;
    const dims = dimensions(row);
    return where.every(([code, attribute]) =>
      dims.some((dim) => {
        if (dim.code !== code) return false;
        if (attribute === "*") return true;
        const pattern = /^\/(.*)\/$/.exec(attribute);
        return pattern ? new RegExp(pattern[1]!).test(dim.attribute) : dim.attribute === attribute;
      }),
    );
  });
}

export { dimensions };

/** Summiert Zeilen zu den Gruppen aus `spec.aggregate`; die Gruppen ersetzen die Ausprägungen der Gliederung. */
export function aggregateRows(rows: Row[], aggregate: NonNullable<TableSpec["aggregate"]>): Row[] {
  const groups = aggregate.groups.map((g) => ({ name: g.name, test: new RegExp(g.codes) }));
  const sums = new Map<string, { row: Row; value: number }>();
  for (const row of rows) {
    const n = dimensions(row).findIndex((dim) => dim.code === aggregate.dimension) + 1;
    const value = parseGermanNumber(row.value ?? "");
    if (n === 0 || value === null) continue;
    const attribute = row[`${n}_variable_attribute_code`] ?? "";
    const index = groups.findIndex((g) => g.test.test(attribute));
    if (index < 0) continue;
    const merged: Row = { ...row, [`${n}_variable_attribute_code`]: `G${index}`, [`${n}_variable_attribute_label`]: groups[index]!.name };
    const { value: _value, ...rest } = merged;
    const key = JSON.stringify(rest);
    const entry = sums.get(key);
    if (entry) entry.value += value;
    else sums.set(key, { row: merged, value });
  }
  const out = [...sums.values()];
  if (aggregate.share) {
    const totals = new Map<string, number>();
    const timeKey = (row: Row): string => `${row.time}|${row.value_variable_code}`;
    for (const { row, value } of out) totals.set(timeKey(row), (totals.get(timeKey(row)) ?? 0) + value);
    for (const entry of out) {
      entry.value = (entry.value / totals.get(timeKey(entry.row))!) * 100;
      entry.row.value_unit = "Prozent";
    }
  }
  return out.map(({ row, value }) => ({ ...row, value: String(Number(value.toPrecision(10))).replace(".", ",") }));
}

export function tableToIndicator(rows: Row[], spec: TableSpec): NormalizedIndicator | null {
  const filtered = filterRows(rows, spec);
  const wanted = spec.aggregate ? aggregateRows(filtered, spec.aggregate) : filtered;

  // Welche Gliederungen unterscheiden überhaupt Reihen? Nur die gehen in den Reihennamen ein.
  const variety = new Map<string, Set<string>>();
  const measures = new Set<string>();
  for (const row of wanted) {
    measures.add(`${row.value_variable_code}|${row.value_unit}`);
    for (const dim of dimensions(row)) {
      if (TIME_DIMENSION.test(dim.code)) continue;
      if (!variety.has(dim.code)) variety.set(dim.code, new Set());
      variety.get(dim.code)!.add(dim.attribute);
    }
  }

  const bySeries = new Map<string, { name: string; code?: string; points: Map<number, number> }>();
  const units = new Set<string>();
  for (const row of wanted) {
    const time = rowTime(row);
    const value = parseGermanNumber(row.value ?? "");
    if (time === null || value === null) continue;
    const varying = dimensions(row).filter((dim) => !TIME_DIMENSION.test(dim.code) && (variety.get(dim.code)?.size ?? 0) > 1);
    const parts = varying.map((dim) => dim.label);
    const code = varying.length === 1 ? varying[0]!.attribute : undefined;
    if (measures.size > 1 || parts.length === 0) parts.push(row.value_variable_label || row.value_variable_code || "Wert");
    const key = `${parts.join("|")}|${row.value_variable_code}|${row.value_unit}`;
    if (!bySeries.has(key)) bySeries.set(key, { name: parts.join(" – "), code, points: new Map() });
    bySeries.get(key)!.points.set(time, Number((value * (spec.scale ?? 1)).toPrecision(12)));
    units.add((row.value_unit ?? "").trim());
  }

  const series = [...bySeries.values()]
    .map((entry) => ({ name: entry.name, code: entry.code, data: [...entry.points.entries()].sort((a, b) => a[0] - b[0]) as Point[] }))
    .filter((entry) => entry.data.length >= 2);
  if (series.length === 0) return null;
  // GENESIS liefert die Zeilen ungeordnet; gegliederte Reihen (z. B. Bundesländer) stehen alphabetisch.
  if (spec.aggregate) {
    const order = spec.aggregate.groups.map((g) => g.name);
    series.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  } else if ([...variety.values()].some((attributes) => attributes.size > 1)) {
    series.sort((a, b) => a.name.localeCompare(b.name, "de"));
  }

  const frequency = inferFrequency(series[0]!.data.map((p) => p[0]));
  const newest = Math.max(...series.map((sr) => sr.data[sr.data.length - 1]![0]));
  const onlyUnit = units.size === 1 ? [...units][0]! : "";
  const base = /^(\d{4})\s*=\s*100$/.exec(onlyUnit);
  const magnitude = Math.max(...series.map((sr) => Math.abs(sr.data[sr.data.length - 1]![1])));
  const id = specId(spec);
  const percent = onlyUnit === "%" || onlyUnit === "Prozent";
  const regional = [...variety.entries()].some(([code, attributes]) => code === "DLAND" && attributes.size > 1);

  return {
    meta: {
      id,
      title: spec.title,
      intro: spec.intro ?? (base ? `Index, ${base[1]} = 100` : percent ? "in Prozent" : onlyUnit ? `in ${onlyUnit}` : ""),
      unit: spec.unit ?? (percent ? "%" : ""),
      decimals: spec.decimals ?? (magnitude >= 1000 ? 0 : magnitude >= 10 ? 1 : 2),
      stand: formatDate(newest, frequency),
      frequency,
      sources: [{ name: `Statistisches Bundesamt (Destatis), GENESIS-Online, Tabelle ${spec.code}`, link: `https://genesis.destatis.de/datenbank/online/table/${spec.code}` }],
      tags: [rows[0]?.statistics_label ?? "", "GENESIS", spec.code].filter(Boolean),
      ...(regional ? { region: "laender" as const } : {}),
      series: series.map((sr) => ({ ...seriesMeta(sr.name, sr.data), ...(sr.code ? { code: sr.code } : {}) })),
    },
    data: { id, series: series.map((sr) => ({ name: sr.name, data: sr.data })) },
  };
}
