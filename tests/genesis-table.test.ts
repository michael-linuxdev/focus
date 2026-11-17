import { describe, expect, it } from "vitest";
import { parseFlatCsv, parseGermanNumber, rowTime, tableToIndicator } from "../src/lib/genesis-table.ts";

// Zeilen wie von GENESIS am 17.11.2026 geliefert (gekürzt), samt BOM und ungeordneter Reihenfolge.
const HEAD2 = "statistics_code;statistics_label;time_code;time_label;time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;2_variable_code;2_variable_label;2_variable_attribute_code;2_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label";
const wages = [
  "﻿" + HEAD2,
  "62361;Verdiensterhebung;JAHR;Jahr;2025;MONAT;Monate;MONAT02;Februar;DINSG;Deutschland insgesamt;DG;Deutschland;3,8;%;VST075;in",
  "62361;Verdiensterhebung;JAHR;Jahr;2025;MONAT;Monate;MONAT02;Februar;DINSG;Deutschland insgesamt;DG;Deutschland;94,4;2025=100;VST074;Reallohnindex",
  "62361;Verdiensterhebung;JAHR;Jahr;2025;MONAT;Monate;MONAT02;Februar;DINSG;Deutschland insgesamt;DG;Deutschland;93,5;2025=100;VST075;Nominallohnindex",
  "62361;Verdiensterhebung;JAHR;Jahr;2025;MONAT;Monate;MONAT01;Januar;DINSG;Deutschland insgesamt;DG;Deutschland;93,9;2025=100;VST074;Reallohnindex",
  "62361;Verdiensterhebung;JAHR;Jahr;2025;MONAT;Monate;MONAT01;Januar;DINSG;Deutschland insgesamt;DG;Deutschland;92,8;2025=100;VST075;Nominallohnindex",
  "62361;Verdiensterhebung;JAHR;Jahr;2025;MONAT;Monate;MONAT03;März;DINSG;Deutschland insgesamt;DG;Deutschland;94,0;2025=100;VST074;Reallohnindex",
  "62361;Verdiensterhebung;JAHR;Jahr;2026;MONAT;Monate;MONAT02;Februar;DINSG;Deutschland insgesamt;DG;Deutschland;...;2025=100;VST075;Nominallohnindex",
  "62361;Verdiensterhebung;JAHR;Jahr;2026;MONAT;Monate;MONAT01;Januar;DINSG;Deutschland insgesamt;DG;Deutschland;95,1;2025=100;VST074;Reallohnindex",
  "",
].join("\r\n");

const HEAD1 = "statistics_code;statistics_label;time_code;time_label;time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label";
const states = [
  HEAD1,
  "12411;Fortschreibung des Bevölkerungsstandes;STAG;Stichtag;2019-12-31;DLAND;Bundesländer;12;Brandenburg;2521893;Anzahl;BEVSTD;Bevölkerungsstand",
  "12411;Fortschreibung des Bevölkerungsstandes;STAG;Stichtag;2022-12-31;DLAND;Bundesländer;02;Hamburg;1832675;Anzahl;BEVSTD;Bevölkerungsstand",
  "12411;Fortschreibung des Bevölkerungsstandes;STAG;Stichtag;2020-12-31;DLAND;Bundesländer;12;Brandenburg;2531071;Anzahl;BEVSTD;Bevölkerungsstand",
  "12411;Fortschreibung des Bevölkerungsstandes;STAG;Stichtag;2023-12-31;DLAND;Bundesländer;02;Hamburg;1851596;Anzahl;BEVSTD;Bevölkerungsstand",
].join("\n");

describe("GENESIS-Tabellen", () => {
  it("liest Zeilen, auch mit Anführungszeichen und Semikolon im Feld", () => {
    const rows = parseFlatCsv('a;b\n"x;1";"sagt ""ja"""\n');
    expect(rows).toEqual([{ a: "x;1", b: 'sagt "ja"' }]);
    expect(parseFlatCsv(wages)).toHaveLength(8);
  });

  it("liest deutsche Zahlen und erkennt Platzhalter", () => {
    expect(parseGermanNumber("1.234,5")).toBe(1234.5);
    expect(parseGermanNumber("-0,4")).toBe(-0.4);
    expect(parseGermanNumber("61657945")).toBe(61657945);
    for (const gap of ["...", "-", ".", "", "x"]) expect(parseGermanNumber(gap)).toBeNull();
  });

  it("bestimmt den Zeitpunkt aus Stichtag, Monat, Quartal oder Jahr", () => {
    const [first] = parseFlatCsv(wages);
    expect(rowTime(first!)).toBe(Date.UTC(2025, 1, 1));
    expect(rowTime({ time: "2019-12-31" })).toBe(Date.UTC(2019, 11, 31));
    expect(rowTime({ time: "2024", "1_variable_code": "QUARTG", "1_variable_attribute_code": "QUART3" })).toBe(Date.UTC(2024, 6, 1));
    expect(rowTime({ time: "2024" })).toBe(Date.UTC(2024, 0, 1));
    expect(rowTime({ time: "" })).toBeNull();
  });

  it("bildet je Merkmal eine Reihe, ohne Veränderungsraten und Lücken", () => {
    const result = tableToIndicator(parseFlatCsv(wages), { code: "62361-0001", title: "Löhne", themes: ["arbeitsmarkt"] })!;
    expect(result.meta.id).toBe("genesis_62361-0001");
    expect(result.meta.series.map((s) => s.name)).toEqual(["Reallohnindex", "Nominallohnindex"]);
    expect(result.data.series[0]!.data).toEqual([
      [Date.UTC(2025, 0, 1), 93.9],
      [Date.UTC(2025, 1, 1), 94.4],
      [Date.UTC(2025, 2, 1), 94],
      [Date.UTC(2026, 0, 1), 95.1],
    ]);
    expect(result.data.series[1]!.data).toHaveLength(2);
    expect(result.meta.intro).toBe("Index, 2025 = 100");
    expect(result.meta.unit).toBe("");
    expect(result.meta.frequency).toBe("monatlich");
    expect(result.meta.stand).toBe("Januar 2026");
    expect(result.meta.series[0]!.yearAgo).toEqual([Date.UTC(2025, 0, 1), 93.9]);
  });

  it("benennt Reihen nach der Gliederung und rechnet um", () => {
    const result = tableToIndicator(parseFlatCsv(states), { code: "12411-0010", title: "Bevölkerung", themes: ["bevoelkerung"], scale: 1e-6, intro: "in Mio. Personen", decimals: 2 })!;
    expect(result.meta.series.map((s) => s.name)).toEqual(["Brandenburg", "Hamburg"]);
    expect(result.data.series[1]!.data).toEqual([
      [Date.UTC(2022, 11, 31), 1.832675],
      [Date.UTC(2023, 11, 31), 1.851596],
    ]);
    expect(result.meta.frequency).toBe("jährlich");
    expect(result.meta.intro).toBe("in Mio. Personen");
  });

  it("wählt Merkmale aus und liefert null, wenn nichts übrig bleibt", () => {
    const only = tableToIndicator(parseFlatCsv(wages), { code: "x", title: "t", themes: [], measures: ["VST074"] })!;
    expect(only.meta.series.map((s) => s.name)).toEqual(["Reallohnindex"]);
    expect(tableToIndicator(parseFlatCsv(wages), { code: "x", title: "t", themes: [], measures: ["GIBTSNICHT"] })).toBeNull();
  });
});
