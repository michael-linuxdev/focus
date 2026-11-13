/**
 * Gibt einen Speicherstand am Ende des geführten Ablaufs aus (vom Hinweis-Bot gespielt).
 * Dient der Leistungsmessung und zum schnellen Ausprobieren später Spielphasen.
 * Aufruf: node scripts/make-save.ts > stand.json
 */
import { createGame } from '../src/sim/index.ts';
import { playTutorial } from './lib/bot.ts';
import { loadData } from './lib/data.ts';

const data = loadData();
const start = createGame(7, Date.now() - 3_600_000, data);
process.stdout.write(JSON.stringify(playTutorial(start, data, 'freies_spiel').game));
