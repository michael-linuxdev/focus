// Welche GENESIS-Tabellen die App zusätzlich zu Dashboard Deutschland übernimmt.
// Neue Tabelle: Code mit `npm run genesis:find -- Begriff` suchen, mit dem Workflow „GENESIS-Zugang prüfen“ ansehen, hier eintragen.
import type { TableSpec } from "../src/lib/genesis-table.ts";

export const NEW_THEMES: Record<string, { name: string; description: string }> = {
  bevoelkerung: {
    name: "Bevölkerung",
    description: "Wie viele Menschen in Deutschland und in den Bundesländern leben. Amtliche Fortschreibung des Bevölkerungsstandes aus GENESIS-Online.",
  },
};

export const TABLES: TableSpec[] = [
  { code: "12411-0001", title: "Bevölkerung in Deutschland", themes: ["bevoelkerung"], scale: 1e-6, intro: "in Mio. Personen, Stichtag 31. Dezember", decimals: 2 },
  { code: "12411-0010", title: "Bevölkerung nach Bundesländern", themes: ["bevoelkerung"], startyear: 1990, scale: 1e-6, intro: "in Mio. Personen, Stichtag 31. Dezember", decimals: 2 },
  { code: "61111-0002", title: "Verbraucherpreisindex", themes: ["preise"], startyear: 2005, decimals: 1 },
  { code: "62361-0001", title: "Reallohnindex und Nominallohnindex", themes: ["arbeitsmarkt"], startyear: 2008, decimals: 1 },
];
