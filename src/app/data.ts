import buildings from '../../data/buildings.json';
import camps from '../../data/camps.json';
import city from '../../data/city.json';
import game from '../../data/game.json';
import hero from '../../data/hero.json';
import roads from '../../data/roads.json';
import rules from '../../data/rules.json';
import towers from '../../data/towers.json';
import troops from '../../data/troops.json';
import tutorial from '../../data/tutorial.json';
import units from '../../data/units.json';
import waves from '../../data/waves.json';
import type { GameData } from '../sim/index.ts';

/**
 * Die Datendateien, gebündelt für die Spiellogik. Die Form sichern die Schemas in `data/schemas/`
 * (geprüft in `tests/sim/data.test.ts`), deshalb hier die eine Typ-Zusicherung.
 */
export const gameData = { game, roads, city, buildings, units, troops, towers, hero, rules, camps, waves, tutorial } as unknown as GameData;
