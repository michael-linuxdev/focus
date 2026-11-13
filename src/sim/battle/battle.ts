import { MILLI } from '../fixed.ts';
import { findById, type GameData, type RoadDef, type TowerLevelDef } from '../data.ts';
import { roadLengthMilli, roadPointMilli } from '../road.ts';
import { rngFromSeed, rngInt, type RngState } from '../rng.ts';

/**
 * Schlacht-Simulation, Stand M1: Verteidigung. Angreifer laufen die Straße entlang,
 * Türme auf Bauplätzen schießen von selbst, der Spieler baut und baut aus.
 *
 * Reihenfolge innerhalb eines Ticks (verbindlich, auch für die C#-Fassung):
 *   1. Eingaben dieses Ticks in Listenreihenfolge anwenden (ungültige werden übergangen)
 *   2. Fällige Einheiten in Planreihenfolge aufstellen
 *   3. Einheiten in Reihenfolge ihrer Kennung bewegen
 *      (Schritte 2 und 3 entfallen, solange die Welle am Haltepunkt steht; siehe `frozen`)
 *   4. Am Burgfried angekommene Einheiten entfernen, Burgfried-Schaden
 *   5. Türme in Reihenfolge der Bauplätze der Straße: Abklingzeit oder Schuss
 *   6. Ergebnis prüfen, Tick hochzählen
 */

export interface CityTower {
  readonly slot: string;
  readonly def: string;
  /** Stufe, beginnend bei 1. */
  readonly level: number;
}

/** Startzustand einer Schlacht. Zusammen mit Startwert und Eingaben ist sie vollständig bestimmt. */
export interface BattleSetup {
  readonly roadId: string;
  readonly waveId: string;
  readonly towers: readonly CityTower[];
  readonly gold: number;
  readonly keepHp: number;
  readonly unlosable: boolean;
  readonly autoRelease: boolean;
  /** Solange kein Turm steht, hält die Welle an, sobald der vorderste Angreifer diese Wegstrecke erreicht (0 = aus). */
  readonly holdMilliUntilTower: number;
}

export type BattleAction =
  | { readonly type: 'ReleaseWave' }
  | { readonly type: 'BuildTower'; readonly slot: string; readonly tower: string }
  | { readonly type: 'UpgradeTower'; readonly slot: string };

export interface BattleInput {
  readonly tick: number;
  readonly action: BattleAction;
}

export interface Unit {
  readonly id: number;
  readonly def: string;
  readonly pos: number;
  readonly hp: number;
}

export interface PendingSpawn {
  readonly tick: number;
  readonly def: string;
}

export interface BattleTower extends CityTower {
  /** Ticks bis zum nächsten Schuss. */
  readonly cooldown: number;
  /** Letzter Schuss, nur für die Darstellung (-1 = noch keiner). Ort in Milli-Kacheln. */
  readonly lastShotTick: number;
  readonly targetX: number;
  readonly targetY: number;
}

export type BattleResult = 'running' | 'won' | 'lost';

export interface BattleState {
  readonly tick: number;
  readonly rng: RngState;
  readonly setup: BattleSetup;
  readonly roadLength: number;
  readonly released: boolean;
  /** Aufsteigend nach Tick, bei Gleichstand in Planreihenfolge. */
  readonly pending: readonly PendingSpawn[];
  readonly units: readonly Unit[];
  readonly nextUnitId: number;
  readonly towers: readonly BattleTower[];
  readonly gold: number;
  readonly keepHp: number;
  readonly killed: number;
  readonly leaked: number;
  readonly result: BattleResult;
}

export type ActionError =
  | 'battle_done'
  | 'wave_already_released'
  | 'unknown_slot'
  | 'unknown_tower'
  | 'slot_occupied'
  | 'slot_empty'
  | 'max_level'
  | 'not_enough_gold';

function planWave(waveId: string, startTick: number, rng: RngState, data: GameData): PendingSpawn[] {
  const wave = findById(data.waves.waves, waveId, 'Welle');
  const plan: PendingSpawn[] = [];
  for (const g of wave.groups) {
    for (let i = 0; i < g.count; i++) {
      plan.push({ tick: startTick + g.startTick + i * g.intervalTicks + rngInt(rng, g.jitterTicks + 1), def: g.unit });
    }
  }
  // Stabile Sortierung: gleiche Ticks behalten die Planreihenfolge.
  return plan.map((p, i) => ({ p, i })).sort((a, b) => a.p.tick - b.p.tick || a.i - b.i).map((x) => x.p);
}

