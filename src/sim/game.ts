import {
  RESOURCE_KEYS, findById,
  type BuildingLevelDef, type ConditionDef, type DefenseDef, type GameData, type GoalCounter, type GoalDef, type Resources, type TutorialStepDef, type UnitCount,
} from './data.ts';
import { mulDiv, PERMILLE } from './fixed.ts';
import { towerActionCost, type BattleInput, type BattleSetup, type BattleState, type CityTower } from './battle/battle.ts';
import { computeLoot } from './loot.ts';
import { makeReplay, runBattle, type Replay } from './replay.ts';
import { fixedDefense, scaledDefense, scaledWave, wavesUnlocked, type PlannedDefense } from './waves.ts';

/**
 * Dauerhafter Spielzustand und seine Aktionen, Stand M4.
 * Jede Spielerhandlung ist eine benannte Aktion: erst `validateGameAction`, dann `reduceGame`.
 * Die Uhrzeit kommt ausschließlich über `AdvanceTime` herein; dabei werden fällige Bauzeiten,
 * Erträge, Ausbildung und Lazarett abgerechnet (`settle`).
 *
 * Schlachten werden nicht "gemeldet", sondern nachgerechnet: `ResolveDefense` und `ResolveAttack`
 * bekommen nur die Eingaben des Spielers; Startzustand und Startwert stammen aus dem Spielzustand.
 */
export const STATE_VERSION = 9;

export interface Building {
  readonly plot: string;
  readonly def: string;
  /** Ausbaustufe, ab 1. */
  readonly level: number;
  /** Fertig ab diesem Zeitpunkt (ms); nach einem Ausbau der Zeitpunkt, seit dem die neue Stufe gilt. */
  readonly doneAt: number;
  /** Ein Ausbau auf die nächste Stufe läuft bis zu diesem Zeitpunkt; das Gebäude arbeitet solange auf der alten Stufe weiter. */
  readonly upgradeDoneAt: number | null;
  /** Bis hierhin ist der Ertrag ausgeschüttet (ms). */
  readonly producedUntil: number;
  /** Zeitpunkt der Bitte um Allianzhilfe für diesen Bau (ms), sonst `null`. */
  readonly helpRequestedAt: number | null;
  /** Schon angerechnete Hilfen. */
  readonly helpsReceived: number;
}

export interface TroopBatch {
  readonly unit: string;
  readonly count: number;
  readonly doneAt: number;
}

export interface Army {
  /** Einsatzbereite Truppen je Einheitentyp. Gelesen wird immer in der Reihenfolge von `data.troops`. */
  readonly ready: Readonly<Record<string, number>>;
  readonly training: TroopBatch | null;
  /** Besiegte Truppen: nicht verloren, sondern bis `doneAt` im Lazarett. */
  readonly hospital: readonly TroopBatch[];
}

export interface SavedReplay {
  readonly id: number;
  readonly kind: 'defense' | 'attack' | 'raid';
  readonly at: number;
  readonly result: 'held' | 'breached';
  /** Sterne einer Verteidigung (0 bis 3); bei Angriffen 0. */
  readonly stars: number;
  readonly depth: number;
  /** Beute des Angreifers: beim Angriff Gewinn des Spielers, bei Verteidigung und Nachtangriff sein Verlust. */
  readonly loot: Resources;
  /** Abschnitt, in dem die wenigsten Angreifer fielen (nur wenn die Stadt verteidigt wurde). */
  readonly weakSection: string | null;
  readonly replay: Replay;
}

export interface AttackOutcome {
  readonly camp: string;
  readonly depth: number;
  readonly loot: Resources;
  readonly fallen: readonly UnitCount[];
}

export interface DailyGoals {
  /** Tag seit Epoche, für den die Zähler gelten. */
  readonly day: number;
  readonly counters: Readonly<Record<GoalCounter, number>>;
  readonly claimed: readonly string[];
}

export interface WeeklyGoal {
  /** Woche seit Epoche (Tag / 7), für die die Zähler gelten. */
  readonly week: number;
  readonly counters: Readonly<Record<GoalCounter, number>>;
  readonly claimed: boolean;
}

export interface LoginReward {
  /** Tag der letzten abgeholten Belohnung, -1 wenn noch keine. */
  readonly day: number;
  /** Zahl der bisher abgeholten Belohnungen. */
  readonly claims: number;
}

export interface GameState {
  readonly version: number;
  /** Zuletzt hineingereichte Zeit in ms seit Epoche. */
  readonly now: number;
  /** Startwert der nächsten Schlacht. */
  readonly nextSeed: number;
  readonly resources: Resources;
  readonly towers: readonly CityTower[];
  readonly buildings: readonly Building[];
  readonly keepLevel: number;
  /** Ausbau des Burgfrieds läuft bis zu diesem Zeitpunkt. */
  readonly keepDoneAt: number | null;
  readonly roadId: string;
  /** Der Burgfried ist ausgebaut, der neue Straßenverlauf aber noch nicht gewählt. */
  readonly roadChoicePending: boolean;
  readonly hero: { readonly joined: boolean; readonly section: string | null };
  readonly army: Army;
  readonly defensesWon: number;
  /** Geschlagene berechnete Wellen nach dem geführten Ablauf; die nächste hat diese Nummer. */
  readonly wavesCleared: number;
  readonly attacksDone: number;
  /** Index in `data.tutorial.steps`. */
  readonly tutorialStep: number;
  readonly replays: readonly SavedReplay[];
  readonly nextReplayId: number;
  readonly lastAttack: AttackOutcome | null;
  /** Bis zu diesem Zeitpunkt schützt ein Schild vor Nachbarstädten (nicht vor Räubern). */
  readonly shieldUntil: number;
  readonly worldSeen: boolean;
  /** PLATZHALTER: Mitgliedschaft in der simulierten Bot-Allianz. */
  readonly allianceJoined: boolean;
  readonly daily: DailyGoals;
  readonly weekly: WeeklyGoal;
  readonly login: LoginReward;
  readonly goalsClaimed: number;
  /** Angekündigter Nachtangriff: frühester Zeitpunkt, zu dem er bei der Rückkehr berechnet wird. */
  readonly raidDueAt: number | null;
  readonly raidAcknowledged: boolean;
  /** Kennung der Wiederholung eines Nachtangriffs, den der Spieler noch nicht gesehen hat. */
  readonly raidReport: number | null;
  /** Zahl der bisher berechneten Nachtangriffe. */
  readonly raidsResolved: number;
}

