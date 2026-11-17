/** Ein Messpunkt: Zeitstempel in Millisekunden (UTC) und Wert. */
export type Point = [number, number];

export type Frequency = "täglich" | "wöchentlich" | "monatlich" | "vierteljährlich" | "jährlich";

export interface Extreme {
  dir: "high" | "low";
  /** Der auffällige Wert: bei Raten der Stand selbst, sonst die Veränderung zum Vorjahr in Prozent. */
  value: number;
  /** Zeitpunkt, zu dem der Wert zuletzt mindestens so extrem war; null, wenn nie im gesamten Zeitraum. */
  since: number | null;
  /** Länge des Zeitraums ohne vergleichbaren Wert, in Jahren. */
  years: number;
}

export interface SeriesMeta {
  name: string;
  /** Schlüssel der Gliederung in der Quelle, z. B. „09“ für Bayern oder „CC13-01“ für Nahrungsmittel. */
  code?: string;
  /** Gesetzt, wenn der jüngste Wert seit Jahren nicht so hoch oder niedrig war. */
  extreme?: Extreme;
  /** Achsgruppe der Quelle: Reihen verschiedener Gruppen haben verschiedene Skalen. */
  axis: number;
  count: number;
  first: Point;
  last: Point;
  /** Wert etwa ein Jahr vor dem letzten Punkt, falls vorhanden. */
  yearAgo: Point | null;
  /** Ausgedünnte Werte der letzten Jahre für die Minigrafik. */
  spark: number[];
}

export interface Source {
  name: string;
  link: string;
}

export interface IndicatorMeta {
  id: string;
  title: string;
  /** Kurzbeschreibung der Quelle, meist Einheit und Bereinigung. */
  intro: string;
  /** Einheit zum Anhängen an Werte, kann leer sein. */
  unit: string;
  decimals: number;
  /** Datenstand laut Quelle, z. B. „Januar 2026“. */
  stand: string;
  frequency: Frequency;
  sources: Source[];
  tags: string[];
  /** „laender“: eine Reihe je Bundesland, für den Ländervergleich. */
  region?: "laender";
  series: SeriesMeta[];
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  indicatorIds: string[];
}

export interface Catalog {
  fetchedAt: string;
  themes: Theme[];
  indicators: IndicatorMeta[];
}

export interface IndicatorData {
  id: string;
  series: { name: string; data: Point[] }[];
}

/** Querschnittsdaten ohne Zeitreihe, für den Bereich „Mein Geld“. */
export interface Facts {
  /** Gewichte der zwölf Ausgabengruppen im Verbraucherpreisindex, in Promille. */
  weights: { code: string; label: string; permille: number }[];
  weightsYear: string;
  /** Verdienste nach Geschlecht und Altersgruppe; leere Kennung = insgesamt. */
  earnings: { sex: string; age: string; hourlyMean?: number; monthlyMean?: number; hourlyMedian?: number; monthlyMedian?: number }[];
  earningsStand: string;
}
