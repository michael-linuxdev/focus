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
console.log(`Neue Wellen: ${run.fresh.won} gewonnen, ${run.fresh.lost} verloren · Wiederholungen: ${run.repeats} · Nachtangriffe: ${run.raids.held} gehalten, ${run.raids.breached} Burgfried gefallen, ${run.raids.market} bis zum Marktplatz`);
console.log(`Angriffe: ${run.attacks.count} (davon ${run.attacks.cities} auf Städte), Tiefe 0/1/2/3: ${run.attacks.depth.join('/')} · Gegenangriffe: ${run.revenges}`);
console.log('Burgfried  neue Wellen gew./verl.  Sterne im Schnitt  durchgekommen im Schnitt  Sekunden  Anführer gew./Versuche  Nachtangriffe bis Marktplatz');
run.bands.forEach((b, level) => {
  const n = b.won + b.lost;
  if (n + b.raids === 0) return;
  const avg = (x: number): string => (n === 0 ? '–' : (x / n).toFixed(1));
  console.log(`${String(level).padStart(9)}  ${`${b.won}/${b.lost}`.padStart(22)}  ${avg(b.stars).padStart(17)}  ${avg(b.leaked).padStart(23)}  ${avg(b.seconds).padStart(8)}  ${`${b.bossWon}/${b.bossTries}`.padStart(22)}  ${`${b.raidMarket}/${b.raids}`.padStart(28)}`);
});
console.log('Tag  Burgfried      Gold      Holz     Stein  Verteidigungen  Verlust bisher  Welle');
for (const d of run.days) console.log(`${String(d.day).padStart(3)}  ${String(d.keep).padStart(9)}  ${String(d.gold).padStart(8)}  ${String(d.wood).padStart(8)}  ${String(d.stone).padStart(8)}  ${String(d.defenses).padStart(14)}  ${String(d.lost).padStart(14)}  ${String(d.wave).padStart(5)}`);
console.log('Gebäude: ' + run.game.buildings.map((b) => `${b.def} ${b.level}`).join(', '));
console.log('Türme: ' + run.game.towers.map((t) => `${t.def} ${t.level}`).join(', '));