export type Lineup = readonly (readonly UnitCount[])[];

export type GameAction =
  | { readonly type: 'AdvanceTime'; readonly now: number }
  | { readonly type: 'ResolveDefense'; readonly inputs: readonly BattleInput[] }
  | { readonly type: 'BuildTower'; readonly slot: string; readonly tower: string }
  | { readonly type: 'UpgradeTower'; readonly slot: string }
  | { readonly type: 'BuildBuilding'; readonly plot: string; readonly building: string }
  | { readonly type: 'UpgradeBuilding'; readonly plot: string }
  | { readonly type: 'SkipTimerFree'; readonly plot: string }
  | { readonly type: 'UpgradeKeep' }
  | { readonly type: 'ChooseRoad'; readonly road: string }
  | { readonly type: 'AssignHero'; readonly section: string }
  | { readonly type: 'TrainTroops'; readonly unit: string; readonly count: number }
  | { readonly type: 'OpenWorldMap' }
  | { readonly type: 'JoinAlliance' }
  | { readonly type: 'RequestHelp'; readonly plot: string }
  | { readonly type: 'ClaimDailyGoal'; readonly goal: string }
  | { readonly type: 'ClaimWeeklyGoal' }
  | { readonly type: 'ClaimLoginReward' }
  | { readonly type: 'AcknowledgeRaid' }
  | { readonly type: 'ResolveNightRaid' }
  | { readonly type: 'DismissRaidReport' }
  | { readonly type: 'ResolveAttack'; readonly camp: string; readonly lineup: Lineup; readonly inputs: readonly BattleInput[] };

export type GameActionError =
  | 'time_runs_backwards' | 'invalid_payload' | 'battle_not_finished'
  | 'unknown_slot' | 'unknown_tower' | 'slot_occupied' | 'slot_empty' | 'slot_locked' | 'tower_locked' | 'max_level' | 'level_locked'
  | 'not_enough_resources'
  | 'unknown_plot' | 'unknown_building' | 'plot_occupied' | 'already_built' | 'nothing_to_skip' | 'skip_not_free'
  | 'plot_empty' | 'building_busy' | 'requirement_missing'
  | 'keep_max_level' | 'keep_busy' | 'road_choice_pending' | 'no_road_choice' | 'unknown_road'
  | 'no_hero' | 'unknown_section'
  | 'no_barracks' | 'unknown_troop' | 'training_busy'
  | 'unknown_camp' | 'target_shielded' | 'invalid_lineup' | 'not_enough_troops'
  | 'already_joined' | 'no_alliance' | 'nothing_to_help' | 'help_already_requested'
  | 'unknown_goal' | 'goal_not_reached' | 'goal_already_claimed' | 'goal_not_active' | 'login_already_claimed'
  | 'no_raid_announced' | 'raid_not_due' | 'nothing_to_dismiss';

const NO_RESOURCES: Resources = { gold: 0, wood: 0, stone: 0 };
const NO_COUNTERS: Readonly<Record<GoalCounter, number>> = { defenses: 0, attacks: 0, built: 0, trained: 0, stars: 0, towers: 0 };
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export function createGame(seed: number, now: number, data: GameData): GameState {
  const firstRoad = data.city.keepLevels[0]?.roads[0];
  if (firstRoad === undefined) throw new Error('Stadt ohne Straße');
  return {
    version: STATE_VERSION,
    now,
    nextSeed: seed >>> 0,
    resources: data.city.start.resources,
    towers: [],
    buildings: [],
    keepLevel: 1,
    keepDoneAt: null,
    roadId: firstRoad,
    roadChoicePending: false,
    hero: { joined: false, section: null },
    army: { ready: {}, training: null, hospital: [] },
    defensesWon: 0,
    wavesCleared: 0,
    attacksDone: 0,
    tutorialStep: 0,
    replays: [],
    nextReplayId: 1,
    lastAttack: null,
    shieldUntil: now + data.rules.newPlayerShieldHours * HOUR_MS,
    worldSeen: false,
    allianceJoined: false,
    daily: { day: Math.floor(now / DAY_MS), counters: NO_COUNTERS, claimed: [] },
    weekly: { week: Math.floor(now / DAY_MS / 7), counters: NO_COUNTERS, claimed: false },
    login: { day: -1, claims: 0 },
    goalsClaimed: 0,
    raidDueAt: null,
    raidAcknowledged: false,
    raidReport: null,
    raidsResolved: 0,
  };
}

// ---------- Abfragen ----------

export function canAfford(have: Resources, cost: Resources): boolean {
  return RESOURCE_KEYS.every((k) => have[k] >= cost[k]);
}

function addResources(a: Resources, b: Resources, sign: 1 | -1 = 1): Resources {
  return { gold: a.gold + sign * b.gold, wood: a.wood + sign * b.wood, stone: a.stone + sign * b.stone };
}

function scaleResources(a: Resources, n: number): Resources {
  return { gold: a.gold * n, wood: a.wood * n, stone: a.stone * n };
}

/** Werte der aktuellen Stufe eines Gebäudes. */
export function buildingLevel(b: Pick<Building, 'def' | 'level'>, data: GameData): BuildingLevelDef {
  const def = findById(data.buildings.buildings, b.def, 'Gebäude');
  const level = def.levels[Math.min(b.level, def.levels.length) - 1];
  if (!level) throw new Error(`Gebäude ohne Stufe: ${b.def}`);
  return level;
}

/** Ende des laufenden Baus oder Ausbaus, sonst `null`. */
export function buildingBusyUntil(b: Building, now: number): number | null {
  return b.doneAt > now ? b.doneAt : b.upgradeDoneAt;
}

