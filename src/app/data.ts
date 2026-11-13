import game from '../../data/game.json';
import roads from '../../data/roads.json';
import towers from '../../data/towers.json';
import tutorial from '../../data/tutorial.json';
import units from '../../data/units.json';
import waves from '../../data/waves.json';
import type { GameData } from '../sim/index.ts';

/**
 * Die Datendateien, gebündelt für die Spiellogik. Die Form sichern die Schemas in `data/schemas/`
 * (geprüft in `tests/sim/data.test.ts`), deshalb hier die eine Typ-Zusicherung.
 */
export const gameData = { game, roads, units, towers, waves, tutorial } as unknown as GameData;
