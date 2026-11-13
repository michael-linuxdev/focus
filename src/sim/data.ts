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
  /** Gebäude, die vor dem Ausbau auf diese Stufe mindestens so weit ausgebaut sein müssen. */
  readonly requires: readonly { readonly building: string; readonly level: number }[];
}

export interface CityData {
  readonly version: number;
  /** `capacity`: Lagerplatz ohne Speicher; Erträge der Gebäude füllen die Vorräte nur bis zum Lagerplatz. */
  readonly start: { readonly resources: Resources; readonly keepHp: number; readonly capacity: Resources };
  readonly sections: readonly { readonly id: string }[];
  readonly towerSlots: readonly SlotDef[];
  readonly plots: readonly PlotDef[];
  readonly keepLevels: readonly KeepLevelDef[];
}

export interface BuildingLevelDef {
  /** Bau (Stufe 1) bzw. Ausbau auf diese Stufe. */
  readonly cost: Resources;
  readonly buildSeconds: number;
  readonly producePerHour: Resources;
  readonly protect: Resources;
  /** Zusätzlicher Lagerplatz je Vorrat. */
  readonly capacity: Resources;
  readonly healTimePermille: number;
  /** Nötige Burgfried-Stufe. */
  readonly keepLevel: number;
  /** Kaserne: größtes Heer (bereit, in Ausbildung und im Lazarett zusammen); sonst 0. */
  readonly armyCap: number;
  /** Kaserne: Faktor auf die Lebenspunkte der eigenen Truppen im Angriff; sonst 1000. */
  readonly troopHpPermille: number;
}

export interface BuildingDef {
  readonly id: string;
  /** Stufe n steht an Stelle n - 1. */
  readonly levels: readonly BuildingLevelDef[];
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
  /** Schaden an Miliz je Tick, solange die Einheit von ihr aufgehalten wird. */
  readonly melee: number;
  /** Faktor auf Treffer der Miliz (Rammböcke sind verwundbar). */
  readonly militiaDamagePermille: number;
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
  /** Pechnase: Tempo der Einheiten in Reichweite in Promille. */
  readonly slowPermille: number;
  /** Wachstube: Leben der Miliz und Ticks bis zum Nachrücken. */
  readonly militiaHp: number;
  readonly militiaRespawnTicks: number;
  /** Nötige Burgfried-Stufe für diese Stufe. */
  readonly keepLevel: number;
}

export interface TowerDef {
  readonly id: string;
  readonly kind: 'shot' | 'slow' | 'militia';
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
  /** Kampfruf in der Verteidigung: alle Türme schießen für die Dauer doppelt so schnell. */
  readonly rally: { readonly id: string; readonly durationTicks: number; readonly cooldownTicks: number };
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
  /** Tor der eigenen Stadt in verlierbaren Verteidigungen. */
  readonly cityGateHp: number;
  readonly newPlayerShieldHours: number;
  readonly defeatShieldHours: number;
  readonly nightRaidAfterHours: number;
  readonly nightRaidWave: string;
  /** Pfeilhagel des Verteidigers: Schaden an allen Angreifern im Umkreis um den angetippten Punkt. */
  readonly volley: { readonly damage: number; readonly radiusMilli: number; readonly cooldownTicks: number };
  /** Bonusgold je Sternezahl 0 bis 3 nach einer Verteidigung. */
  readonly starGold: readonly number[];
  /** Die eigene Stadt verliert erst ab dieser Durchbruchstiefe Vorräte. */
  readonly cityLossMinDepth: number;
  /** Eine vom Spieler gestartete Verteidigung kostet nur Vorräte, wenn der Burgfried fällt (Nachtangriffe weiter nach Tiefe). */
  readonly defenseLossOnlyWhenBreached: boolean;
  /** Nach einem Angriff wachsen die Vorräte eines Ziels über diese Zeit wieder auf den vollen Stand. */
  readonly campRegenHours: number;
  /** So lange nach einem Angriff auf eine Stadt kommt ihr Gegenangriff (frühestens, wenn kein Schild mehr schützt). */
  readonly revengeAfterHours: number;
  /** So viele erste Nachtangriffe kosten den Spieler nichts. */
  readonly freeNightRaids: number;
}

export interface CityTowerRef {
  readonly slot: string;
  readonly def: string;
  readonly level: number;
}