/** Fertige Gebäude mit den Werten ihrer Stufe, in der Reihenfolge des Zustands. */
function finishedBuildings(state: GameState, data: GameData): BuildingLevelDef[] {
  return state.buildings.filter((b) => b.doneAt <= state.now).map((b) => buildingLevel(b, data));
}

/** Lagerplatz je Vorrat: Grundwert der Stadt plus alle fertigen Gebäude. Erträge füllen nur bis hierhin. */
export function storageCapacity(state: GameState, data: GameData): Resources {
  return finishedBuildings(state, data).reduce((sum, b) => addResources(sum, b.capacity), data.city.start.capacity);
}

/** Was dem Ausbau des Burgfrieds auf die nächste Stufe noch fehlt (Gebäude und Stufe), sonst `null`. */
export function keepRequirement(state: GameState, data: GameData): { readonly building: string; readonly level: number } | null {
  const next = data.city.keepLevels.find((l) => l.level === state.keepLevel + 1);
  return next?.requires.find((r) => !state.buildings.some((b) => b.def === r.building && b.doneAt <= state.now && b.level >= r.level)) ?? null;
}

export function hasBuilding(state: GameState, building: string): boolean {
  return state.buildings.some((b) => b.def === building && b.doneAt <= state.now);
}

/** Geschützter Grundstock: die Summe aller fertigen Speicher. */
export function protectedStock(state: GameState, data: GameData): Resources {
  return finishedBuildings(state, data).reduce((sum, b) => addResources(sum, b.protect), NO_RESOURCES);
}

export function readyTroops(state: GameState, unit: string): number {
  return state.army.ready[unit] ?? 0;
}

export function tutorialStep(state: GameState, data: GameData): TutorialStepDef {
  const step = data.tutorial.steps[Math.min(state.tutorialStep, data.tutorial.steps.length - 1)];
  if (!step) throw new Error('Tutorial ohne Schritte');
  return step;
}

/** Ob ein Teil der Oberfläche freigeschaltet ist (alle Schritte bis zum aktuellen zählen). */
export function unlocked(state: GameState, feature: string, data: GameData): boolean {
  return data.tutorial.steps.some((s, i) => i <= state.tutorialStep && s.unlocks.includes(feature));
}

/**
 * Die Verteidigung, die als Nächstes ansteht: erst die Wellen des geführten Ablaufs, dann die berechneten.
 * Sind alle Wellen der Burgfried-Stufe geschlagen, kommt die letzte gewöhnliche noch einmal (weniger Gold,
 * kein Fortschritt), bis der Burgfried wächst. Auf Stufe 1 ist das die Übungswelle `afterDefenses`.
 */
export function defenseDef(state: GameState, data: GameData): PlannedDefense {
  const guided = data.tutorial.defenses[state.defensesWon];
  if (guided) return fixedDefense(guided, false, data);
  const unlockedWaves = wavesUnlocked(state.keepLevel, data);
  if (state.wavesCleared < unlockedWaves) return scaledDefense(state.wavesCleared, false, data);
  if (unlockedWaves < 2) return fixedDefense(data.tutorial.afterDefenses, true, data);
  return scaledDefense(unlockedWaves - 2, true, data);
}

/** Nummer der anstehenden Welle für die Anzeige (ab 1, über Ablauf und berechnete Wellen hinweg). */
export function waveNumber(state: GameState, data: GameData): number {
  return Math.min(state.defensesWon, data.tutorial.defenses.length) + state.wavesCleared + 1;
}

function cityDefense(state: GameState, def: PlannedDefense, data: GameData): BattleSetup {
  return {
    playerSide: 'defender',
    roadId: state.roadId,
    keepLevel: state.keepLevel,
    towers: state.towers,
    gold: state.resources.gold,
    keepHp: data.city.start.keepHp,
    unlosable: def.unlosable,
    holdMilliUntilTower: def.holdMilliUntilTower,
    heroSection: state.hero.section,
    // Unverlierbare Tutorial-Wellen laufen ohne Tor, damit sie sofort an den Türmen ankommen.
    gateHp: def.unlosable ? 0 : data.rules.cityGateHp,
    waves: [{ groups: def.groups }],
    autoRelease: true,
    abilities: [],
    volley: true,
    rally: state.hero.joined,
    // Nur gesetzt, wenn die Welle zäher ist: Setups des geführten Ablaufs bleiben unverändert.
    ...(def.hpPermille === PERMILLE ? {} : { unitHpPermille: def.hpPermille }),
    maxTicks: 0,
  };
}

/**
 * Sterne einer Verteidigung: 1 gehalten, 2 ohne Durchbruch, 3 ohne Durchbruch in der Richtzeit.
 * Verloren gibt es keinen Stern.
 */
export function defenseStars(final: BattleState, def: DefenseDef, data: GameData): number {
  if (final.result !== 'held') return 0;
  if (final.leaked > 0) return 1;
  return final.tick <= def.parSeconds * data.game.ticksPerSecond ? 3 : 2;
}

/** Bonusgold für die Sterne; für eine schon geschlagene Welle nur anteilig. */
export function starGold(stars: number, def: PlannedDefense, data: GameData): number {
  const gold = data.rules.starGold[stars] ?? 0;
  return def.repeat ? mulDiv(gold, data.waves.scaling.repeatGoldPermille, PERMILLE) : gold;
}

/** Startzustand der nächsten Verteidigung, vollständig aus Spielzustand und Daten abgeleitet. */
export function defenseSetup(state: GameState, data: GameData): BattleSetup {
  return cityDefense(state, defenseDef(state, data), data);
}

/** Startzustand des Nachtangriffs: die Stadt verteidigt sich ohne Eingaben des Spielers. */
export function raidSetup(state: GameState, data: GameData): BattleSetup {
  const base = { wave: data.rules.nightRaidWave, holdMilliUntilTower: 0, unlosable: false, victoryGold: 0, parSeconds: 0 };
  const sc = data.waves.scaling;
  // Anfangs die feste Nachtwelle; später wächst der Nachtangriff mit: die zuletzt geschlagene Welle, etwas schwächer.
  if (state.wavesCleared < sc.raidFromWave) return cityDefense(state, fixedDefense(base, false, data), data);
  const wave = scaledWave(state.wavesCleared - 1, data, true);
  return cityDefense(state, { ...base, wave: `nacht_${state.wavesCleared}`, groups: wave.groups, hpPermille: wave.hpPermille, index: null, boss: false, repeat: false }, data);
}

