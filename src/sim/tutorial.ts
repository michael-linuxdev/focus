import type { GameData, HintDef } from './data.ts';
import { tutorialStep, unlocked, validateGameAction, type GameState } from './game.ts';

/**
 * Der Hinweis des aktuellen Tutorial-Schritts, sofern er im Stadtbau gerade ausführbar ist.
 * (In der Schlacht prüft die Oberfläche einen Bauplatz-Hinweis mit `validateBattleAction`.)
 */
export function cityHint(state: GameState, data: GameData): HintDef | null {
  const hint = tutorialStep(state, data).hint;
  if (!hint) return null;
  // Fehlt für den nächsten Schritt nur Gold, führt der Hinweis zur Verteidigung: dort wird es verdient.
  const earnGold: HintDef | null = unlocked(state, 'defend', data) ? { type: 'button', button: 'defend' } : null;
  switch (hint.type) {
    case 'slot': {
      const occupied = state.towers.some((t) => t.slot === hint.slot);
      const action = occupied ? ({ type: 'UpgradeTower', slot: hint.slot } as const) : ({ type: 'BuildTower', slot: hint.slot, tower: hint.tower } as const);
      const error = validateGameAction(state, action, data);
      if (error === null) return hint;
      return error === 'not_enough_resources' ? earnGold : null;
    }
    case 'plot': {
      const building = state.buildings.find((b) => b.plot === hint.plot);
      if (!building) {
        if (validateGameAction(state, { type: 'BuildBuilding', plot: hint.plot, building: hint.building }, data) === null) return hint;
        const cost = data.buildings.buildings.find((b) => b.id === hint.building)?.cost;
        return cost && state.resources.gold < cost.gold ? earnGold : null;
      }
      if (building.doneAt > state.now) return tutorialStep(state, data).freeSkip ? hint : null;
      return hint;
    }
    case 'keep': {
      if (validateGameAction(state, { type: 'UpgradeKeep' }, data) === null) return hint;
      const next = data.city.keepLevels.find((l) => l.level === state.keepLevel + 1);
      return next && state.keepDoneAt === null && !state.roadChoicePending && state.resources.gold < next.cost.gold ? earnGold : null;
    }
    case 'button':
      return hint;
  }
}
