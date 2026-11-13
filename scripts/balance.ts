/**
 * Balance-Skript: rechnet Schlachten massenhaft durch und gibt Siegquoten aus.
 * Alle Werte stammen aus `data/`; das Skript ändert nichts. Aufruf: npm run balance [-- Anzahl]
 *
 * Teile:
 *   1. Verteidigungen des Ablaufs mit der Stadt, die der Hinweis-Bot bis dahin gebaut hat
 *   2. Nachtangriff gegen die Stadt am Ende des Ablaufs und gegen schwächere Varianten
 *   3. Angriffe auf jedes Ziel mit verschiedenen Armeen und Spielweisen
 *   4. Turm gegen Truppe: prüft die Tabelle "Stärke gegen"
 */
import {
  attackSetup, createBattle, createGame, defaultLineup, defenseSetup, raidSetup, runBattle, stepBattle, tutorialStep,
  type BattleSetup, type GameData, type GameState,
} from '../src/sim/index.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { firstTowerOnly, playBattle, playTutorial, skilledAttack, type Policy } from './lib/bot.ts';
import { loadData } from './lib/data.ts';

const data: GameData = loadData();
const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 200);
/** Messwerte für den Abgleich mit den Zielwerten in `scripts/balance-targets.json` (Prozent bzw. Anzahl). */
const measured = new Map<string, number>();
const share = (n: number, of: number): number => Math.round((n * 1000) / Math.max(1, of)) / 10;
const pct = (n: number, of: number): string => `${((n * 100) / Math.max(1, of)).toFixed(0).padStart(3)} %`;
const pad = (s: string | number, w: number): string => String(s).padEnd(w);
const head = (title: string): void => console.log(`\n== ${title} ==`);

// ---------- 1. Verteidigungen des Ablaufs ----------
head(`1. Verteidigungen des Ablaufs (${N} Startwerte je Welle, Stadt wie vom Hinweis-Bot gebaut)`);
console.log(`${pad('Welle', 12)}${pad('gehalten', 10)}${pad('Ø durch', 9)}${pad('Ø Tiefe', 9)}${pad('Ø Dauer', 9)}Türme`);
{
  // Zustand unmittelbar vor jeder Verteidigung einsammeln, indem der Bot den Ablauf einmal spielt.
  const before: GameState[] = [];
  let game = createGame(1, 0, data);
  for (let guard = 0; guard < 60 && tutorialStep(game, data).id !== 'freies_spiel'; guard++) {
    const stepId = tutorialStep(game, data).id;
    const hint = tutorialStep(game, data).hint;
    const defends = tutorialStep(game, data).autoDefense || (hint?.type === 'button' && hint.button === 'defend');
    if (defends && before.length === game.defensesWon) before.push(game);
    const next = data.tutorial.steps[game.tutorialStep + 1]!.id;
    game = playTutorial(game, data, next).game;
    if (tutorialStep(game, data).id === stepId) break;
  }
  before.forEach((state, i) => {
    let held = 0, leaked = 0, depth = 0, ticks = 0;
    for (let seed = 1; seed <= N; seed++) {
      const { final } = playBattle(defenseSetup(state, data), seed, data, firstTowerOnly(data));
      if (final.result === 'held') held++;
      leaked += final.leaked;
      depth += final.depth;
      ticks += final.tick;
    }
    const wave = (data.tutorial.defenses[i] ?? data.tutorial.afterDefenses).wave;
    measured.set('defense.minHeld', Math.min(measured.get('defense.minHeld') ?? 100, share(held, N)));
    measured.set('defense.maxLeaked', Math.max(measured.get('defense.maxLeaked') ?? 0, leaked / N));
    measured.set('defense.maxSeconds', Math.max(measured.get('defense.maxSeconds') ?? 0, ticks / N / data.game.ticksPerSecond));
    console.log(`${pad(wave, 12)}${pad(pct(held, N), 10)}${pad((leaked / N).toFixed(1), 9)}${pad((depth / N).toFixed(1), 9)}${pad(`${(ticks / N / data.game.ticksPerSecond).toFixed(0)} s`, 9)}${state.towers.map((t) => `${t.def}${t.level}`).join(' ') || '(keine)'}`);
  });
}

