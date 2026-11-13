import type { DefenseStepDef, GameData, HintDef } from './data.ts';
import { validateBattleAction, type BattleAction, type BattleState } from './battle/battle.ts';

/**
 * Der Hinweis, den die Oberfläche gerade zeigen soll: der erste Hinweis des Schritts,
 * dessen Aktion jetzt gültig ist. Erledigte oder unbezahlbare Hinweise werden übersprungen.
 */
export function currentHint(step: DefenseStepDef, battle: BattleState, data: GameData): HintDef | null {
  for (const hint of step.hints) {
    if (validateBattleAction(battle, hintAction(hint), data) === null) return hint;
  }
  return null;
}

export function hintAction(hint: HintDef): BattleAction {
  switch (hint.type) {
    case 'buildTower':
      return { type: 'BuildTower', slot: hint.slot, tower: hint.tower };
    case 'upgradeTower':
      return { type: 'UpgradeTower', slot: hint.slot };
    case 'releaseWave':
      return { type: 'ReleaseWave' };
  }
}
