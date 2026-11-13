import {
  createBattle, currentHint, defenseSetup, defenseStep, hintAction, stepBattle, validateBattleAction,
  type BattleAction, type BattleInput, type BattleState, type GameData, type GameState,
} from '../../src/sim/index.ts';

export type Policy = (battle: BattleState, game: GameState) => BattleAction | null;

/** Spielt die anstehende Verteidigung mit einer Strategie durch und liefert Eingaben und Endzustand. */
export function playDefense(game: GameState, data: GameData, policy: Policy, maxTicks = 6000): { inputs: BattleInput[]; final: BattleState } {
  let battle = createBattle(defenseSetup(game, data), game.nextSeed, data);
  const inputs: BattleInput[] = [];
  while (battle.result === 'running' && battle.tick < maxTicks) {
    const action = policy(battle, game);
    const actions = action && validateBattleAction(battle, action, data) === null ? [action] : [];
    for (const a of actions) inputs.push({ tick: battle.tick, action: a });
    battle = stepBattle(battle, actions, data);
  }
  return { inputs, final: battle };
}

/** Folgt genau den Hinweisen des Tutorials. */
export const followHints = (data: GameData): Policy => (battle, game) => {
  const hint = currentHint(defenseStep(game, data), battle, data);
  return hint ? hintAction(hint) : null;
};

/** Baut nur den ersten Turm (ohne den geht es nicht weiter) und löst Wellen aus, sonst nichts. */
export const bareMinimum = (data: GameData): Policy => (battle) => {
  if (battle.towers.length === 0) return { type: 'BuildTower', slot: data.roads.roads[0]!.towerSlots[0]!.id, tower: data.towers.towers[0]!.id };
  return battle.released ? null : { type: 'ReleaseWave' };
};