export interface CampDef {
  readonly id: string;
  readonly kind: 'camp' | 'city';
  /** Durch einen Schild geschützt: nicht angreifbar. */
  readonly shielded: boolean;
  /** Ab dieser Burgfried-Stufe des Spielers angreifbar. */
  readonly ring: number;
  readonly map: { readonly x: number; readonly y: number };
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

/** Regeln für die berechneten Wellen nach dem geführten Ablauf (siehe `src/sim/waves.ts`). */
export interface WaveScalingDef {
  /** So viele weitere Wellen gibt jede Burgfried-Stufe ab 2 frei; die letzte davon führt der Anführer an. */
  readonly wavesPerKeepLevel: number;
  /** Lebenspunkte-Budget von Welle 0 und sein Wachstum je Welle. */
  readonly budgetBase: number;
  readonly budgetGrowthPermille: number;
  /** Faktor auf die Lebenspunkte jedes Angreifers in Welle 0 und sein Wachstum je Welle. */
  readonly hpBasePermille: number;
  readonly hpGrowthPermille: number;
  /** Anteile am Budget; eine Einheit ist ab `fromWave` dabei. */
  readonly units: readonly { readonly unit: string; readonly fromWave: number; readonly sharePermille: number }[];
  readonly firstTick: number;
  readonly windowTicks: number;
  readonly burstTicks: number;
  readonly minIntervalTicks: number;
  readonly maxIntervalTicks: number;
  readonly jitterTicks: number;
  readonly boss: { readonly unit: string; readonly startTick: number; readonly extraParSeconds: number };
  readonly victoryGoldBase: number;
  readonly victoryGoldGrowthPermille: number;
  /** Anteil des Sieg- und Sternegolds für eine schon geschlagene Welle. */
  readonly repeatGoldPermille: number;
  readonly parSeconds: number;
  /** Nachtangriff: ab so vielen geschlagenen Wellen kommt statt der festen Nachtwelle die zuletzt geschlagene, mit dieser Stärke. */
  readonly raidFromWave: number;
  readonly raidStrengthPermille: number;
  /** Zähigkeit der Angreifer im Nachtangriff: Faktor in Welle 0 und Wachstum je Welle. */
  readonly raidHpBasePermille: number;
  readonly raidHpGrowthPermille: number;
}

export interface DefenseDef {
  readonly wave: string;
  /** Solange kein Turm steht, hält die Welle an, sobald der vorderste Angreifer diese Wegstrecke erreicht (0 = aus). */
  readonly holdMilliUntilTower: number;
  /** Der Burgfried nimmt keinen Schaden, die Schlacht kann nicht verloren gehen. */
  readonly unlosable: boolean;
  readonly victoryGold: number;
  /** Ohne Durchbruch in dieser Zeit gibt es den dritten Stern. */
  readonly parSeconds: number;
}

export type HintDef =
  | { readonly type: 'slot'; readonly slot: string; readonly tower: string }
  | { readonly type: 'plot'; readonly plot: string; readonly building: string }
  | { readonly type: 'keep' }
  | { readonly type: 'button'; readonly button: 'defend' | 'hero' | 'attack' | 'world' | 'alliance' | 'goals' };

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
  | { readonly type: 'worldSeen' }
  | { readonly type: 'allianceJoined' }
  | { readonly type: 'helpRequestedOrBuilt'; readonly building: string }
  | { readonly type: 'goalClaimed' }
  | { readonly type: 'raidAcknowledged' }
  | { readonly type: 'never' };

export interface TutorialStepDef {
  readonly id: string;
  readonly hint: HintDef | null;
  readonly done: ConditionDef;
  /** In diesem Schritt darf ein laufender Bau kostenlos fertiggestellt werden. */
  readonly freeSkip: boolean;
  /** Die Verteidigung beginnt in diesem Schritt von selbst. */
  readonly autoDefense: boolean;
  /** Mit diesem Schritt wird der Nachtangriff angekündigt. */
  readonly announcesRaid: boolean;
  /** Teile der Oberfläche, die ab diesem Schritt sichtbar sind. */
  readonly unlocks: readonly string[];
}

export interface TutorialData {
  readonly version: number;
  readonly defenses: readonly DefenseDef[];
  readonly afterDefenses: DefenseDef;
  readonly steps: readonly TutorialStepDef[];
  /** Schritt, dessen Erreichen in der Messung als "Minute 10 erreicht" zählt. */
  readonly minute10Step: string;
}

/** Simulierte Allianz aus Bots. PLATZHALTER: keine echten Spieler, kein Server. */
export interface AllianceData {
  readonly version: number;
  readonly id: string;
  readonly members: readonly string[];
  readonly joinReward: Resources;
  readonly helpIntervalSeconds: number;
  readonly helpReduceSeconds: number;
  readonly maxHelps: number;
}

export type GoalCounter = 'defenses' | 'attacks' | 'built' | 'trained' | 'stars' | 'towers';

export interface GoalDef {
  readonly id: string;
  readonly counter: GoalCounter;
  readonly count: number;
  readonly reward: Resources;
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
  readonly waves: { readonly version: number; readonly waves: readonly WaveDef[]; readonly scaling: WaveScalingDef };
  readonly tutorial: TutorialData;
  readonly alliance: AllianceData;
  readonly goals: {
    readonly version: number;
    /** Tagesziele: die ersten `dailyFixed` gelten jeden Tag, dazu `dailyRotating` aus dem Rest, reihum nach Tagesnummer. */
    readonly goals: readonly GoalDef[];
    readonly dailyFixed: number;
    readonly dailyRotating: number;
    /** Faktor auf alle Belohnungen (Ziele und Rückkehr) je Burgfried-Stufe; Stufe n an Stelle n - 1. */
    readonly rewardPermilleByKeepLevel: readonly number[];
    /** Ein Wochenziel je Woche, reihum nach Wochennummer. */
    readonly weekly: readonly GoalDef[];
    /** Belohnung für die Rückkehr: einmal je Tag, reihum. */
    readonly login: readonly Resources[];
  };
}

/** Kennung des Datenstands für Schlachten; steht in jeder Wiederholung. */
export function dataVersion(data: GameData): string {
  return [data.game, data.roads, data.city, data.units, data.towers, data.hero, data.rules, data.waves].map((d) => d.version).join('.');
}

export function findById<T extends { readonly id: string }>(list: readonly T[], id: string, what: string): T {
  const hit = list.find((x) => x.id === id);
  if (!hit) throw new Error(`${what} unbekannt: ${id}`);
  return hit;
}
