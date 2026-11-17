// Übersetzt eine GENESIS-Tabelle im flachen CSV-Format (eine Zeile je Wert) in einen Indikator der App.
// Reine Funktionen; den Abruf erledigt scripts/lib/genesis.ts.
import { formatDate } from "./format.ts";
import { inferFrequency, seriesMeta, type NormalizedIndicator } from "./normalize.ts";
import type { Point } from "./types.ts";

export interface TableSpec {
  /** Tabellencode in GENESIS, z. B. „61111-0002“. */
  code: string;
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

export function tableToIndicator(rows: Row[], spec: TableSpec): NormalizedIndicator | null {
  const wanted = rows.filter((row) => {
    if (spec.measures && !spec.measures.includes(row.value_variable_code ?? "")) return false;
    return spec.includeRates || (row.value_unit ?? "").trim() !== "%";
  });

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

  const bySeries = new Map<string, { name: string; points: Map<number, number> }>();
  const units = new Set<string>();
  for (const row of wanted) {
    const time = rowTime(row);
    const value = parseGermanNumber(row.value ?? "");
    if (time === null || value === null) continue;
    const parts = dimensions(row)
      .filter((dim) => !TIME_DIMENSION.test(dim.code) && (variety.get(dim.code)?.size ?? 0) > 1)
      .map((dim) => dim.label);
    if (measures.size > 1 || parts.length === 0) parts.push(row.value_variable_label || row.value_variable_code || "Wert");
    const key = `${parts.join("|")}|${row.value_variable_code}|${row.value_unit}`;
    if (!bySeries.has(key)) bySeries.set(key, { name: parts.join(" – "), points: new Map() });
    bySeries.get(key)!.points.set(time, Number((value * (spec.scale ?? 1)).toPrecision(12)));
    units.add((row.value_unit ?? "").trim());
  }

  const series = [...bySeries.values()]
    .map((entry) => ({ name: entry.name, data: [...entry.points.entries()].sort((a, b) => a[0] - b[0]) as Point[] }))
    .filter((entry) => entry.data.length >= 2);
  if (series.length === 0) return null;
  // GENESIS liefert die Zeilen ungeordnet; gegliederte Reihen (z. B. Bundesländer) stehen alphabetisch.
  if ([...variety.values()].some((attributes) => attributes.size > 1)) series.sort((a, b) => a.name.localeCompare(b.name, "de"));

  const frequency = inferFrequency(series[0]!.data.map((p) => p[0]));
  const newest = Math.max(...series.map((sr) => sr.data[sr.data.length - 1]![0]));
  const onlyUnit = units.size === 1 ? [...units][0]! : "";
  const base = /^(\d{4})\s*=\s*100$/.exec(onlyUnit);
  const magnitude = Math.max(...series.map((sr) => Math.abs(sr.data[sr.data.length - 1]![1])));
  const id = `genesis_${spec.code}`;

  return {
    meta: {
      id,
      title: spec.title,
      intro: spec.intro ?? (base ? `Index, ${base[1]} = 100` : onlyUnit ? `in ${onlyUnit}` : ""),
      unit: spec.unit ?? (onlyUnit === "%" ? "%" : ""),
      decimals: spec.decimals ?? (magnitude >= 1000 ? 0 : magnitude >= 10 ? 1 : 2),
      stand: formatDate(newest, frequency),
      frequency,
      sources: [{ name: `Statistisches Bundesamt (Destatis), GENESIS-Online, Tabelle ${spec.code}`, link: `https://genesis.destatis.de/datenbank/online/table/${spec.code}` }],
      tags: [rows[0]?.statistics_label ?? "", "GENESIS", spec.code].filter(Boolean),
      series: series.map((sr) => seriesMeta(sr.name, sr.data)),
    },
    data: { id, series },
  };
}
