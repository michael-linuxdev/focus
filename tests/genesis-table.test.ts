import { describe, expect, it } from "vitest";
import { filterRows, parseFlatCsv, parseGermanNumber, rowTime, tableToIndicator } from "../src/lib/genesis-table.ts";

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
  "12411;Fortschreibung des Bevölkerungsstandes;STAG;Stichtag;2022-12-31;DLAND;Bundesländer;02;Hamburg;1832675;Anzahl;BEVSTD;Bevölkerungsstand",
  "12411;Fortschreibung des Bevölkerungsstandes;STAG;Stichtag;2019-12-31;DLAND;Bundesländer;12;Brandenburg;2521893;Anzahl;BEVSTD;Bevölkerungsstand",
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
    expect(result.meta.region).toBe("laender");
    expect(result.meta.series.map((s) => s.code)).toEqual(["12", "02"]);
  });

  it("wählt Merkmale aus und liefert null, wenn nichts übrig bleibt", () => {
    const only = tableToIndicator(parseFlatCsv(wages), { code: "x", title: "t", themes: [], measures: ["VST074"] })!;
    expect(only.meta.series.map((s) => s.name)).toEqual(["Reallohnindex"]);
    expect(tableToIndicator(parseFlatCsv(wages), { code: "x", title: "t", themes: [], measures: ["GIBTSNICHT"] })).toBeNull();
  });

  it("filtert nach Gliederung, auch auf „Insgesamt“ und auf eine Ebene", () => {
    const head = "time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;2_variable_code;2_variable_label;2_variable_attribute_code;2_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label";
    const rows = parseFlatCsv(
      [
        head,
        "2023;GES;Geschlecht;GESW;weiblich;CC13A2;Zweisteller;CC13-01;Nahrungsmittel;1;Anzahl;X;Wert",
        "2023;GES;Geschlecht;;Insgesamt;CC13A2;Zweisteller;CC13-01;Nahrungsmittel;2;Anzahl;X;Wert",
        "2023;GES;Geschlecht;;Insgesamt;CC13A3;Dreisteller;CC13-011;Brot;3;Anzahl;X;Wert",
        "2024;GES;Geschlecht;;Insgesamt;CC13A2;Zweisteller;CC13-01;Nahrungsmittel;4;Anzahl;X;Wert",
        "2024;GES;Geschlecht;;Insgesamt;CC13A2;Zweisteller;CC13-02;Tabak;5;Prozent;X;Wert",
      ].join("\n"),
    );
    expect(filterRows(rows, { where: { GES: "" } })).toHaveLength(4);
    expect(filterRows(rows, { where: { GES: "", CC13A2: "*" } }).map((r) => r.value)).toEqual(["2", "4", "5"]);
    expect(filterRows(rows, { where: { CC13A2: "CC13-02" } }).map((r) => r.value)).toEqual(["5"]);
    const quote = tableToIndicator(rows, { code: "t", id: "eigene_kennung", title: "t", themes: [], where: { CC13A2: "CC13-02" } });
    expect(quote).toBeNull(); // nur ein Zeitpunkt
    const one = tableToIndicator(rows, { code: "t", id: "eigene_kennung", title: "t", themes: [], where: { GES: "", CC13A2: "CC13-01" } })!;
    expect(one.meta.id).toBe("eigene_kennung");
    expect(one.data.series[0]!.data.map((p) => p[1])).toEqual([2, 4]);
  });

  it("liest Stichmonat und Zeitraum", () => {
    expect(rowTime({ time: "2025-04P1M" })).toBe(Date.UTC(2025, 3, 1));
    expect(rowTime({ time: "2018-P2Y" })).toBe(Date.UTC(2020, 0, 1));
  });

  it("fasst Ausprägungen zu Gruppen zusammen, auch als Anteil", () => {
    const head = "time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label";
    const line = (year: number, age: string, value: number): string => `${year}-12-31;ALT013;Altersjahre;${age};x;${value};Anzahl;BEVSTD;Bevölkerungsstand`;
    const rows = parseFlatCsv(
      [head, line(2023, "ALT000", 10), line(2023, "ALT019", 10), line(2023, "ALT040", 50), line(2023, "ALT085UM", 30), line(2023, "", 100), line(2024, "ALT005", 15), line(2024, "ALT040", 50), line(2024, "ALT070", 35)].join("\n"),
    );
    const groups = [
      { name: "unter 20", codes: "^ALT0(0\\d|1\\d)$" },
      { name: "20 bis 64", codes: "^ALT0([2-5]\\d|6[0-4])$" },
      { name: "65 und älter", codes: "^ALT(0(6[5-9]|[78]\\d)|085UM)$" },
    ];
    const sums = tableToIndicator(rows, { code: "a", title: "t", themes: [], aggregate: { dimension: "ALT013", groups } })!;
    expect(sums.meta.series.map((s) => s.name)).toEqual(["unter 20", "20 bis 64", "65 und älter"]);
    expect(sums.data.series.map((s) => s.data.map((p) => p[1]))).toEqual([[20, 15], [50, 50], [30, 35]]);
    const share = tableToIndicator(rows, { code: "a", title: "t", themes: [], aggregate: { dimension: "ALT013", groups, share: true } })!;
    expect(share.data.series[2]!.data.map((p) => p[1])).toEqual([30, 35]);
    expect(share.meta.unit).toBe("%");
  });

  it("filtert mit regulärem Ausdruck", () => {
    const head = "time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label";
    const rows = parseFlatCsv([head, "2024;WZ08B6;x;WZ08-C;Verarbeitendes Gewerbe;1;Anzahl;V;W", "2024;WZ08B6;x;WZ08-24;Metall;2;Anzahl;V;W", "2024;WZ08B6;x;WZ08-A-S;Gesamtwirtschaft;3;Anzahl;V;W"].join("\n"));
    expect(filterRows(rows, { where: { WZ08B6: "/^WZ08-([A-S]|A-S)$/" } }).map((r) => r.value)).toEqual(["1", "3"]);
  });
});
