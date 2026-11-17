import { describe, expect, it } from "vitest";
import { parseFlatCsv } from "../src/lib/genesis-table.ts";
import { KREIS_METRICS, kreiseFromTables, kreisRanking, standing } from "../src/lib/kreise.ts";

const HEAD1 = "time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label";
const HEAD2 = "time;1_variable_code;1_variable_label;1_variable_attribute_code;1_variable_attribute_label;2_variable_code;2_variable_label;2_variable_attribute_code;2_variable_attribute_label;value;value_unit;value_variable_code;value_variable_label";
const HEAD3 = HEAD2.replace(";value;", ";3_variable_code;3_variable_label;3_variable_attribute_code;3_variable_attribute_label;value;");
const NAMES: Record<string, string> = { "06531": "Gießen, Landkreis", "06411": "Darmstadt, kreisfreie Stadt", "06412": "Frankfurt am Main, kreisfreie Stadt", "09162": "München, Landeshauptstadt", "15362": "Ohrekreis (bis 30.06.2007)" };
const k = (code: string): string => `KREISE;Kreise;${code};${NAMES[code]}`;
const csv = (head: string, lines: string[]) => parseFlatCsv([head, ...lines].join("\n"));

const data = kreiseFromTables({
  population: csv(HEAD1, [
    `2011-12-31;${k("06531")};250000;Anzahl;BEVSTD;x`, `2025-12-31;${k("06531")};275000;Anzahl;BEVSTD;x`,
    `2011-12-31;${k("06411")};150000;Anzahl;BEVSTD;x`, `2025-12-31;${k("06411")};165000;Anzahl;BEVSTD;x`,
    `2011-12-31;${k("06412")};700000;Anzahl;BEVSTD;x`, `2025-12-31;${k("06412")};770000;Anzahl;BEVSTD;x`,
    `2011-12-31;${k("09162")};1400000;Anzahl;BEVSTD;x`, `2025-12-31;${k("09162")};1500000;Anzahl;BEVSTD;x`,
    `2011-12-31;${k("15362")};-;Anzahl;BEVSTD;x`, `2025-12-31;${k("15362")};-;Anzahl;BEVSTD;x`,
  ]),
  area: csv(HEAD1, [`2023-12-31;${k("06531")};854,56;qkm;FLC006;x`, `2023-12-31;${k("09162")};310,7;qkm;FLC006;x`]),
  ages: csv(HEAD2, [
    `2024-12-31;${k("06531")};ALTX20;x;ALT000B03;x;99999;Anzahl;BEVSTD;x`,
    `2025-12-31;${k("06531")};ALTX20;x;ALT000B03;x;8000;Anzahl;BEVSTD;x`,
    `2025-12-31;${k("06531")};ALTX20;x;ALT015B18;x;9000;Anzahl;BEVSTD;x`,
    `2025-12-31;${k("06531")};ALTX20;x;ALT018B20;x;6000;Anzahl;BEVSTD;x`,
    `2025-12-31;${k("06531")};ALTX20;x;ALT040B45;x;192000;Anzahl;BEVSTD;x`,
    `2025-12-31;${k("06531")};ALTX20;x;ALT065B75;x;30000;Anzahl;BEVSTD;x`,
    `2025-12-31;${k("06531")};ALTX20;x;ALT075UM;x;30000;Anzahl;BEVSTD;x`,
    `2025-12-31;${k("06531")};ALTX20;x;;Insgesamt;275000;Anzahl;BEVSTD;x`,
  ]),
  foreigners: csv(HEAD2, [`2025-12-31;${k("06531")};GES;x;GESW;weiblich;13000;Anzahl;BEV027;x`, `2025-12-31;${k("06531")};GES;x;;Insgesamt;27500;Anzahl;BEV027;x`]),
  housing: csv(HEAD1, [`2025-12-31;${k("06531")};12375;1000 qm;FLC001;Wohnfläche`, `2025-12-31;${k("06531")};130000;Anzahl;WOH001;Wohnungen`, `2025-12-31;${k("06531")};500000;Anzahl;RME001;Räume`]),
  vehicles: csv(HEAD2, [`2025-01-01;${k("06531")};KFZAT2;x;PKWINS;Pkw;165000;Anzahl;VER012;x`, `2025-01-01;${k("06531")};KFZAT2;x;MOTRAD;Motorräder;20000;Anzahl;VER012;x`]),
  carsByFuel: csv(HEAD3, [
    `2025-01-01;${k("06531")};KSTAT1;x;KS-ELEKTRO;Elektro;EMIGR1;x;;Insgesamt;6600;Anzahl;PKW001;x`,
    `2025-01-01;${k("06531")};KSTAT1;x;KS-ELEKTRO;Elektro;EMIGR1;x;PKW-SONST;Sonstige;6600;Anzahl;PKW001;x`,
    `2025-01-01;${k("06531")};KSTAT1;x;KS-BENZIN;Benzin;EMIGR1;x;;Insgesamt;100000;Anzahl;PKW001;x`,
  ]),
  fathers: csv(HEAD1, [`2022;${k("06531")};40,1;Prozent;ELG005;x`, `2023;${k("06531")};42,5;Prozent;ELG005;x`]),
});

describe("Mein Landkreis", () => {
  const giessen = data.kreise.find((x) => x.code === "06531")!;
  const metric = (id: string) => KREIS_METRICS.find((m) => m.id === id)!;

  it("liest die Tabellen und lässt aufgelöste Kreise weg", () => {
    expect(data.kreise.map((x) => x.code)).toEqual(["06411", "06412", "06531", "09162"]);
    expect(giessen.population).toEqual([[2011, 250000], [2025, 275000]]);
    expect(data.stand).toMatchObject({ population: "31.12.2025", area: "31.12.2023", ages: "31.12.2025", cars: "1.1.2025", fathers: "2023" });
    // Nur der jüngste Stichtag zählt, „Insgesamt“ wird nicht doppelt addiert.
    expect([giessen.under18, giessen.over65, giessen.agesTotal]).toEqual([17000, 60000, 275000]);
    expect([giessen.foreigners, giessen.flats, giessen.livingAreaM2, giessen.cars, giessen.electricCars, giessen.fathersShare]).toEqual([27500, 130000, 12_375_000, 165000, 6600, 42.5]);
  });

  it("berechnet die Kennzahlen", () => {
    const value = (id: string): number => Number(metric(id).value(giessen)!.toFixed(2));
    expect(value("entwicklung")).toBe(10);
    expect(value("dichte")).toBe(321.8);
    expect(value("unter18")).toBe(6.18);
    expect(value("ab65")).toBe(21.82);
    expect(value("auslaender")).toBe(10);
    expect(value("wohnflaeche")).toBe(45);
    expect(value("pkw")).toBe(600);
    expect(value("eautos")).toBe(4);
    expect(metric("dichte").value(data.kreise[0]!)).toBeNull();
  });

  it("ordnet einen Kreis unter allen und im Land ein", () => {
    const place = standing(data, metric("einwohner"), giessen)!;
    expect(place).toEqual({ value: 275000, rank: 3, of: 4, median: 522500, landMedian: 275000 });
    // Bayern hat hier nur einen Kreis: kein Landesvergleich.
    expect(standing(data, metric("einwohner"), data.kreise[3]!)!.landMedian).toBeNull();
    expect(standing(data, metric("dichte"), data.kreise[0]!)).toBeNull();
    expect(kreisRanking(data, metric("einwohner")).map((x) => x.kreis.code)).toEqual(["09162", "06412", "06531", "06411"]);
  });
});
