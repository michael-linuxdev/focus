import { describe, expect, it } from "vitest";
import { birthRank, cohortPath, cohortsFromRows, largestAge, oldAgeRatio } from "../src/lib/cohort.ts";
import { priceItemsFromRows } from "../src/lib/genesis-facts.ts";
import { parseFlatCsv } from "../src/lib/genesis-table.ts";
import { itemChanges, itemSeries } from "../src/lib/money.ts";

const AGE_HEAD = "time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label";
const age = (year: number, code: string, value: number): string => `${year}-12-31;ALT013;Altersjahre (u1-85m);${code};x;${value};Anzahl;BEVSTD;Bevölkerungsstand`;
const BIRTH_HEAD = "time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label";
const birth = (year: number, sex: string, value: number): string => `${year};GES;Geschlecht;${sex};x;${value};Anzahl;BEV001;Lebendgeborene`;
const LIFE_HEAD = "time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;2_variable_code;2_variable_label;2_variable_attribute_code;2_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label";
const life = (start: number, sex: string, a: number, value: string): string => `${start}-P2Y;GES;Geschlecht;${sex};x;ALT577;Vollendetes Alter;ALTVOLL${String(a).padStart(3, "0")};${a} Jahre;${value};Jahre;LEB007;e(x)`;

describe("Mein Jahrgang", () => {
  const data = cohortsFromRows(
    parseFlatCsv(
      [
        AGE_HEAD,
        age(2023, "ALT000", 700), age(2023, "ALT001", 720), age(2023, "ALT020", 1000), age(2023, "ALT064", 900), age(2023, "ALT065", 400), age(2023, "ALT085UM", 300), age(2023, "", 9999),
        age(2024, "ALT000", 650), age(2024, "ALT001", 705), age(2024, "ALT002", 730), age(2024, "ALT020", 1000), age(2024, "ALT064", 800), age(2024, "ALT065", 500), age(2024, "ALT085UM", 400),
      ].join("\n"),
    ),
    parseFlatCsv([BIRTH_HEAD, birth(2022, "", 740), birth(2023, "", 690), birth(2023, "GESW", 340), birth(2024, "", 677)].join("\n")),
    parseFlatCsv([LIFE_HEAD, life(2019, "GESM", 0, "78,5"), life(2019, "GESW", 0, "83,4"), life(2022, "GESM", 0, "78,9"), life(2022, "GESW", 0, "83,5"), life(2022, "GESW", 40, "44,1"), life(2022, "GESM", 40, "39,8")].join("\n")),
  );

  it("liest Altersjahre, Geburten und Sterbetafeln", () => {
    expect(data.years).toEqual([2023, 2024]);
    expect(data.ages[1]![2]).toBe(730);
    expect(data.ages[0]![85]).toBe(300);
    expect(data.births).toEqual([[2022, 740], [2023, 690], [2024, 677]]);
    expect(data.remaining.period).toBe("2022/24");
    expect(data.remaining.female[40]).toBe(44.1);
    expect(data.atBirth.male).toEqual([[2021, 78.5], [2024, 78.9]]);
  });

  it("verfolgt einen Jahrgang über die Stichtage", () => {
    // Geboren 2023: Ende 2023 null Jahre alt, Ende 2024 ein Jahr alt.
    expect(cohortPath(data, 2023).map((p) => p[1])).toEqual([700, 705]);
    expect(cohortPath(data, 2022).map((p) => p[1])).toEqual([720, 730]);
    // Wer 85 und älter ist, steckt in der Sammelgruppe und hat keinen eigenen Wert.
    expect(cohortPath(data, 1938)).toEqual([]);
  });

  it("berechnet Altenquotient, Rang und stärkstes Altersjahr", () => {
    expect(oldAgeRatio(data).map((p) => Number(p[1].toFixed(2)))).toEqual([36.84, 50]);
    expect(birthRank(data, 2023)).toEqual({ rank: 2, of: 3, births: 690 });
    expect(birthRank(data, 1900)).toBeNull();
    expect(largestAge(data)).toEqual({ age: 20, count: 1000, birthYear: 2004 });
  });
});

describe("Preise im Detail", () => {
  const head = "time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;2_variable_code;2_variable_label;2_variable_attribute_code;2_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label";
  const row = (year: number, level: number, code: string, label: string, value: string, unit = "2020=100"): string =>
    `${year};DINSG;Deutschland insgesamt;DG;Deutschland;CC13A${level};Ebene;${code};${label};${value};${unit};PREIS1;Verbraucherpreisindex`;
  const prices = priceItemsFromRows(
    parseFlatCsv(
      [
        head,
        row(2021, 5, "CC13-01151", "Butter", "110,0"), row(2020, 5, "CC13-01151", "Butter", "100,0"), row(2022, 5, "CC13-01151", "Butter", "150,0"),
        row(2020, 5, "CC13-09131", "Personal-Computer", "100,0"), row(2022, 5, "CC13-09131", "Personal-Computer", "90,0"),
        row(2021, 5, "CC13-09514", "E-Book-Download", "100,0"), row(2022, 5, "CC13-09514", "E-Book-Download", "101,0"),
        row(2020, 2, "CC13-01", "Nahrungsmittel", "100,0"), row(2022, 2, "CC13-01", "Nahrungsmittel", "120,0"), row(2022, 2, "CC13-01", "Nahrungsmittel", "9,9", "%"),
      ].join("\n"),
    ),
    parseFlatCsv([head, row(2020, 5, "CC13-01151", "Butter", "2,31", "Promille"), row(2020, 2, "CC13-01", "Nahrungsmittel", "119,04", "Promille")].join("\n")),
  );

  it("sammelt alle Ebenen mit Jahreswerten und Gewicht", () => {
    expect(prices.years).toEqual([2020, 2021, 2022]);
    expect(prices.items.map((i) => [i.code, i.level, i.weight])).toEqual([["CC13-01", 2, 119.04], ["CC13-01151", 5, 2.31], ["CC13-09131", 5, undefined], ["CC13-09514", 5, undefined]]);
    expect(prices.items[2]!.values).toEqual([100, null, 90]);
  });

  it("ordnet nach Preisänderung und lässt Positionen ohne Startwert weg", () => {
    const changes = itemChanges(prices, 2020, 2022);
    expect(changes.map((c) => [c.item.label, Math.round(c.change)])).toEqual([["Butter", 50], ["Nahrungsmittel", 20], ["Personal-Computer", -10]]);
    expect(itemChanges(prices, 1999, 2022)).toEqual([]);
    expect(itemSeries(prices, prices.items[1]!, 2021).map((p) => Number(p[1].toFixed(1)))).toEqual([100, 136.4]);
    expect(itemSeries(prices, prices.items[3]!, 2020)).toEqual([]);
  });
});