/**
 * Der schwache Abschnitt einer Verteidigung: dort fielen die wenigsten Angreifer.
 * Gezählt werden nur Abschnitte mit bebaubaren Plätzen; bei Gleichstand gilt die Reihenfolge der Daten.
 */
export function weakSection(final: BattleState, data: GameData): string | null {
  let weakest: string | null = null;
  let fewest = -1;
  for (const section of data.city.sections) {
    const slots = data.city.towerSlots.filter((sl) => sl.section === section.id && sl.keepLevel <= final.setup.keepLevel);
    if (slots.length === 0) continue;
    const kills = final.towers.filter((t) => slots.some((sl) => sl.id === t.slot)).reduce((n, t) => n + t.kills, 0);
    if (fewest < 0 || kills < fewest) {
      weakest = section.id;
      fewest = kills;
    }
  }
  return weakest;
}

function lineupError(state: GameState, lineup: Lineup, data: GameData): GameActionError | null {
  if (lineup.length !== data.rules.attackWaves) return 'invalid_lineup';
  let total = 0;
  for (const troop of data.troops.troops) {
    let sum = 0;
    for (const wave of lineup) {
      for (const entry of wave) {
        if (!Number.isInteger(entry.count) || entry.count < 0) return 'invalid_lineup';
        if (!data.troops.troops.some((t) => t.unit === entry.unit)) return 'invalid_lineup';
        if (entry.unit === troop.unit) sum += entry.count;
      }
    }
    if (sum > readyTroops(state, troop.unit)) return 'not_enough_troops';
    total += sum;
  }
  return total > 0 ? null : 'invalid_lineup';
}

/** Startzustand eines Angriffs auf ein Lager. Die Aufstellung muss gültig sein (`validateGameAction`). */
export function attackSetup(state: GameState, campId: string, lineup: Lineup, data: GameData): BattleSetup {
  const camp = findById(data.camps.camps, campId, 'Lager');
  return {
    playerSide: 'attacker',
    roadId: camp.roadId,
    keepLevel: camp.keepLevel,
    towers: camp.towers,
    gold: 0,
    keepHp: 1,
    unlosable: false,
    holdMilliUntilTower: 0,
    heroSection: null,
    gateHp: camp.gateHp,
    waves: lineup.map((wave) => ({
      groups: wave.filter((e) => e.count > 0).map((e) => ({ unit: e.unit, count: e.count, startTick: 0, intervalTicks: data.rules.attackSpawnIntervalTicks, jitterTicks: 0 })),
    })),
    autoRelease: false,
    abilities: state.hero.joined ? data.hero.abilities.map((a) => a.id) : [],
    maxTicks: data.rules.attackMaxTicks,
  };
}

function conditionMet(state: GameState, cond: ConditionDef): boolean {
  switch (cond.type) {
    case 'defensesWon': return state.defensesWon >= cond.count;
    case 'towerCount': return state.towers.length >= cond.count;
    case 'towerLevel': return state.towers.some((t) => t.level >= cond.level);
    case 'towerOfType': return state.towers.some((t) => t.def === cond.tower);
    case 'buildingStarted': return state.buildings.some((b) => b.def === cond.building);
    case 'buildingDone': return hasBuilding(state, cond.building);
    case 'keepLevel': return state.keepLevel >= cond.level;
    case 'roadChosen': return !state.roadChoicePending;
    case 'heroAssigned': return state.hero.section !== null;
    case 'troopsTrained': return readyTroops(state, cond.unit) >= cond.count;
    case 'attacksDone': return state.attacksDone >= cond.count;
    case 'worldSeen': return state.worldSeen;
    case 'allianceJoined': return state.allianceJoined;
    case 'helpRequestedOrBuilt': return state.buildings.some((b) => b.def === cond.building && (b.helpRequestedAt !== null || b.doneAt <= state.now));
    case 'goalClaimed': return state.goalsClaimed > 0;
    case 'raidAcknowledged': return state.raidAcknowledged;
    case 'never': return false;
  }
}

// ---------- Zeit ----------

