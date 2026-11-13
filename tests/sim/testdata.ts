import game from '../../data/game.json';
import roads from '../../data/roads.json';
import units from '../../data/units.json';
import waves from '../../data/waves.json';
import type { GameData } from '../../src/sim/index.ts';

export const data: GameData = { game, roads, units, waves };
