// Welche GENESIS-Tabellen die App zusätzlich zu Dashboard Deutschland übernimmt.
// Neue Tabelle: Code mit `npm run genesis:find -- Begriff` suchen, mit dem Workflow „GENESIS-Zugang prüfen“ ansehen, hier eintragen.
import type { TableSpec } from "../src/lib/genesis-table.ts";

export const NEW_THEMES: Record<string, { name: string; description: string }> = {
  bevoelkerung: {
    name: "Bevölkerung",
    description: "Wie viele Menschen in Deutschland leben, wie alt sie sind, wie viele geboren werden, sterben, zu- und fortziehen. Amtliche Tabellen aus GENESIS-Online.",
  },
  laender: {
    name: "Bundesländer",
    description: "Preise, Mieten, Einkommen, Wirtschaftsleistung, Arbeitslosigkeit und Lebenserwartung je Bundesland. Grundlage des Ländervergleichs.",
  },
  verdienste: {
    name: "Verdienste",
    description: "Wie sich Löhne und Gehälter entwickeln, insgesamt und nach Branchen. Amtliche Verdiensterhebung aus GENESIS-Online.",
  },
};

const MIO_PERSONS = { scale: 1e-6, intro: "in Mio. Personen, Stichtag 31. Dezember", decimals: 2 } as const;

export const TABLES: TableSpec[] = [
  // Bevölkerung. Der Bevölkerungsstand vor 1990 gilt in GENESIS nur für das frühere Bundesgebiet (Sprung von
  // 62 auf 80 Mio.), deshalb beginnen diese Reihen 1990. Geburten und Sterbefälle sind durchgehend gesamtdeutsch.
  { code: "12411-0001", title: "Bevölkerung in Deutschland", themes: ["bevoelkerung"], startyear: 1990, ...MIO_PERSONS },
  {
    code: "12411-0005",
    title: "Bevölkerung nach Altersgruppen",
    themes: ["bevoelkerung"],
    startyear: 1990,
    intro: "Anteil an der Bevölkerung in Prozent, Stichtag 31. Dezember",
    decimals: 1,
    aggregate: {
      dimension: "ALT013",
      share: true,
      groups: [
        { name: "unter 20 Jahre", codes: "^ALT0[01]\\d$" },
        { name: "20 bis 64 Jahre", codes: "^ALT0([2-5]\\d|6[0-4])$" },
        { name: "65 Jahre und älter", codes: "^ALT(06[5-9]|0[78]\\d|085UM)$" },
      ],
    },
  },
  { code: "12612-0001", title: "Geburten", themes: ["bevoelkerung"], where: { GES: "" }, scale: 1e-3, intro: "Lebendgeborene in Tausend je Jahr", decimals: 0 },
  { code: "12613-0001", title: "Sterbefälle", themes: ["bevoelkerung"], measures: ["BEV002"], scale: 1e-3, intro: "Gestorbene in Tausend je Jahr", decimals: 0 },
  {
    code: "12711-0005",
    title: "Wanderung zwischen Deutschland und dem Ausland",
    themes: ["bevoelkerung"],
    where: { NAT: "", GES: "" },
    scale: 1e-3,
    intro: "Personen in Tausend je Jahr",
    decimals: 0,
  },
  // Preise und Wohnen
  { code: "61111-0002", title: "Verbraucherpreisindex", themes: ["preise"], startyear: 2005, decimals: 1 },
  { code: "61111-0003", title: "Verbraucherpreise nach Ausgabengruppen", themes: ["preise"], startyear: 2000, where: { CC13A2: "*" }, decimals: 1 },
  { code: "61262-0002", title: "Häuserpreisindex", themes: ["wohnen", "preise"], startyear: 2000, decimals: 1 },
  // Verdienste
  { code: "62361-0001", title: "Reallohnindex und Nominallohnindex", themes: ["verdienste", "arbeitsmarkt"], startyear: 2008, decimals: 1 },
  {
    code: "62361-0026",
    title: "Bruttomonatsverdienste nach Branchen",
    themes: ["verdienste"],
    startyear: 2007,
    // Einzelne Wirtschaftsabschnitte sowie die beiden Gesamtgrößen; „B-S“ reicht weiter zurück als „A-S“.
    where: { WZ08B6: "/^WZ08-([A-S]|A-S|B-S)$/" },
    decimals: 1,
  },
  // Bundesländer
  { code: "12411-0010", title: "Bevölkerung nach Bundesländern", themes: ["laender", "bevoelkerung"], startyear: 1990, ...MIO_PERSONS },
  { code: "82111-0010", title: "Wirtschaftsleistung nach Bundesländern", themes: ["laender"], startyear: 1991, scale: 1e-3, intro: "Bruttoinlandsprodukt in Mrd. Euro, in jeweiligen Preisen", decimals: 1 },
  {
    code: "82411-0010",
    title: "Verfügbares Einkommen je Einwohner nach Bundesländern",
    themes: ["laender"],
    startyear: 1991,
    measures: ["EKM014"],
    intro: "Verfügbares Einkommen der privaten Haushalte in Euro je Einwohner und Jahr",
    decimals: 0,
  },
  { code: "13211-0007", id: "genesis_13211-0007_quote", title: "Arbeitslosenquote nach Bundesländern", themes: ["laender"], startyear: 2005, measures: ["ERW112"], intro: "Arbeitslosenquote aller zivilen Erwerbspersonen in Prozent, Jahresdurchschnitt", decimals: 1 },
  { code: "61111-0010", title: "Verbraucherpreisindex nach Bundesländern", themes: ["laender"], startyear: 1995, decimals: 1 },
  { code: "61111-0020", title: "Nettokaltmieten nach Bundesländern", themes: ["laender", "wohnen"], startyear: 1995, decimals: 1 },
  { code: "12621-0004", id: "genesis_12621-0004_w", title: "Lebenserwartung der Frauen nach Bundesländern", themes: ["laender"], startyear: 2002, where: { GES: "GESW" }, intro: "Lebenserwartung bei Geburt in Jahren, Sterbetafel über drei Jahre", decimals: 1 },
  { code: "12621-0004", id: "genesis_12621-0004_m", title: "Lebenserwartung der Männer nach Bundesländern", themes: ["laender"], startyear: 2002, where: { GES: "GESM" }, intro: "Lebenserwartung bei Geburt in Jahren, Sterbetafel über drei Jahre", decimals: 1 },
];

