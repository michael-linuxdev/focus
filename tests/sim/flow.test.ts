import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createGame, hasBuilding, readyTroops, verifyReplay } from '../../src/sim/index.ts';
import { playTutorial } from './bot.ts';
import { data } from './testdata.ts';

describe('Geführter Ablauf, Minute 0 bis 15', () => {
  it('wer den Hinweisen folgt, kommt ohne Sackgasse bis ins freie Spiel', () => {
    const run = playTutorial(createGame(11, 0, data), data, 'freies_spiel');
    if (process.env['FLOW_LOG']) writeFileSync(process.env['FLOW_LOG'], run.log.join('\n') + `\nSchlachten (Ticks): ${run.battleTicks.join(', ')}\n`);
    const g = run.game;
    expect(g.defensesWon).toBe(5);
    expect(g.attacksDone).toBe(1);
    expect(g.keepLevel).toBe(2);
    expect(g.hero).toEqual({ joined: true, section: 'nord' });
    expect(hasBuilding(g, 'holzfaeller') && hasBuilding(g, 'steinbruch') && hasBuilding(g, 'kaserne')).toBe(true);
    expect(g.towers.some((t) => t.def === 'katapult')).toBe(true);
    // Der Ablauf verlangt keine langen Wartezeiten auf Rohstoffe.
    expect(run.waitedSeconds).toBeLessThanOrEqual(150);
    // Eine Runde dauert höchstens 90 Sekunden.
    expect(Math.max(...run.battleTicks)).toBeLessThanOrEqual(90 * data.game.ticksPerSecond);
    for (const r of g.replays) expect(verifyReplay(r.replay, data)).toBe('ok');
  });

  it('die ersten zehn Minuten (bis zur Heldin) sind bei jedem Startwert und jedem Straßenverlauf nicht verlierbar', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const run = playTutorial(createGame(seed, 0, data), data, 'kaserne', seed);
      expect(run.breached).toBe(0);
      expect(run.game.defensesWon).toBe(5);
    }
  });

  it('der erste Angriff bringt Beute und kostet keine Truppen dauerhaft', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const before = playTutorial(createGame(seed, 0, data), data, 'erster_angriff');
      const total = (g: typeof before.game): number =>
        data.troops.troops.reduce((sum, t) => sum + readyTroops(g, t.unit) + g.army.hospital.filter((h) => h.unit === t.unit).reduce((n, h) => n + h.count, 0), 0);
      const after = playTutorial(before.game, data, 'freies_spiel');
      const outcome = after.game.lastAttack!;
      expect(outcome.depth).toBeGreaterThanOrEqual(1);
      expect(outcome.loot.gold).toBeGreaterThan(0);
      expect(total(after.game)).toBe(total(before.game));
    }
  });
});