function newTower(t: CityTower): BattleTower {
  return { slot: t.slot, def: t.def, level: t.level, cooldown: 0, lastShotTick: -1, targetX: 0, targetY: 0 };
}

export function towerLevel(t: CityTower, data: GameData): TowerLevelDef {
  const level = findById(data.towers.towers, t.def, 'Turm').levels[t.level - 1];
  if (!level) throw new Error(`Turm ${t.def}: Stufe ${t.level} fehlt`);
  return level;
}

export function createBattle(setup: BattleSetup, seed: number, data: GameData): BattleState {
  const road = findById(data.roads.roads, setup.roadId, 'Straße');
  const rng = rngFromSeed(seed);
  const pending = setup.autoRelease ? planWave(setup.waveId, 0, rng, data) : [];
  findById(data.waves.waves, setup.waveId, 'Welle');
  return {
    tick: 0,
    rng,
    setup,
    roadLength: roadLengthMilli(road),
    released: setup.autoRelease,
    pending,
    units: [],
    nextUnitId: 1,
    towers: setup.towers.map(newTower),
    gold: setup.gold,
    keepHp: setup.keepHp,
    killed: 0,
    leaked: 0,
    result: 'running',
  };
}

/** Kosten einer Bau- oder Ausbau-Aktion, oder der Grund, warum sie nicht geht. */
function actionCost(state: BattleState, action: BattleAction, road: RoadDef, data: GameData): number | ActionError {
  switch (action.type) {
    case 'ReleaseWave':
      return state.released ? 'wave_already_released' : 0;
    case 'BuildTower': {
      if (!road.towerSlots.some((s) => s.id === action.slot)) return 'unknown_slot';
      const def = data.towers.towers.find((t) => t.id === action.tower);
      if (!def) return 'unknown_tower';
      if (state.towers.some((t) => t.slot === action.slot)) return 'slot_occupied';
      return def.levels[0]!.cost;
    }
    case 'UpgradeTower': {
      if (!road.towerSlots.some((s) => s.id === action.slot)) return 'unknown_slot';
      const tower = state.towers.find((t) => t.slot === action.slot);
      if (!tower) return 'slot_empty';
      const next = findById(data.towers.towers, tower.def, 'Turm').levels[tower.level];
      return next ? next.cost : 'max_level';
    }
  }
}

/** Prüft eine Eingabe gegen den Zustand. `null` heißt gültig. */
export function validateBattleAction(state: BattleState, action: BattleAction, data: GameData): ActionError | null {
  if (state.result !== 'running') return 'battle_done';
  const road = findById(data.roads.roads, state.setup.roadId, 'Straße');
  const cost = actionCost(state, action, road, data);
  if (typeof cost !== 'number') return cost;
  return cost > state.gold ? 'not_enough_gold' : null;
}

function applyAction(state: BattleState, action: BattleAction, rng: RngState, road: RoadDef, data: GameData): BattleState {
  const cost = actionCost(state, action, road, data);
  if (typeof cost !== 'number' || cost > state.gold) return state;
  switch (action.type) {
    case 'ReleaseWave':
      return { ...state, released: true, pending: planWave(state.setup.waveId, state.tick, rng, data) };
    case 'BuildTower':
      return { ...state, gold: state.gold - cost, towers: [...state.towers, newTower({ slot: action.slot, def: action.tower, level: 1 })] };
    case 'UpgradeTower':
      return {
        ...state,
        gold: state.gold - cost,
        towers: state.towers.map((t) => (t.slot === action.slot ? { ...t, level: t.level + 1 } : t)),
      };
  }
}

