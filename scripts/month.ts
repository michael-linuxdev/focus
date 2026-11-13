/**
 * Spielt den ersten Spielmonat mit einem einfachen Spieler durch und zeigt, an welchem Tag der Burgfried
 * welche Stufe erreicht und wie die Vorräte stehen. Aufruf: npm run month (optional `-- eifrig`).
 * Kosten und Bauzeiten in `data/` nie nach Gefühl ändern: erst hier messen, dann ändern, dann wieder messen.
 */
import { createGame } from '../src/sim/index.ts';
import { playTutorial } from './lib/bot.ts';
import { loadData } from './lib/data.ts';
import { CASUAL, EAGER, playMonth } from './lib/month.ts';

const data = loadData();
const eager = process.argv.includes('eifrig');
const options = eager ? EAGER : CASUAL;
const start = playTutorial(createGame(7, 0, data), data, 'freies_spiel', 0, true).game;
const run = playMonth(start, data, options);
console.log(`Spieler: ${eager ? 'eifrig' : 'gelegentlich'} (${options.sessionHours.length} Sitzungen am Tag, je ${options.defensesPerSession} Verteidigungen)`);
console.log('Burgfried-Stufe erreicht an Tag: ' + run.keepDay.map((d, level) => (level < 2 ? null : `St.${level}: ${d ?? '–'}`)).filter(Boolean).join(' · '));
console.log(`Sitzungen ohne etwas zu bauen: ${run.idleSessions} von ${run.sessions}`);
console.log('Tag  Burgfried      Gold      Holz     Stein  Verteidigungen  Verlust bisher');
for (const d of run.days) console.log(`${String(d.day).padStart(3)}  ${String(d.keep).padStart(9)}  ${String(d.gold).padStart(8)}  ${String(d.wood).padStart(8)}  ${String(d.stone).padStart(8)}  ${String(d.defenses).padStart(14)}  ${String(d.lost).padStart(14)}`);
console.log('Gebäude: ' + run.game.buildings.map((b) => `${b.def} ${b.level}`).join(', '));
console.log('Türme: ' + run.game.towers.map((t) => `${t.def} ${t.level}`).join(', '));
