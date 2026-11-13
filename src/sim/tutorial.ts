import type { GameData, HintDef } from './data.ts';
import { tutorialStep, validateGameAction, type GameState } from './game.ts';

/**
 * Der Hinweis des aktuellen Tutorial-Schritts, sofern er im Stadtbau gerade ausführbar ist.
 * (In der Schlacht prüft die Oberfläche einen Bauplatz-Hinweis mit `validateBattleAction`.)
 */
export function cityHint(state: GameState, data: GameData): HintDef | null {
  const hint = tutorialStep(state, data).hint;
  if (!hint) return null;
  switch (hint.type) {
    case 'slot': {
      const occupied = state.towers.some((t) => t.slot === hint.slot);
      const action = occupied ? ({ type: 'UpgradeTower', slot: hint.slot } as const) : ({ type: 'BuildTower', slot: hint.slot, tower: hint.tower } as const);
      return validateGameAction(state, action, data) === null ? hint : null;
    }
    case 'plot': {
      const building = state.buildings.find((b) => b.plot === hint.plot);
      if (!building) return validateGameAction(state, { type: 'BuildBuilding', plot: hint.plot, building: hint.building }, data) === null ? hint : null;
      if (building.doneAt > state.now) return tutorialStep(state, data).freeSkip ? hint : null;
      return hint;
    }
    case 'keep':
      return validateGameAction(state, { type: 'UpgradeKeep' }, data) === null ? hint : null;
    case 'button':
      return hint;
  }
}
