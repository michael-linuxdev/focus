// „Mein Jahrgang“: Aufbereitung der Tabellen und Rechenwege. Reine Funktionen.
import { dimensions, parseGermanNumber, rowTime, type Row } from "./genesis-table.ts";
import type { CohortData, Point } from "./types.ts";

const OLDEST = 85; // Die Quelle fasst „85 Jahre und mehr“ zusammen.

/** Baut die Jahrgangsdaten aus Bevölkerung nach Altersjahren (12411-0005), Geburten (12612-0001) und Sterbetafeln (12621-0002). */
export function cohortsFromRows(ageRows: Row[], birthRows: Row[], lifeRows: Row[]): CohortData {
  const byYear = new Map<number, number[]>();
  for (const row of ageRows) {
    const dim = dimensions(row).find((d) => d.code.startsWith("ALT"));
    const year = Number((row.time ?? "").slice(0, 4));
    const value = parseGermanNumber(row.value ?? "");
    if (!dim || value === null || !Number.isInteger(year)) continue;
    const single = /^ALT(\d{3})$/.exec(dim.attribute);
    const age = single ? Number(single[1]) : /^ALT085UM$/.test(dim.attribute) ? OLDEST : null;
    if (age === null || age > OLDEST) continue;
    if (!byYear.has(year)) byYear.set(year, new Array<number>(OLDEST + 1).fill(0));
    byYear.get(year)![age] = value;
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);

  const births: [number, number][] = [];
  for (const row of birthRows) {
    const sex = dimensions(row).find((d) => d.code === "GES");
    const value = parseGermanNumber(row.value ?? "");
    const year = Number(row.time);
    if ((sex && sex.attribute !== "") || value === null || !Number.isInteger(year)) continue;
    births.push([year, value]);
  }
  births.sort((a, b) => a[0] - b[0]);

  // Sterbetafeln: je Zeitraum und Geschlecht die fernere Lebenserwartung nach vollendetem Alter.
  const tables = new Map<number, { label: string; male: number[]; female: number[] }>();
  for (const row of lifeRows) {
    const time = rowTime(row);
    const dims = dimensions(row);
    const sex = dims.find((d) => d.code === "GES")?.attribute;
    const age = /(\d{3})$/.exec(dims.find((d) => d.code.startsWith("ALT"))?.attribute ?? "");
    const value = parseGermanNumber(row.value ?? "");
    if (time === null || !age || value === null || (sex !== "GESM" && sex !== "GESW")) continue;
    const endYear = new Date(time).getUTCFullYear();
    if (!tables.has(endYear)) {
      const start = /^(\d{4})-P(\d+)Y$/.exec(row.time ?? "");
      tables.set(endYear, { label: start ? `${start[1]}/${String(endYear).slice(2)}` : String(endYear), male: [], female: [] });
    }
    tables.get(endYear)![sex === "GESM" ? "male" : "female"][Number(age[1])] = value;
  }
  const periods = [...tables.keys()].sort((a, b) => a - b);
  const latest = tables.get(periods[periods.length - 1] ?? -1);
  const atBirth = (key: "male" | "female"): [number, number][] =>
    periods.map((year) => [year, tables.get(year)![key][0]] as [number, number | undefined]).filter((p): p is [number, number] => p[1] !== undefined);

  return {
    years,
    ages: years.map((year) => byYear.get(year)!),
    births,
    remaining: { period: latest?.label ?? "", male: latest?.male ?? [], female: latest?.female ?? [] },
    atBirth: { male: atBirth("male"), female: atBirth("female") },
  };
}

/** Größe eines Geburtsjahrgangs je Stichtagsjahr, solange er als einzelnes Altersjahr ausgewiesen wird (bis 84). */
export function cohortPath(data: CohortData, birthYear: number): Point[] {
  const out: Point[] = [];
  data.years.forEach((year, i) => {
    const age = year - birthYear;
    if (age >= 0 && age < OLDEST) out.push([Date.UTC(year, 0, 1), data.ages[i]![age]!]);
  });
  return out;
}

/** Menschen ab 65 je 100 Menschen im Alter von 20 bis 64, je Stichtagsjahr. */
export function oldAgeRatio(data: CohortData): Point[] {
  return data.years.map((year, i) => {
    const ages = data.ages[i]!;
    let working = 0;
    let older = 0;
    for (let age = 20; age <= OLDEST; age++) {
      if (age < 65) working += ages[age]!;
      else older += ages[age]!;
    }
    return [Date.UTC(year, 0, 1), (older / working) * 100];
  });
}

/** Rang eines Jahrgangs nach Geburtenzahl (1 = geburtenstärkster) unter allen Jahren der Reihe. */
export function birthRank(data: CohortData, birthYear: number): { rank: number; of: number; births: number } | null {
  const own = data.births.find((b) => b[0] === birthYear);
  if (!own) return null;
  return { rank: data.births.filter((b) => b[1] > own[1]).length + 1, of: data.births.length, births: own[1] };
}

/** Das am stärksten besetzte einzelne Altersjahr im jüngsten Stichtagsjahr. */
export function largestAge(data: CohortData): { age: number; count: number; birthYear: number } | null {
  const year = data.years[data.years.length - 1];
  const ages = data.ages[data.ages.length - 1];
  if (year === undefined || !ages) return null;
  let best = 0;
  for (let age = 1; age < OLDEST; age++) if (ages[age]! > ages[best]!) best = age;
  return { age: best, count: ages[best]!, birthYear: year - best };
}
