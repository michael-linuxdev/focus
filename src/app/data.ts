import game from '../../data/game.json';
import roads from '../../data/roads.json';
import units from '../../data/units.json';
import waves from '../../data/waves.json';
import type { GameData } from '../sim/index.ts';

/** Die Datendateien, gebündelt für die Spiellogik. Schemas prüft `tests/sim/data.test.ts`. */
export const gameData: GameData = { game, roads, units, waves };
