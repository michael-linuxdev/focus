import { beforeAll, describe, expect, it } from 'vitest';
import { createGame, verifyReplay, wavesUnlocked } from '../../src/sim/index.ts';
import { playTutorial } from './bot.ts';
import { CASUAL, EAGER, playMonth, type MonthRun } from '../../scripts/lib/month.ts';
import { data } from './testdata.ts';

/**
 * Der erste Spielmonat im Durchlauf (`npm run month`). Hält fest, in welchem Rahmen Wachstum, Wellen und
 * Nachtangriffe liegen sollen. Wer Kosten, Bauzeiten oder `waves.scaling` ändert, misst hier nach.
 */
describe('Der erste Spielmonat im Durchlauf', () => {
  const start = playTutorial(createGame(7, 0, data), data, 'freies_spiel', 0, true).game;
  let casual: MonthRun;
  let eager: MonthRun;
  beforeAll(() => {
    casual = playMonth(start, data, CASUAL);
    eager = playMonth(start, data, EAGER);
  }, 180_000);

  it('ein Gelegenheitsspieler wächst den ganzen Monat: früh schnell, Burgfried 8 erst gegen Ende', () => {
    const day = (level: number): number => casual.keepDay[level] ?? 999;
    expect(day(3)).toBeLessThanOrEqual(2);
    expect(day(4)).toBeLessThanOrEqual(4);
    expect(day(5)).toBeLessThanOrEqual(8);
    expect(day(6)).toBeGreaterThanOrEqual(8);
    expect(day(6)).toBeLessThanOrEqual(15);
    expect(day(7)).toBeGreaterThanOrEqual(14);
    expect(day(7)).toBeLessThanOrEqual(23);
    expect(day(8)).toBeGreaterThanOrEqual(22);
    for (let level = 3; level <= 6; level++) expect(day(level + 1)).toBeGreaterThan(day(level));
    for (const r of casual.game.replays) expect(verifyReplay(r.replay, data)).toBe('ok');
  });

  it('auch wer doppelt so oft spielt, ist nicht nach zwei Wochen fertig', () => {
    expect(eager.keepDay[8] ?? 999).toBeGreaterThanOrEqual(20);
    expect(eager.keepDay[5] ?? 999).toBeLessThanOrEqual(8);
  });

  it('wer eingreift, schlägt die neuen Wellen seiner Burgfried-Stufe, aber nicht immer mit drei Sternen', () => {
    for (const run of [casual, eager]) {
      const total = run.fresh.won + run.fresh.lost;
      expect(total).toBeGreaterThanOrEqual(30);
      expect(run.fresh.won / total).toBeGreaterThanOrEqual(0.85);
      const stars = run.bands.reduce((n, b) => n + b.stars, 0) / total;
      expect(stars).toBeGreaterThanOrEqual(1.8);
      expect(stars).toBeLessThanOrEqual(2.8);
      // Die Wellen wachsen mit: Am Monatsende sind die der erreichten Burgfried-Stufe fast alle geschlagen.
      expect(run.game.wavesCleared).toBeGreaterThanOrEqual(wavesUnlocked(run.game.keepLevel, data) - 6);
      // Jede Stufe hat ihren Anführer gesehen.
      expect(run.bands.filter((b) => b.bossTries > 0).length).toBeGreaterThanOrEqual(run.game.keepLevel - 2);
    }
  });

  it('eine Runde dauert auch spät im Monat keine zwei Minuten', () => {
    for (const band of casual.bands) {
      const n = band.won + band.lost;
      if (n > 0) expect(band.seconds / n).toBeLessThanOrEqual(110);
    }
  });

  it('Nachtangriffe kommen manchmal bis zum Marktplatz, der Burgfried einer gepflegten Stadt fällt dabei nicht', () => {
    for (const run of [casual, eager]) {
      const total = run.raids.held + run.raids.breached;
      expect(total).toBeGreaterThanOrEqual(60);
      expect(run.raids.breached).toBe(0);
      expect(run.raids.market / total).toBeGreaterThanOrEqual(0.03);
      expect(run.raids.market / total).toBeLessThanOrEqual(0.45);
    }
  });
});
