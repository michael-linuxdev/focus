import { findById, type DefenseStepDef, type GameData } from './data.ts';
import type { BattleInput, BattleSetup, CityTower } from './battle/battle.ts';
import { makeReplay, runBattle, type Replay } from './replay.ts';

/**
 * Dauerhafter Spielzustand und seine Aktionen, Stand M1.
 * Jede Spielerhandlung ist eine benannte Aktion: erst `validateGameAction`, dann `reduceGame`.
 * Die Uhrzeit kommt ausschließlich über `AdvanceTime` herein.
 *
 * Eine Verteidigung wird nicht "gemeldet", sondern nachgerechnet: `ResolveDefense` bekommt nur die
 * Eingaben des Spielers; Startzustand und Startwert stammen aus dem Spielzustand. So prüft es später der Server.
 */
export const STATE_VERSION = 2;

export interface GameState {
  readonly version: number;
  /** Zuletzt hineingereichte Zeit in ms seit Epoche. */
  readonly now: number;
  /** Startwert der nächsten Schlacht. */
  readonly nextSeed: number;
  readonly gold: number;
  readonly towers: readonly CityTower[];
  /** Gewonnene Verteidigungen; bestimmt den Tutorial-Schritt. */
  readonly wavesWon: number;
  readonly lastDefense: Replay | null;
}

export type GameAction =
  | { readonly type: 'AdvanceTime'; readonly now: number }
  | { readonly type: 'ResolveDefense'; readonly inputs: readonly BattleInput[] };

export type GameActionError = 'time_runs_backwards' | 'invalid_payload' | 'battle_not_finished';

export function createGame(seed: number, now: number, data: GameData): GameState {
  return { version: STATE_VERSION, now, nextSeed: seed >>> 0, gold: data.tutorial.start.gold, towers: [], wavesWon: 0, lastDefense: null };
}

/** Der Verteidigungsschritt, der als Nächstes ansteht. */
export function defenseStep(state: GameState, data: GameData): DefenseStepDef {
  return data.tutorial.defenseSteps[state.wavesWon] ?? data.tutorial.afterTutorial;
}

/** Startzustand der nächsten Verteidigung, vollständig aus Spielzustand und Daten abgeleitet. */
export function defenseSetup(state: GameState, data: GameData): BattleSetup {
  const step = defenseStep(state, data);
  const start = data.tutorial.start;
  findById(data.roads.roads, start.roadId, 'Straße');
  return {
    roadId: start.roadId,
    waveId: step.wave,
    towers: state.towers,
    gold: state.gold,
    keepHp: start.keepHp,
    unlosable: step.unlosable,
    autoRelease: step.autoRelease,
    holdMilliUntilTower: step.holdMilliUntilTower,
  };
}

function validInputs(inputs: readonly BattleInput[]): boolean {
  let last = 0;
  for (const i of inputs) {
    if (!Number.isInteger(i.tick) || i.tick < last) return false;
    last = i.tick;
  }
  return true;
}

export function validateGameAction(state: GameState, action: GameAction): GameActionError | null {
  switch (action.type) {
    case 'AdvanceTime':
      if (!Number.isSafeInteger(action.now)) return 'invalid_payload';
      return action.now < state.now ? 'time_runs_backwards' : null;
    case 'ResolveDefense':
      return validInputs(action.inputs) ? null : 'invalid_payload';
  }
}

export interface ReduceResult {
  readonly state: GameState;
  readonly error: GameActionError | null;
}

function nextSeed(seed: number): number {
  return (Math.imul(seed, 0x9e3779b1) + 1) >>> 0;
}

/** Zustand plus Aktion ergibt neuen Zustand. Ungültige Aktionen ändern nichts. */
export function reduceGame(state: GameState, action: GameAction, data: GameData): ReduceResult {
  const error = validateGameAction(state, action);
  if (error) return { state, error };
  switch (action.type) {
    case 'AdvanceTime':
      return { state: { ...state, now: action.now }, error: null };
    case 'ResolveDefense': {
      const setup = defenseSetup(state, data);
      const final = runBattle(setup, state.nextSeed, action.inputs, data);
      if (final.result === 'running') return { state, error: 'battle_not_finished' };
      const won = final.result === 'won';
      return {
        state: {
          ...state,
          nextSeed: nextSeed(state.nextSeed),
          gold: final.gold + (won ? defenseStep(state, data).victoryGold : 0),
          towers: final.towers.map((t) => ({ slot: t.slot, def: t.def, level: t.level })),
          wavesWon: state.wavesWon + (won ? 1 : 0),
          lastDefense: makeReplay(setup, state.nextSeed, action.inputs, final, data),
        },
        error: null,
      };
    }
  }
}