// ---------- 2. Nachtangriff ----------
const end = playTutorial(createGame(1, 0, data), data, 'freies_spiel').game;
head(`2. Nachtangriff (${N} Startwerte, ohne Eingaben)`);
console.log(`${pad('Stadt', 34)}${pad('gehalten', 10)}Tiefe 0/1/2/3`);
{
  const variants: [string, string, GameState][] = [
    ['end', 'Ende des Ablaufs', end],
    ['nohero', 'ohne Heldin im Abschnitt', { ...end, hero: { joined: true, section: null } }],
    ['basic', 'ohne Wachstube und Pechnase', { ...end, towers: end.towers.filter((t) => t.def !== 'wachstube' && t.def !== 'pechnase') }],
    ['two', 'nur die zwei ersten Bogentürme', { ...end, towers: end.towers.slice(0, 2) }],
    ['none', 'ohne Türme', { ...end, towers: [] }],
  ];
  for (const [key, name, state] of variants) {
    let held = 0;
    const depths = [0, 0, 0, 0];
    for (let seed = 1; seed <= N; seed++) {
      const final = runBattle(raidSetup(state, data), seed, [], data);
      if (final.result === 'held') held++;
      depths[final.depth]! += 1;
    }
    measured.set(`raid.${key}.held`, share(held, N));
    measured.set(`raid.${key}.d2`, share(depths[2]! + depths[3]!, N));
    measured.set(`raid.${key}.d3`, share(depths[3]!, N));
    console.log(`${pad(name, 34)}${pad(pct(held, N), 10)}${depths.map((d) => pct(d, N).trim()).join(' / ')}`);
  }
}

// ---------- 3. Angriffe ----------
head('3. Angriffe (Wellenabstand 20 bis 200 Ticks in 20er-Schritten; Angriffe haben keinen Zufall)');
console.log(`${pad('Ziel', 16)}${pad('Armee', 25)}${pad('Spielweise', 18)}${pad('Tiefe 0/1/2/3', 24)}Ø Gefallene`);
{
  const armies: [string, string, Record<string, number>][] = [
    ['tutorial', 'Tutorial (6/4/2)', { leicht: 6, gepanzert: 4, ramme: 2 }],
    ['double', 'doppelt (12/8/4)', { leicht: 12, gepanzert: 8, ramme: 4 }],
    ['noram', 'ohne Rammböcke (12/8/0)', { leicht: 12, gepanzert: 8, ramme: 0 }],
  ];
  const noAbilities = (gap: number): Policy => (b) => (b.releasedWaves < b.setup.waves.length && b.tick >= b.releasedWaves * gap ? { type: 'ReleaseWave' } : null);
  const styles: [string, string, (gap: number) => Policy][] = [['plain', 'ohne Fähigkeiten', noAbilities], ['skilled', 'mit Fähigkeiten', (gap) => skilledAttack(gap, data)]];
  for (const camp of data.camps.camps.filter((c) => !c.shielded)) {
    for (const [armyKey, armyName, ready] of armies) {
      const state: GameState = { ...end, army: { ...end.army, ready } };
      const lineup = defaultLineup(state, data);
      for (const [styleKey, styleName, style] of styles) {
        const depths = [0, 0, 0, 0];
        let fallen = 0, runs = 0;
        for (let gap = 20; gap <= 200; gap += 20) {
          const { final } = playBattle(attackSetup(state, camp.id, lineup, data), 1, data, style(gap));
          depths[final.depth]! += 1;
          fallen += final.fallen.length;
          runs++;
        }
        const key = `attack.${camp.id}.${armyKey}.${styleKey}`;
        measured.set(`${key}.d1`, share(depths[1]! + depths[2]! + depths[3]!, runs));
        measured.set(`${key}.d2`, share(depths[2]! + depths[3]!, runs));
        measured.set(`${key}.d3`, share(depths[3]!, runs));
        measured.set(`${key}.fallen`, Math.round((fallen / runs) * 10) / 10);
        console.log(`${pad(camp.id, 16)}${pad(armyName, 25)}${pad(styleName, 18)}${pad(depths.map((d) => pct(d, runs).trim()).join(' / '), 24)}${(fallen / runs).toFixed(1)}`);
      }
    }
  }
}

