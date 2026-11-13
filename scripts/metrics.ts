/**
 * Wertet Exportdateien der Entwicklerseite aus (eine Datei je Spieler) und gibt die drei Kennzahlen aus.
 * Aufruf: npm run metrics -- export1.json export2.json ...
 * Exporte mit Zeitraffer werden mitgezählt, aber gekennzeichnet; mit --ohne-zeitraffer bleiben sie außen vor.
 */
import { readFileSync } from 'node:fs';
import { aggregate, summarize, type ExportFile } from '../src/telemetry/metrics.ts';

const args = process.argv.slice(2);
const strict = args.includes('--ohne-zeitraffer');
const paths = args.filter((a) => !a.startsWith('--'));
if (paths.length === 0) {
  console.error('Aufruf: npm run metrics -- export1.json [export2.json ...] [--ohne-zeitraffer]');
  process.exit(1);
}
let files = paths.map((p) => JSON.parse(readFileSync(p, 'utf8')) as ExportFile);
const yes = (b: boolean): string => (b ? 'ja' : 'nein');
console.log('Installation   Minute 10   Allianz   nächster Tag   weitester Schritt     Sitzungen  Zeitraffer');
for (const f of files) {
  const s = summarize(f.events, f.minute10Step);
  console.log(`${f.install.padEnd(15)}${yes(s.reachedMinute10).padEnd(12)}${yes(s.joinedAlliance).padEnd(10)}${yes(s.returnedNextDay).padEnd(15)}${(s.lastStep ?? '-').padEnd(22)}${String(s.sessions).padEnd(11)}${yes(s.usedTimeLapse)}`);
}
if (strict) files = files.filter((f) => !summarize(f.events, f.minute10Step).usedTimeLapse);
const a = aggregate(files);
console.log(`\nSpieler: ${a.players}${strict ? ' (ohne Zeitraffer)' : ''}`);
console.log(`Minute 10 erreicht:        ${a.minute10} %`);
console.log(`Allianz beigetreten:       ${a.alliance} %`);
console.log(`Rückkehr am nächsten Tag:  ${a.nextDay} %`);
if (a.withTimeLapse > 0) console.log(`Hinweis: ${a.withTimeLapse} Export(e) enthalten Zeitraffer und taugen nicht für echte Quoten.`);
