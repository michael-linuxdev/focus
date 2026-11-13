/**
 * Dauerhafter Spielzustand und seine Aktionen, Stand M0 (Gerüst).
 * Jede Spielerhandlung ist eine benannte Aktion: erst `validateGameAction`, dann `reduceGame`.
 * Die Uhrzeit kommt ausschließlich über `AdvanceTime` herein.
 */
export const STATE_VERSION = 1;

export interface GameState {
  readonly version: number;
  /** Zuletzt hineingereichte Zeit in ms seit Epoche. */
  readonly now: number;
  /** Startwert der nächsten Schlacht. */
  readonly nextSeed: number;
  readonly battlesFinished: number;
}

export type GameAction =
  | { readonly type: 'AdvanceTime'; readonly now: number }
  | { readonly type: 'FinishBattle'; readonly arrived: number };

export type GameActionError = 'time_runs_backwards' | 'invalid_payload';

export function createGame(seed: number, now: number): GameState {
  return { version: STATE_VERSION, now, nextSeed: seed >>> 0, battlesFinished: 0 };
}

export function validateGameAction(state: GameState, action: GameAction): GameActionError | null {
  switch (action.type) {
    case 'AdvanceTime':
      if (!Number.isSafeInteger(action.now)) return 'invalid_payload';
      return action.now < state.now ? 'time_runs_backwards' : null;
    case 'FinishBattle':
      return Number.isInteger(action.arrived) && action.arrived >= 0 ? null : 'invalid_payload';
  }
}

export interface ReduceResult {
  readonly state: GameState;
  readonly error: GameActionError | null;
}

/** Zustand plus Aktion ergibt neuen Zustand. Ungültige Aktionen ändern nichts. */
export function reduceGame(state: GameState, action: GameAction): ReduceResult {
  const error = validateGameAction(state, action);
  if (error) return { state, error };
  switch (action.type) {
    case 'AdvanceTime':
      return { state: { ...state, now: action.now }, error: null };
    case 'FinishBattle':
      return {
        state: { ...state, nextSeed: (Math.imul(state.nextSeed, 0x9e3779b1) + 1) >>> 0, battlesFinished: state.battlesFinished + 1 },
        error: null,
      };
  }
}
