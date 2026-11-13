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

export interface SlotDef {
  readonly id: string;
  /** Kachelkoordinaten. */
  readonly x: number;
  readonly y: number;
}

export interface RoadDef {
  readonly id: string;
  /** Kachelkoordinaten [Spalte, Zeile], aufeinanderfolgende Punkte achsenparallel. */
  readonly waypoints: readonly (readonly number[])[];
  readonly towerSlots: readonly SlotDef[];
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
  readonly bounty: number;
  readonly keepDamage: number;
}

export interface TowerLevelDef {
  /** Gold für den Bau (Stufe 1) bzw. den Ausbau auf diese Stufe. */
  readonly cost: number;
  readonly damage: number;
  readonly rangeMilli: number;
  readonly cooldownTicks: number;
}

export interface TowerDef {
  readonly id: string;
  readonly levels: readonly TowerLevelDef[];
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

export type HintDef =
  | { readonly type: 'buildTower'; readonly slot: string; readonly tower: string }
  | { readonly type: 'upgradeTower'; readonly slot: string }
  | { readonly type: 'releaseWave' };

export interface DefenseStepDef {
  readonly id: string;
  readonly wave: string;
  /** Die Welle läuft ohne Zutun des Spielers los. */
  readonly autoRelease: boolean;
  /** Solange kein Turm steht, hält die Welle an, sobald der vorderste Angreifer diese Wegstrecke erreicht (0 = aus). */
  readonly holdMilliUntilTower: number;
  /** Der Burgfried nimmt keinen Schaden, die Schlacht kann nicht verloren gehen. */
  readonly unlosable: boolean;
  readonly victoryGold: number;
  readonly hints: readonly HintDef[];
}

export interface TutorialData {
  readonly version: number;
  readonly start: { readonly gold: number; readonly roadId: string; readonly keepHp: number };
  readonly defenseSteps: readonly DefenseStepDef[];
  readonly afterTutorial: DefenseStepDef;
}

export interface GameData {
  readonly game: GameConfig;
  readonly roads: RoadsData;
  readonly units: { readonly version: number; readonly units: readonly UnitDef[] };
  readonly towers: { readonly version: number; readonly towers: readonly TowerDef[] };
  readonly waves: { readonly version: number; readonly waves: readonly WaveDef[] };
  readonly tutorial: TutorialData;
}

/** Kennung des Datenstands; steht in jeder Wiederholung. */
export function dataVersion(data: GameData): string {
  return [data.game, data.roads, data.units, data.towers, data.waves, data.tutorial].map((d) => d.version).join('.');
}

export function findById<T extends { readonly id: string }>(list: readonly T[], id: string, what: string): T {
  const hit = list.find((x) => x.id === id);
  if (!hit) throw new Error(`${what} unbekannt: ${id}`);
  return hit;
}