/** Rechnet alles ab, was bis `state.now` fällig ist. Unabhängig davon, wie oft es aufgerufen wird. */
function settle(state: GameState, data: GameData): GameState {
  let s = state;

  // Burgfried-Ausbau: neue Stufe, Straßenwahl steht an, die Heldin schließt sich an.
  if (s.keepDoneAt !== null && s.keepDoneAt <= s.now) {
    s = { ...s, keepLevel: s.keepLevel + 1, keepDoneAt: null, roadChoicePending: true };
  }
  if (!s.hero.joined && s.keepLevel >= data.hero.joinsAtKeepLevel) {
    const ready = { ...s.army.ready };
    for (const r of data.hero.retinue) ready[r.unit] = (ready[r.unit] ?? 0) + r.count;
    s = { ...s, hero: { joined: true, section: null }, army: { ...s.army, ready } };
  }

  // PLATZHALTER Bot-Allianz: Nach einer Bitte hilft alle `helpIntervalSeconds` ein Mitglied und verkürzt den Bau.
  // Jede Hilfe wirkt zu ihrem eigenen Zeitpunkt, damit das Ergebnis nicht davon abhängt, wie oft abgerechnet wird.
  const al = data.alliance;
  s = {
    ...s,
    buildings: s.buildings.map((b) => {
      if (b.helpRequestedAt === null || b.helpsReceived >= al.maxHelps) return b;
      // Die Hilfe gilt dem laufenden Auftrag: dem Ausbau, sonst dem Bau.
      const upgrading = b.upgradeDoneAt !== null;
      let doneAt = b.upgradeDoneAt ?? b.doneAt;
      let helps = b.helpsReceived;
      while (helps < al.maxHelps) {
        const at = b.helpRequestedAt + (helps + 1) * al.helpIntervalSeconds * 1000;
        if (at > s.now || at >= doneAt) break;
        doneAt = Math.max(at, doneAt - al.helpReduceSeconds * 1000);
        helps++;
      }
      if (helps === b.helpsReceived) return b;
      return upgrading ? { ...b, upgradeDoneAt: doneAt, helpsReceived: helps } : { ...b, doneAt, producedUntil: doneAt, helpsReceived: helps };
    }),
  };

  // Tagesziele: neuer Tag, neue Zähler.
  const day = Math.floor(s.now / DAY_MS);
  if (day !== s.daily.day) s = { ...s, daily: { day, counters: NO_COUNTERS, claimed: [] } };
  const week = Math.floor(day / 7);
  if (week !== s.weekly.week) s = { ...s, weekly: { week, counters: NO_COUNTERS, claimed: false } };

  // Erträge: je Gebäude in ganzen Takten seit Fertigstellung, damit kein Rest verloren geht.
  // Sie füllen die Vorräte nur bis zum Lagerplatz; Beute und Belohnungen dürfen darüber liegen.
  const intervalMs = data.rules.productionIntervalSeconds * 1000;
  let resources = s.resources;
  const produce = (b: Building, until: number, cap: Resources): Building => {
    const level = buildingLevel(b, data);
    const before = Math.floor((b.producedUntil - b.doneAt) / intervalMs);
    const after = Math.floor((until - b.doneAt) / intervalMs);
    if (after <= before) return b;
    const next = { ...resources };
    for (const k of RESOURCE_KEYS) {
      const perInterval = level.producePerHour[k] * data.rules.productionIntervalSeconds;
      const gain = mulDiv(after, perInterval, 3600) - mulDiv(before, perInterval, 3600);
      next[k] += Math.max(0, Math.min(gain, cap[k] - next[k]));
    }
    resources = next;
    return { ...b, producedUntil: b.doneAt + after * intervalMs };
  };
  // Fertige Ausbauten: bis zu ihrem Zeitpunkt gilt die alte Stufe (und der alte Lagerplatz), danach die neue.
  const capBefore = storageCapacity(s, data);
  const upgraded = s.buildings.map((b) => {
    if (b.upgradeDoneAt === null || b.upgradeDoneAt > s.now) return b;
    const at = b.upgradeDoneAt;
    return { ...produce(b, at, capBefore), level: b.level + 1, doneAt: at, producedUntil: at, upgradeDoneAt: null, helpRequestedAt: null, helpsReceived: 0 };
  });
  s = { ...s, buildings: upgraded };
  const cap = storageCapacity(s, data);
  const buildings = s.buildings.map((b) => (b.doneAt > s.now ? b : produce(b, s.now, cap)));
  s = { ...s, resources, buildings };

  // Ausbildung und Lazarett
  let ready = s.army.ready;
  let training = s.army.training;
  if (training && training.doneAt <= s.now) {
    ready = { ...ready, [training.unit]: (ready[training.unit] ?? 0) + training.count };
    training = null;
  }
  const hospital: TroopBatch[] = [];
  for (const batch of s.army.hospital) {
    if (batch.doneAt <= s.now) ready = { ...ready, [batch.unit]: (ready[batch.unit] ?? 0) + batch.count };
    else hospital.push(batch);
  }
  if (ready !== s.army.ready || training !== s.army.training) s = { ...s, army: { ready, training, hospital } };

  return s;
}

function advanceTutorial(state: GameState, data: GameData): GameState {
  let s = state;
  while (s.tutorialStep < data.tutorial.steps.length - 1 && conditionMet(s, data.tutorial.steps[s.tutorialStep]!.done)) {
    s = { ...s, tutorialStep: s.tutorialStep + 1 };
    // Mit der Ankündigung wird der Nachtangriff scharf.
    if (data.tutorial.steps[s.tutorialStep]!.announcesRaid && s.raidDueAt === null) {
      s = { ...s, raidDueAt: s.now + data.rules.nightRaidAfterHours * HOUR_MS };
    }
  }
  return s;
}

/** Zählt für Tages- und Wochenziel. */
function count(state: GameState, counter: GoalCounter, n: number): GameState {
  return {
    ...state,
    daily: { ...state.daily, counters: { ...state.daily.counters, [counter]: state.daily.counters[counter] + n } },
    weekly: { ...state.weekly, counters: { ...state.weekly.counters, [counter]: state.weekly.counters[counter] + n } },
  };
}

/** Die Tagesziele von heute: die festen, dazu die wechselnden nach Tagesnummer. */
export function activeGoals(state: GameState, data: GameData): GoalDef[] {
  const g = data.goals;
  const fixed = g.goals.slice(0, g.dailyFixed);
  const rest = g.goals.slice(g.dailyFixed);
  const rotating = Array.from({ length: Math.min(g.dailyRotating, rest.length) }, (_, k) => rest[(state.daily.day + k) % rest.length]!);
  return [...fixed, ...rotating];
}

/** Das Wochenziel dieser Woche. */
export function weeklyGoal(state: GameState, data: GameData): GoalDef {
  const list = data.goals.weekly;
  return list[state.weekly.week % list.length]!;
}

/** Eine Belohnung, hochgerechnet auf die Burgfried-Stufe (spätere Kosten sind um Größenordnungen höher). */
export function scaledReward(base: Resources, state: GameState, data: GameData): Resources {
  const table = data.goals.rewardPermilleByKeepLevel;
  const permille = table[Math.min(state.keepLevel, table.length) - 1] ?? PERMILLE;
  return { gold: mulDiv(base.gold, permille, PERMILLE), wood: mulDiv(base.wood, permille, PERMILLE), stone: mulDiv(base.stone, permille, PERMILLE) };
}

/** Die Belohnung für die Rückkehr, die heute abgeholt werden kann, sonst `null`. */
export function loginReward(state: GameState, data: GameData): Resources | null {
  if (state.login.day === state.daily.day) return null;
  return scaledReward(data.goals.login[state.login.claims % data.goals.login.length]!, state, data);
}

