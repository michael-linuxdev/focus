import { findById, type GameData } from '../data.ts';
import { roadLengthMilli } from '../road.ts';
import { rngFromSeed, rngInt, type RngState } from '../rng.ts';

/**
 * Schlacht-Simulation, Stand M0: Einheiten einer Welle laufen die Straße entlang
 * bis zum Burgfried. Türme, Schaden und Angriff folgen in M1 bis M3.
 *
 * Reihenfolge innerhalb eines Ticks (verbindlich, auch für die C#-Fassung):
 *   1. Eingaben dieses Ticks in Listenreihenfolge anwenden
 *   2. Fällige Einheiten in Planreihenfolge aufstellen
 *   3. Einheiten in Reihenfolge ihrer Kennung bewegen
 *   4. Angekommene Einheiten zählen und entfernen
 *   5. Ergebnis prüfen, Tick hochzählen
 */

export interface BattleSetup {
  readonly roadId: string;
  readonly waveId: string;
}

export type BattleAction = { readonly type: 'ReleaseWave' };

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
  readonly arrived: number;
  readonly done: boolean;
}

export type ActionError = 'battle_done' | 'wave_already_released';

export function createBattle(setup: BattleSetup, seed: number, data: GameData): BattleState {
  const road = findById(data.roads.roads, setup.roadId, 'Straße');
  findById(data.waves.waves, setup.waveId, 'Welle');
  return {
    tick: 0,
    rng: rngFromSeed(seed),
    setup,
    roadLength: roadLengthMilli(road),
    released: false,
    pending: [],
    units: [],
    nextUnitId: 1,
    arrived: 0,
    done: false,
  };
}

/** Prüft eine Eingabe gegen den Zustand. `null` heißt gültig. */
export function validateBattleAction(state: BattleState, action: BattleAction): ActionError | null {
  if (state.done) return 'battle_done';
  switch (action.type) {
    case 'ReleaseWave':
      return state.released ? 'wave_already_released' : null;
  }
}

/** Ein Zeitschritt. Ungültige Eingaben werden übergangen und ändern nichts. */
export function stepBattle(state: BattleState, actions: readonly BattleAction[], data: GameData): BattleState {
  if (state.done) return state;
  const rng: RngState = [...state.rng];
  let released = state.released;
  let pending = state.pending;

  for (const action of actions) {
    if (validateBattleAction({ ...state, released }, action) !== null) continue;
    const wave = findById(data.waves.waves, state.setup.waveId, 'Welle');
    const plan: PendingSpawn[] = [];
    for (const g of wave.groups) {
      for (let i = 0; i < g.count; i++) {
        plan.push({ tick: state.tick + g.startTick + i * g.intervalTicks + rngInt(rng, g.jitterTicks + 1), def: g.unit });
      }
    }
    // Stabile Sortierung: gleiche Ticks behalten die Planreihenfolge.
    pending = plan.map((p, i) => ({ p, i })).sort((a, b) => a.p.tick - b.p.tick || a.i - b.i).map((x) => x.p);
    released = true;
  }

  let nextUnitId = state.nextUnitId;
  const units: Unit[] = [...state.units];
  let firstWaiting = 0;
  while (firstWaiting < pending.length && pending[firstWaiting]!.tick <= state.tick) {
    const spawn = pending[firstWaiting]!;
    const def = findById(data.units.units, spawn.def, 'Einheit');
    units.push({ id: nextUnitId++, def: def.id, pos: 0, hp: def.hp });
    firstWaiting++;
  }
  if (firstWaiting > 0) pending = pending.slice(firstWaiting);

  let arrived = state.arrived;
  const alive: Unit[] = [];
  for (const u of units) {
    const def = findById(data.units.units, u.def, 'Einheit');
    const pos = u.pos + def.speedMilliPerTick;
    if (pos >= state.roadLength) arrived++;
    else alive.push({ ...u, pos });
  }

  return {
    ...state,
    tick: state.tick + 1,
    rng,
    released,
    pending,
    units: alive,
    nextUnitId,
    arrived,
    done: released && pending.length === 0 && alive.length === 0,
  };
}

/**
 * Prüfsumme des Zustands (FNV-1a, 32 Bit, über eine feste Folge von Ganzzahlen).
 * Dient dem Vergleich von Wiederholungen, später auch gegen die C#-Fassung.
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
  add(state.arrived);
  add(state.done ? 1 : 0);
  return h;
}
