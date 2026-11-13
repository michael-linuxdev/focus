/**
 * Typen der Datendateien in `data/`. Die Spiellogik bekommt die Daten hineingereicht
 * und liest selbst keine Dateien.
 */
export interface GameConfig {
  readonly version: number;
  readonly title: string;
  readonly shortTitle: string;
  readonly ticksPerSecond: number;
}

export interface RoadDef {
  readonly id: string;
  /** Kachelkoordinaten [Spalte, Zeile], aufeinanderfolgende Punkte achsenparallel. */
  readonly waypoints: readonly (readonly number[])[];
}

export interface RoadsData {
  readonly version: number;
  readonly grid: { readonly cols: number; readonly rows: number };
  readonly roads: readonly RoadDef[];
}

export interface UnitDef {
  readonly id: string;
  readonly hp: number;
  readonly speedMilliPerTick: number;
}

export interface WaveGroupDef {
  readonly unit: string;
  readonly count: number;
  readonly startTick: number;
  readonly intervalTicks: number;
  readonly jitterTicks: number;
}

export interface WaveDef {
  readonly id: string;
  readonly groups: readonly WaveGroupDef[];
}

export interface GameData {
  readonly game: GameConfig;
  readonly roads: RoadsData;
  readonly units: { readonly version: number; readonly units: readonly UnitDef[] };
  readonly waves: { readonly version: number; readonly waves: readonly WaveDef[] };
}

/** Kennung des Datenstands; steht in jeder Wiederholung. */
export function dataVersion(data: GameData): string {
  return [data.game.version, data.roads.version, data.units.version, data.waves.version].join('.');
}

export function findById<T extends { readonly id: string }>(list: readonly T[], id: string, what: string): T {
  const hit = list.find((x) => x.id === id);
  if (!hit) throw new Error(`${what} unbekannt: ${id}`);
  return hit;
}