/** Verlust der Stadt nach einer Verteidigung: Beute der Angreifer innerhalb der Verlustgrenze, Schild nach einer Niederlage. */
function cityLoss(state: GameState, final: BattleState, data: GameData, free = false, raid = false): { resources: Resources; loot: Resources; shieldUntil: number } {
  // Vorräte nach der Schlacht (Gold kann sich durch Kopfgeld und Turmbau geändert haben).
  const stock: Resources = { ...state.resources, gold: final.gold };
  // Kein Verlust bei unverlierbaren Wellen, bei kostenlosen Nachtangriffen und solange die Angreifer nicht tief genug kamen.
  // Wer selbst verteidigt und den Burgfried hält, verliert nichts, auch wenn einzelne Angreifer durchkommen.
  const heldOwnDefense = !raid && data.rules.defenseLossOnlyWhenBreached && final.result !== 'breached';
  const spared = final.setup.unlosable || free || heldOwnDefense || final.depth < data.rules.cityLossMinDepth;
  const loot = spared ? NO_RESOURCES : computeLoot(stock, protectedStock(state, data), final.depth, data.rules);
  const shieldUntil = final.result === 'breached' ? Math.max(state.shieldUntil, state.now + data.rules.defeatShieldHours * HOUR_MS) : state.shieldUntil;
  return { resources: addResources(stock, loot, -1), loot, shieldUntil };
}

// ---------- Aktionen ----------

function validInputs(inputs: readonly BattleInput[]): boolean {
  let last = 0;
  for (const i of inputs) {
    if (!Number.isInteger(i.tick) || i.tick < last) return false;
    last = i.tick;
  }
  return true;
}

export function validateGameAction(state: GameState, action: GameAction, data: GameData): GameActionError | null {
  switch (action.type) {
    case 'AdvanceTime':
      if (!Number.isSafeInteger(action.now)) return 'invalid_payload';
      return action.now < state.now ? 'time_runs_backwards' : null;
    case 'ResolveDefense':
      return validInputs(action.inputs) ? null : 'invalid_payload';
    case 'BuildTower':
    case 'UpgradeTower': {
      const cost = towerActionCost(state.towers, state.keepLevel, action, data);
      if (typeof cost !== 'number') return cost;
      return cost > state.resources.gold ? 'not_enough_resources' : null;
    }
    case 'BuildBuilding': {
      if (!data.city.plots.some((p) => p.id === action.plot)) return 'unknown_plot';
      const def = data.buildings.buildings.find((b) => b.id === action.building);
      if (!def) return 'unknown_building';
      if (state.buildings.some((b) => b.plot === action.plot)) return 'plot_occupied';
      if (state.buildings.some((b) => b.def === action.building)) return 'already_built';
      return canAfford(state.resources, def.levels[0]!.cost) ? null : 'not_enough_resources';
    }
    case 'UpgradeBuilding': {
      if (!data.city.plots.some((p) => p.id === action.plot)) return 'unknown_plot';
      const building = state.buildings.find((b) => b.plot === action.plot);
      if (!building) return 'plot_empty';
      if (buildingBusyUntil(building, state.now) !== null) return 'building_busy';
      const next = findById(data.buildings.buildings, building.def, 'Gebäude').levels[building.level];
      if (!next) return 'max_level';
      if (next.keepLevel > state.keepLevel) return 'level_locked';
      return canAfford(state.resources, next.cost) ? null : 'not_enough_resources';
    }
    case 'SkipTimerFree': {
      const building = state.buildings.find((b) => b.plot === action.plot);
      if (!building || buildingBusyUntil(building, state.now) === null) return 'nothing_to_skip';
      return tutorialStep(state, data).freeSkip ? null : 'skip_not_free';
    }
    case 'UpgradeKeep': {
      const next = data.city.keepLevels.find((l) => l.level === state.keepLevel + 1);
      if (!next) return 'keep_max_level';
      if (state.keepDoneAt !== null) return 'keep_busy';
      if (state.roadChoicePending) return 'road_choice_pending';
      if (keepRequirement(state, data) !== null) return 'requirement_missing';
      return canAfford(state.resources, next.cost) ? null : 'not_enough_resources';
    }
    case 'ChooseRoad': {
      if (!state.roadChoicePending) return 'no_road_choice';
      const level = data.city.keepLevels.find((l) => l.level === state.keepLevel);
      return level?.roads.includes(action.road) ? null : 'unknown_road';
    }
    case 'AssignHero':
      if (!state.hero.joined) return 'no_hero';
      return data.city.sections.some((s) => s.id === action.section) ? null : 'unknown_section';
    case 'TrainTroops': {
      if (!hasBuilding(state, 'kaserne')) return 'no_barracks';
      const troop = data.troops.troops.find((t) => t.unit === action.unit);
      if (!troop) return 'unknown_troop';
      if (!Number.isInteger(action.count) || action.count < 1 || action.count > 100) return 'invalid_payload';
      if (state.army.training) return 'training_busy';
      return canAfford(state.resources, scaleResources(troop.cost, action.count)) ? null : 'not_enough_resources';
    }
    case 'OpenWorldMap':
      return null;
    case 'JoinAlliance':
      return state.allianceJoined ? 'already_joined' : null;
    case 'RequestHelp': {
      if (!state.allianceJoined) return 'no_alliance';
      const building = state.buildings.find((b) => b.plot === action.plot);
      if (!building || buildingBusyUntil(building, state.now) === null) return 'nothing_to_help';
      return building.helpRequestedAt === null ? null : 'help_already_requested';
    }
    case 'ClaimDailyGoal': {
      const goal = data.goals.goals.find((g) => g.id === action.goal);
      if (!goal) return 'unknown_goal';
      if (!activeGoals(state, data).some((g) => g.id === goal.id)) return 'goal_not_active';
      if (state.daily.claimed.includes(goal.id)) return 'goal_already_claimed';
      return state.daily.counters[goal.counter] >= goal.count ? null : 'goal_not_reached';
    }
    case 'ClaimWeeklyGoal': {
      if (state.weekly.claimed) return 'goal_already_claimed';
      const goal = weeklyGoal(state, data);
      return state.weekly.counters[goal.counter] >= goal.count ? null : 'goal_not_reached';
    }
    case 'ClaimLoginReward':
      return loginReward(state, data) === null ? 'login_already_claimed' : null;
    case 'AcknowledgeRaid':
      return state.raidDueAt === null ? 'no_raid_announced' : null;
    case 'ResolveNightRaid':
      if (state.raidDueAt === null) return 'no_raid_announced';
      return state.now >= state.raidDueAt ? null : 'raid_not_due';
    case 'DismissRaidReport':
      return state.raidReport === null ? 'nothing_to_dismiss' : null;
    case 'ResolveAttack': {
      const target = data.camps.camps.find((c) => c.id === action.camp);
      if (!target) return 'unknown_camp';
      if (target.shielded) return 'target_shielded';
      const err = lineupError(state, action.lineup, data);
      if (err) return err;
      return validInputs(action.inputs) ? null : 'invalid_payload';
    }
  }
}