// ---------- 4. Turm gegen Truppe ----------
head('4. Turm gegen Truppe: Schaden / Besiegte (Türme Stufe 1 auf s3, Zweitturm auf s7, 12 Einheiten)');
{
  const units = ['leicht', 'gepanzert', 'ramme'];
  const formations: [string, string, number][] = [['single', 'einzeln', 30], ['dense', 'dicht', 4]];
  console.log(`${pad('Turm', 12)}${units.flatMap((u) => formations.map(([, f]) => pad(`${u} ${f}`, 20))).join('')}`);
  const rows: [string, BattleSetup['towers']][] = data.towers.towers.map((tw) => [tw.id, [{ slot: 's3', def: tw.id, level: 1 }]]);
  // Kombinationen: Pechnase und Wachstube wirken vor allem zusammen mit einem Turm, der Schaden macht.
  rows.push(['bogen+pech', [{ slot: 's3', def: 'bogenturm', level: 1 }, { slot: 's7', def: 'pechnase', level: 1 }]]);
  rows.push(['bogen+wache', [{ slot: 's3', def: 'bogenturm', level: 1 }, { slot: 's7', def: 'wachstube', level: 1 }]]);
  rows.push(['bogen+bogen', [{ slot: 's3', def: 'bogenturm', level: 1 }, { slot: 's7', def: 'bogenturm', level: 1 }]]);
  for (const [name, towers] of rows) {
    const cells: string[] = [];
    for (const unit of units) {
      for (const [formKey, , interval] of formations) {
        const setup: BattleSetup = {
          playerSide: 'attacker', roadId: 'westschleife', keepLevel: 2, towers, gold: 0, keepHp: 99, unlosable: false,
          holdMilliUntilTower: 0, heroSection: null, gateHp: 0, waves: [{ groups: [{ unit, count: 12, startTick: 0, intervalTicks: interval, jitterTicks: 0 }] }],
          autoRelease: true, abilities: [], maxTicks: 4000,
        };
        // Schaden mitzählen: Lebenspunkte, die den Angreifern von Tick zu Tick fehlen.
        const maxHp = data.units.units.find((x) => x.id === unit)!.hp;
        let state = createBattle(setup, 1, data);
        let damage = 0;
        while (state.result === 'running') {
          const next = stepBattle(state, [], data);
          const fell = next.fallen.length - state.fallen.length;
          const hpBefore = new Map(state.units.map((x) => [x.id, x.hp]));
          for (const x of next.units) {
            const was = hpBefore.get(x.id) ?? maxHp;
            damage += was - x.hp;
          }
          // Gefallene: ihr Rest an Lebenspunkten zählt als Schaden dieses Ticks.
          if (fell > 0) {
            const gone = state.units.filter((x) => !next.units.some((y) => y.id === x.id));
            const leaked = next.leaked - state.leaked;
            const dead = gone.sort((p, q) => p.hp - q.hp).slice(0, gone.length - leaked);
            for (const x of dead) damage += x.hp;
          }
          state = next;
        }
        measured.set(`matrix.${name}.${unit}.${formKey}`, share(damage, 12 * maxHp));
        cells.push(pad(`${pct(damage, 12 * maxHp).trim()} / ${pct(state.fallen.length, 12).trim()}`, 20));
      }
    }
    console.log(`${pad(name, 12)}${cells.join('')}`);
  }
  console.log('Lesehilfe: erster Wert = Anteil der Lebenspunkte, den die Türme den Angreifern abnehmen; zweiter Wert = Anteil besiegter Einheiten.');
}

// Kosten als Bezugsgröße
head('Bezugsgrößen');
for (const tower of data.towers.towers) console.log(`${pad(tower.id, 12)}Kosten ${tower.levels.map((l) => l.cost).join(' / ')} Gold`);
console.log(`Verlustgrenze: höchstens ${data.rules.lootMaxPermille / 10} % der ungeschützten Vorräte, eigene Stadt erst ab Tiefe ${data.rules.cityLossMinDepth}`);

// ---------- Zielwerte ----------
interface Target {
  readonly metric: string;
  readonly text: string;
  readonly min?: number;
  readonly max?: number;
  /** Der Messwert muss mindestens `factor` mal so groß sein wie dieser andere Messwert. */
  readonly atLeast?: { readonly metric: string; readonly factor: number };
}
head('Zielwerte (scripts/balance-targets.json)');
const targets = JSON.parse(readFileSync(join(import.meta.dirname, 'balance-targets.json'), 'utf8')) as { targets: Target[] };
let missed = 0;
for (const target of targets.targets) {
  const value = measured.get(target.metric);
  let ok = value !== undefined;
  let want = '';
  if (target.min !== undefined) { want += `≥ ${target.min} `; ok = ok && value! >= target.min; }
  if (target.max !== undefined) { want += `≤ ${target.max} `; ok = ok && value! <= target.max; }
  if (target.atLeast) {
    const other = measured.get(target.atLeast.metric) ?? 0;
    want += `≥ ${target.atLeast.factor} × ${other} `;
    ok = ok && value! >= other * target.atLeast.factor;
  }
  if (!ok) missed++;
  console.log(`${ok ? 'erfüllt ' : 'VERFEHLT'}  ${pad(target.text, 78)} ist ${value ?? '?'}, soll ${want.trim()}`);
}
console.log(missed === 0 ? '\nAlle Zielwerte erfüllt.' : `\n${missed} Zielwert(e) verfehlt.`);
if (process.argv.includes('--check') && missed > 0) process.exit(1);