/** Tabellen für die Zusatzdateien facts.json, prices.json und cohorts.json; Parameter wie bei den Indikatoren oben, damit jeder Abruf nur einmal läuft. */
export const EXTRA_TABLES = {
  weights: { code: "61111-0007", params: {} },
  earnings: { code: "62361-0031", params: {} },
  priceItems: { code: "61111-0003", params: { startyear: "2000" } },
  ages: { code: "12411-0005", params: { startyear: "1990" } },
  births: { code: "12612-0001", params: {} },
  lifeTables: { code: "12621-0002", params: {} },
} as const;

const YEAR = new Date().getUTCFullYear();

/**
 * Kreistabellen aus GENESIS-Online für kreise.json. Gebraucht wird jeweils nur der jüngste Stand; das Startjahr
 * hält die Abrufe klein (die Pkw-Tabelle nach Kraftstoffarten hat je Jahr rund zehn Megabyte).
 */
export const KREIS_TABLES = {
  population: { code: "12411-0015", params: { startyear: "2011" } },
  area: { code: "11111-0002", params: { startyear: String(YEAR - 4) } },
  ages: { code: "12411-0017", params: { startyear: String(YEAR - 2) } },
  foreigners: { code: "12521-0040", params: { startyear: String(YEAR - 2) } },
  housing: { code: "31231-0020", params: { startyear: String(YEAR - 3) } },
  vehicles: { code: "46251-0020", params: { startyear: String(YEAR - 1) } },
  carsByFuel: { code: "46251-0021", params: { startyear: String(YEAR - 1) } },
  fathers: { code: "22922-0042", params: { startyear: String(YEAR - 4) } },
} as const;
