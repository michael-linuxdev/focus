import { dataVersion, type GameData } from './data.ts';
import { createBattle, hashBattle, stepBattle, type BattleInput, type BattleSetup, type BattleState } from './battle/battle.ts';

/**
 * Eine Wiederholung ist nur Startzustand (Setup), Startwert und die Eingaben mit Tick.
 * `finalTick` und `finalHash` sind das erwartete Ergebnis und machen sie zum Prüffall.
 */
export interface Replay {
  readonly format: 1;
  readonly dataVersion: string;
  readonly setup: BattleSetup;
  readonly seed: number;
  readonly inputs: readonly BattleInput[];
  readonly finalTick: number;
  readonly finalHash: number;
}

/** Obergrenze gegen Endlosläufe (10 Minuten bei 20 Ticks pro Sekunde). */
export const MAX_BATTLE_TICKS = 12000;

/** Spielt Eingaben ab, bis die Schlacht endet oder `untilTick` erreicht ist. */
export function runBattle(
  setup: BattleSetup,
  seed: number,
  inputs: readonly BattleInput[],
  data: GameData,
  untilTick: number = MAX_BATTLE_TICKS,
): BattleState {
  let state = createBattle(setup, seed, data);
  let next = 0;
  while (!state.done && state.tick < untilTick) {
    const actions = [];
    while (next < inputs.length && inputs[next]!.tick <= state.tick) {
      if (inputs[next]!.tick === state.tick) actions.push(inputs[next]!.action);
      next++;
    }
    state = stepBattle(state, actions, data);
  }
  return state;
}

export function makeReplay(setup: BattleSetup, seed: number, inputs: readonly BattleInput[], final: BattleState, data: GameData): Replay {
  return { format: 1, dataVersion: dataVersion(data), setup, seed, inputs, finalTick: final.tick, finalHash: hashBattle(final) };
}

export type ReplayCheck = 'ok' | 'data_version_mismatch' | 'result_mismatch';

/** Rechnet eine Wiederholung nach (das tut später der Server). */
export function verifyReplay(replay: Replay, data: GameData): ReplayCheck {
  if (replay.dataVersion !== dataVersion(data)) return 'data_version_mismatch';
  const final = runBattle(replay.setup, replay.seed, replay.inputs, data, replay.finalTick);
  return final.tick === replay.finalTick && hashBattle(final) === replay.finalHash ? 'ok' : 'result_mismatch';
}