export interface ReduceResult {
  readonly state: GameState;
  readonly error: GameActionError | null;
}

/** Summe der Turmstufen: jeder Bau und jeder Ausbau zählt einen Schritt. */
function towerSteps(towers: readonly { readonly level: number }[]): number {
  return towers.reduce((n, t) => n + t.level, 0);
}

function nextSeed(seed: number): number {
  return (Math.imul(seed, 0x9e3779b1) + 1) >>> 0;
}

function withReplay(state: GameState, kind: SavedReplay['kind'], final: BattleState, loot: Resources, replay: Replay, data: GameData, stars = 0): GameState {
  const weak = kind === 'attack' ? null : weakSection(final, data);
  const saved: SavedReplay = { id: state.nextReplayId, kind, at: state.now, weakSection: weak, stars, result: final.result === 'breached' ? 'breached' : 'held', depth: final.depth, loot, replay };
  return { ...state, nextReplayId: state.nextReplayId + 1, replays: [...state.replays, saved].slice(-data.rules.maxReplays) };
}

function countFallen(fallen: readonly string[], data: GameData): UnitCount[] {
  return data.troops.troops
    .map((t) => ({ unit: t.unit, count: fallen.filter((f) => f === t.unit).length }))
    .filter((c) => c.count > 0);
}

