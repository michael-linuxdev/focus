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
  // Bevölkerung
  { code: "12411-0001", title: "Bevölkerung in Deutschland", themes: ["bevoelkerung"], ...MIO_PERSONS },
  {
    code: "12411-0005",
    title: "Bevölkerung nach Altersgruppen",
    themes: ["bevoelkerung"],
    startyear: 1970,
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
    where: { WZ08B6: "/^WZ08-([A-S]|A-S)$/" },
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

/** Tabellen ohne Zeitreihe; aus ihnen entsteht public/data/facts.json. */
export const FACT_TABLES = { weights: "61111-0007", earnings: "62361-0031" } as const;
