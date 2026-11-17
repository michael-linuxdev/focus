/** Ein Messpunkt: Zeitstempel in Millisekunden (UTC) und Wert. */
export type Point = [number, number];

export type Frequency = "täglich" | "wöchentlich" | "monatlich" | "vierteljährlich" | "jährlich";

export interface SeriesMeta {
  name: string;
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
