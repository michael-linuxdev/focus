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

export interface Resources {
  readonly gold: number;
  readonly wood: number;
  readonly stone: number;
}

export const RESOURCE_KEYS = ['gold', 'wood', 'stone'] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];

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

export interface SlotDef {
  readonly id: string;
  /** Kachelkoordinaten. */
  readonly x: number;
  readonly y: number;
  /** Ab dieser Burgfried-Stufe bebaubar. */
  readonly keepLevel: number;
  /** Mauerabschnitt, den ein Held kommandieren kann. */
  readonly section: string;
}

export interface PlotDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface KeepLevelDef {
  readonly level: number;
  readonly cost: Resources;
  readonly buildSeconds: number;
  /** Straßenverläufe, aus denen der Spieler auf dieser Stufe wählt. */
  readonly roads: readonly string[];
}

export interface CityData {
  readonly version: number;
  readonly start: { readonly resources: Resources; readonly keepHp: number };
  readonly sections: readonly { readonly id: string }[];
  readonly towerSlots: readonly SlotDef[];
  readonly plots: readonly PlotDef[];
  readonly keepLevels: readonly KeepLevelDef[];
}

export interface BuildingDef {
  readonly id: string;
  readonly cost: Resources;
  readonly buildSeconds: number;
  readonly producePerHour: Resources;
  readonly protect: Resources;
  readonly healTimePermille: number;
}

export interface UnitDef {
  readonly id: string;
  readonly hp: number;
  readonly speedMilliPerTick: number;
  readonly bounty: number;
  readonly keepDamage: number;
  /** Abzug je Treffer (mindestens 1 Schaden bleibt). */
  readonly armor: number;
  /** Schaden am Tor je Tick, solange die Einheit davor steht. */
  readonly siege: number;
}

export interface TroopDef {
  readonly unit: string;
  readonly cost: Resources;
  readonly trainSeconds: number;
  /** Stückzahl je Ausbildungsauftrag in der Oberfläche. */
  readonly batch: number;
  readonly healSeconds: number;
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
  readonly keepLevel: number;
  /** > 0: alle Einheiten in diesem Umkreis um das Ziel werden getroffen. */
  readonly splashMilli: number;
  readonly levels: readonly TowerLevelDef[];
}

export interface AbilityDef {
  readonly id: string;
  readonly kind: 'shield' | 'disableTower';
  readonly durationTicks: number;
  readonly cooldownTicks: number;
  readonly damageTakenPermille: number;
}

export interface HeroData {
  readonly version: number;
  readonly id: string;
  readonly joinsAtKeepLevel: number;
  readonly sectionBonusPermille: number;
  readonly retinue: readonly UnitCount[];
  readonly abilities: readonly AbilityDef[];
}

export interface UnitCount {
  readonly unit: string;
  readonly count: number;
}

export interface RulesData {
  readonly version: number;
  /** Wegstrecke, an der das Tor steht. */
  readonly gateMilli: number;
  /** Lage des Marktplatzes als Anteil der Straßenlänge. */
  readonly marketPermille: number;
  readonly attackMaxTicks: number;
  readonly attackSpawnIntervalTicks: number;
  readonly attackWaves: number;
  /** Verlustgrenze: höchster Anteil der ungeschützten Vorräte, der erbeutet werden kann. */
  readonly lootMaxPermille: number;
  /** Anteil der erbeutbaren Menge je Durchbruchstiefe 0 bis 3. */
  readonly depthLootPermille: readonly number[];
  readonly maxReplays: number;
  /** Gebäude schütten ihren Ertrag in diesem Takt aus. */
  readonly productionIntervalSeconds: number;
}

export interface CityTowerRef {
  readonly slot: string;
  readonly def: string;
  readonly level: number;
}

export interface CampDef {
  readonly id: string;
  readonly roadId: string;
  readonly keepLevel: number;
  readonly gateHp: number;
  readonly towers: readonly CityTowerRef[];
  readonly stock: Resources;
  readonly protected: Resources;
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

export interface DefenseDef {
  readonly wave: string;
  /** Solange kein Turm steht, hält die Welle an, sobald der vorderste Angreifer diese Wegstrecke erreicht (0 = aus). */
  readonly holdMilliUntilTower: number;
  /** Der Burgfried nimmt keinen Schaden, die Schlacht kann nicht verloren gehen. */
  readonly unlosable: boolean;
  readonly victoryGold: number;
}

export type HintDef =
  | { readonly type: 'slot'; readonly slot: string; readonly tower: string }
  | { readonly type: 'plot'; readonly plot: string; readonly building: string }
  | { readonly type: 'keep' }
  | { readonly type: 'button'; readonly button: 'defend' | 'hero' | 'attack' };

export type ConditionDef =
  | { readonly type: 'defensesWon'; readonly count: number }
  | { readonly type: 'towerCount'; readonly count: number }
  | { readonly type: 'towerLevel'; readonly level: number }
  | { readonly type: 'towerOfType'; readonly tower: string }
  | { readonly type: 'buildingStarted'; readonly building: string }
  | { readonly type: 'buildingDone'; readonly building: string }
  | { readonly type: 'keepLevel'; readonly level: number }
  | { readonly type: 'roadChosen' }
  | { readonly type: 'heroAssigned' }
  | { readonly type: 'troopsTrained'; readonly unit: string; readonly count: number }
  | { readonly type: 'attacksDone'; readonly count: number }
  | { readonly type: 'never' };

export interface TutorialStepDef {
  readonly id: string;
  readonly hint: HintDef | null;
  readonly done: ConditionDef;
  /** In diesem Schritt darf ein laufender Bau kostenlos fertiggestellt werden. */
  readonly freeSkip: boolean;
  /** Die Verteidigung beginnt in diesem Schritt von selbst. */
  readonly autoDefense: boolean;
  /** Teile der Oberfläche, die ab diesem Schritt sichtbar sind. */
  readonly unlocks: readonly string[];
}

export interface TutorialData {
  readonly version: number;
  readonly defenses: readonly DefenseDef[];
  readonly afterDefenses: DefenseDef;
  readonly steps: readonly TutorialStepDef[];
}

export interface GameData {
  readonly game: GameConfig;
  readonly roads: RoadsData;
  readonly city: CityData;
  readonly buildings: { readonly version: number; readonly buildings: readonly BuildingDef[] };
  readonly units: { readonly version: number; readonly units: readonly UnitDef[] };
  readonly troops: { readonly version: number; readonly troops: readonly TroopDef[] };
  readonly towers: { readonly version: number; readonly towers: readonly TowerDef[] };
  readonly hero: HeroData;
  readonly rules: RulesData;
  readonly camps: { readonly version: number; readonly camps: readonly CampDef[] };
  readonly waves: { readonly version: number; readonly waves: readonly WaveDef[] };
  readonly tutorial: TutorialData;
}

/** Kennung des Datenstands für Schlachten; steht in jeder Wiederholung. */
export function dataVersion(data: GameData): string {
  return [data.game, data.roads, data.city, data.units, data.towers, data.hero, data.rules].map((d) => d.version).join('.');
}

export function findById<T extends { readonly id: string }>(list: readonly T[], id: string, what: string): T {
  const hit = list.find((x) => x.id === id);
  if (!hit) throw new Error(`${what} unbekannt: ${id}`);
  return hit;
}