/** Ein Zeitschritt. Ungültige Eingaben werden übergangen und ändern nichts. */
export function stepBattle(state: BattleState, actions: readonly BattleAction[], data: GameData): BattleState {
  if (state.result !== 'running') return state;
  const road = findById(data.roads.roads, state.setup.roadId, 'Straße');
  const rng: RngState = [...state.rng];

  // 1. Eingaben
  let s = state;
  for (const action of actions) s = applyAction(s, action, rng, road, data);

  // Haltepunkt: Solange kein Turm steht und der vorderste Angreifer dort angekommen ist,
  // steht die Welle still (keine Bewegung, Nachrücker verschieben sich um einen Tick).
  const hold = s.setup.holdMilliUntilTower;
  const frozen = hold > 0 && s.towers.length === 0 && s.units.some((u) => u.pos >= hold);

  // 2. Aufstellen
  let nextUnitId = s.nextUnitId;
  let pending = s.pending;
  let keepHp = s.keepHp;
  let leaked = s.leaked;
  let units: Unit[] = [];
  if (frozen) {
    pending = pending.map((p) => ({ tick: p.tick + 1, def: p.def }));
    units = [...s.units];
  } else {
    const spawned: Unit[] = [...s.units];
    let due = 0;
    while (due < pending.length && pending[due]!.tick <= s.tick) {
      const def = findById(data.units.units, pending[due]!.def, 'Einheit');
      spawned.push({ id: nextUnitId++, def: def.id, pos: 0, hp: def.hp });
      due++;
    }
    if (due > 0) pending = pending.slice(due);

    // 3. und 4. Bewegen, Ankunft
    for (const u of spawned) {
      const def = findById(data.units.units, u.def, 'Einheit');
      const pos = u.pos + def.speedMilliPerTick;
      if (pos >= s.roadLength) {
        leaked++;
        if (!s.setup.unlosable) keepHp = Math.max(0, keepHp - def.keepDamage);
      } else {
        units.push({ id: u.id, def: u.def, pos, hp: u.hp });
      }
    }
  }

  // 5. Türme
  let gold = s.gold;
  let killed = s.killed;
  const towers: BattleTower[] = [];
  for (const slot of road.towerSlots) {
    const tower = s.towers.find((t) => t.slot === slot.id);
    if (!tower) continue;
    if (tower.cooldown > 0) {
      towers.push({ ...tower, cooldown: tower.cooldown - 1 });
      continue;
    }
    const level = towerLevel(tower, data);
    const rangeSq = level.rangeMilli * level.rangeMilli;
    // Ziel: am weitesten vorgerückte Einheit in Reichweite, bei Gleichstand die mit der kleinsten Kennung.
    let target: Unit | null = null;
    let tx = 0;
    let ty = 0;
    for (const u of units) {
      if (target && u.pos <= target.pos) continue;
      const [ux, uy] = roadPointMilli(road, u.pos);
      const dx = ux - slot.x * MILLI;
      const dy = uy - slot.y * MILLI;
      if (dx * dx + dy * dy <= rangeSq) {
        target = u;
        tx = ux;
        ty = uy;
      }
    }
    if (!target) {
      towers.push(tower);
      continue;
    }
    const hit = target;
    const hp = hit.hp - level.damage;
    if (hp <= 0) {
      units = units.filter((u) => u.id !== hit.id);
      gold += findById(data.units.units, hit.def, 'Einheit').bounty;
      killed++;
    } else {
      units = units.map((u) => (u.id === hit.id ? { ...u, hp } : u));
    }
    towers.push({ ...tower, cooldown: level.cooldownTicks - 1, lastShotTick: s.tick, targetX: tx, targetY: ty });
  }

  // 6. Ergebnis
  let result: BattleResult = 'running';
  if (keepHp <= 0) result = 'lost';
  else if (s.released && pending.length === 0 && units.length === 0) result = 'won';

  return { ...s, tick: s.tick + 1, rng, pending, units, nextUnitId, towers, gold, keepHp, killed, leaked, result };
}

/**
 * Prüfsumme des Zustands (FNV-1a, 32 Bit, über eine feste Folge von Ganzzahlen).
 * Dient dem Vergleich von Wiederholungen, später auch gegen die C#-Fassung.
 * Türme gehen in der Reihenfolge der Liste ein; Felder nur für die Darstellung bleiben außen vor.
 */
export function hashBattle(state: BattleState): number {
  let h = 0x811c9dc5;
  const add = (n: number): void => {
    for (let shift = 0; shift < 32; shift += 8) {
      h = Math.imul(h ^ ((n >>> shift) & 0xff), 0x01000193) >>> 0;
    }
  };
  add(state.tick);
  for (const w of state.rng) add(w);
  add(state.released ? 1 : 0);
  add(state.pending.length);
  for (const p of state.pending) add(p.tick);
  add(state.units.length);
  for (const u of state.units) {
    add(u.id);
    add(u.pos);
    add(u.hp);
  }
  add(state.nextUnitId);
  add(state.towers.length);
  for (const t of state.towers) {
    add(t.level);
    add(t.cooldown);
  }
  add(state.gold);
  add(state.keepHp);
  add(state.killed);
  add(state.leaked);
  add(state.result === 'running' ? 0 : state.result === 'won' ? 1 : 2);
  return h;
}