function apply(state: GameState, action: GameAction, data: GameData): GameState | GameActionError {
  switch (action.type) {
    case 'AdvanceTime':
      return settle({ ...state, now: action.now }, data);
    case 'ResolveDefense': {
      const setup = defenseSetup(state, data);
      const final = runBattle(setup, state.nextSeed, action.inputs, data);
      if (final.result === 'running') return 'battle_not_finished';
      const won = final.result === 'held';
      const loss = cityLoss(state, final, data);
      const def = defenseDef(state, data);
      const stars = defenseStars(final, def, data);
      const s: GameState = {
        ...count(count(count(state, 'defenses', won ? 1 : 0), 'stars', stars), 'towers', towerSteps(final.towers) - towerSteps(state.towers)),
        nextSeed: nextSeed(state.nextSeed),
        resources: { ...loss.resources, gold: loss.resources.gold + (won ? def.victoryGold : 0) + starGold(stars, def, data) },
        shieldUntil: loss.shieldUntil,
        towers: final.towers.map((t) => ({ slot: t.slot, def: t.def, level: t.level })),
        defensesWon: state.defensesWon + (won ? 1 : 0),
        wavesCleared: state.wavesCleared + (won && def.index !== null && !def.repeat ? 1 : 0),
      };
      return withReplay(s, 'defense', final, loss.loot, makeReplay(setup, state.nextSeed, action.inputs, final, data), data, stars);
    }
    case 'ResolveNightRaid': {
      // Verteidigung in Abwesenheit: dieselbe Schlacht, nur ohne Eingaben. Der nächste Angriff wird gleich wieder angekündigt.
      const setup = raidSetup(state, data);
      const final = runBattle(setup, state.nextSeed, [], data);
      if (final.result === 'running') return 'battle_not_finished';
      const loss = cityLoss(state, final, data, state.raidsResolved < data.rules.freeNightRaids, true);
      const s: GameState = {
        ...state,
        raidsResolved: state.raidsResolved + 1,
        nextSeed: nextSeed(state.nextSeed),
        resources: loss.resources,
        shieldUntil: loss.shieldUntil,
        raidDueAt: state.now + data.rules.nightRaidAfterHours * HOUR_MS,
        raidReport: state.nextReplayId,
      };
      return withReplay(s, 'raid', final, loss.loot, makeReplay(setup, state.nextSeed, [], final, data), data);
    }
    case 'OpenWorldMap':
      return { ...state, worldSeen: true };
    case 'JoinAlliance':
      return { ...state, allianceJoined: true, resources: addResources(state.resources, data.alliance.joinReward) };
    case 'RequestHelp':
      return settle({ ...state, buildings: state.buildings.map((b) => (b.plot === action.plot ? { ...b, helpRequestedAt: state.now } : b)) }, data);
    case 'ClaimDailyGoal': {
      const goal = data.goals.goals.find((g) => g.id === action.goal)!;
      return {
        ...state,
        resources: addResources(state.resources, scaledReward(goal.reward, state, data)),
        daily: { ...state.daily, claimed: [...state.daily.claimed, goal.id] },
        goalsClaimed: state.goalsClaimed + 1,
      };
    }
    case 'ClaimWeeklyGoal':
      return { ...state, resources: addResources(state.resources, scaledReward(weeklyGoal(state, data).reward, state, data)), weekly: { ...state.weekly, claimed: true } };
    case 'ClaimLoginReward':
      return { ...state, resources: addResources(state.resources, loginReward(state, data)!), login: { day: state.daily.day, claims: state.login.claims + 1 } };
    case 'AcknowledgeRaid':
      return { ...state, raidAcknowledged: true };
    case 'DismissRaidReport':
      return { ...state, raidReport: null };
    case 'BuildTower': {
      const cost = towerActionCost(state.towers, state.keepLevel, action, data) as number;
      return { ...count(state, 'towers', 1), resources: { ...state.resources, gold: state.resources.gold - cost }, towers: [...state.towers, { slot: action.slot, def: action.tower, level: 1 }] };
    }
    case 'UpgradeTower': {
      const cost = towerActionCost(state.towers, state.keepLevel, action, data) as number;
      return {
        ...count(state, 'towers', 1),
        resources: { ...state.resources, gold: state.resources.gold - cost },
        towers: state.towers.map((t) => (t.slot === action.slot ? { ...t, level: t.level + 1 } : t)),
      };
    }
    case 'BuildBuilding': {
      const def = findById(data.buildings.buildings, action.building, 'Gebäude');
      const first = def.levels[0]!;
      const doneAt = state.now + first.buildSeconds * 1000;
      return {
        ...count(state, 'built', 1),
        resources: addResources(state.resources, first.cost, -1),
        buildings: [...state.buildings, { plot: action.plot, def: def.id, level: 1, doneAt, producedUntil: doneAt, upgradeDoneAt: null, helpRequestedAt: null, helpsReceived: 0 }],
      };
    }
    case 'UpgradeBuilding': {
      const building = state.buildings.find((b) => b.plot === action.plot)!;
      const next = findById(data.buildings.buildings, building.def, 'Gebäude').levels[building.level]!;
      return settle({
        ...count(state, 'built', 1),
        resources: addResources(state.resources, next.cost, -1),
        buildings: state.buildings.map((b) => (b.plot === action.plot ? { ...b, upgradeDoneAt: state.now + next.buildSeconds * 1000, helpRequestedAt: null, helpsReceived: 0 } : b)),
      }, data);
    }
    case 'SkipTimerFree':
      return settle({
        ...state,
        buildings: state.buildings.map((b) => {
          if (b.plot !== action.plot) return b;
          return b.doneAt > state.now ? { ...b, doneAt: state.now, producedUntil: state.now } : { ...b, upgradeDoneAt: state.now };
        }),
      }, data);
    case 'UpgradeKeep': {
      const next = data.city.keepLevels.find((l) => l.level === state.keepLevel + 1)!;
      return settle({ ...state, resources: addResources(state.resources, next.cost, -1), keepDoneAt: state.now + next.buildSeconds * 1000 }, data);
    }
    case 'ChooseRoad':
      return { ...state, roadId: action.road, roadChoicePending: false };
    case 'AssignHero':
      return { ...state, hero: { joined: true, section: action.section } };
    case 'TrainTroops': {
      const troop = data.troops.troops.find((t) => t.unit === action.unit)!;
      return {
        ...count(state, 'trained', action.count),
        resources: addResources(state.resources, scaleResources(troop.cost, action.count), -1),
        army: { ...state.army, training: { unit: troop.unit, count: action.count, doneAt: state.now + troop.trainSeconds * action.count * 1000 } },
      };
    }
    case 'ResolveAttack': {
      const camp = findById(data.camps.camps, action.camp, 'Lager');
      const setup = attackSetup(state, action.camp, action.lineup, data);
      const final = runBattle(setup, state.nextSeed, action.inputs, data);
      if (final.result === 'running') return 'battle_not_finished';
      const loot = computeLoot(camp.stock, camp.protected, final.depth, data.rules);
      // Verlustgrenze: Besiegte Truppen sind nicht verloren, sie kommen ins Lazarett.
      const fallen = countFallen(final.fallen, data);
      const healPermille = finishedBuildings(state, data).reduce((min, b) => Math.min(min, b.healTimePermille), PERMILLE);
      const ready = { ...state.army.ready };
      const hospital = [...state.army.hospital];
      for (const f of fallen) {
        const troop = data.troops.troops.find((t) => t.unit === f.unit)!;
        ready[f.unit] = (ready[f.unit] ?? 0) - f.count;
        hospital.push({ unit: f.unit, count: f.count, doneAt: state.now + mulDiv(troop.healSeconds * f.count * 1000, healPermille, PERMILLE) });
      }
      const s: GameState = {
        ...count(state, 'attacks', 1),
        nextSeed: nextSeed(state.nextSeed),
        resources: addResources(state.resources, loot),
        army: { ...state.army, ready, hospital },
        attacksDone: state.attacksDone + 1,
        lastAttack: { camp: camp.id, depth: final.depth, loot, fallen },
      };
      return withReplay(s, 'attack', final, loot, makeReplay(setup, state.nextSeed, action.inputs, final, data), data);
    }
  }
}

/** Zustand plus Aktion ergibt neuen Zustand. Ungültige Aktionen ändern nichts. */
export function reduceGame(state: GameState, action: GameAction, data: GameData): ReduceResult {
  const error = validateGameAction(state, action, data);
  if (error) return { state, error };
  const next = apply(state, action, data);
  if (typeof next === 'string') return { state, error: next };
  return { state: advanceTutorial(next, data), error: null };
}

/**
 * Vorschlag für die Aufstellung: Rammböcke und Gepanzerte voran, Leichte zuletzt, gleichmäßig auf die Wellen verteilt.
 * Die Oberfläche startet damit; der Spieler ändert sie.
 */
export function defaultLineup(state: GameState, data: GameData): UnitCount[][] {
  const waves = data.rules.attackWaves;
  const lineup: UnitCount[][] = Array.from({ length: waves }, () => []);
  const order = [...data.troops.troops].sort((a, b) => unitSiege(b.unit, data) - unitSiege(a.unit, data));
  order.forEach((troop, rank) => {
    const total = readyTroops(state, troop.unit);
    // Belagerungsgerät ganz in die erste Welle, alles andere verteilt, schnellere Truppen eher hinten.
    for (let w = 0; w < waves; w++) {
      const count = rank === 0 ? (w === 0 ? total : 0) : Math.floor(total / waves) + (w < total % waves ? 1 : 0);
      lineup[w]!.push({ unit: troop.unit, count });
    }
  });
  return lineup;
}

function unitSiege(unit: string, data: GameData): number {
  return findById(data.units.units, unit, 'Einheit').siege;
}
