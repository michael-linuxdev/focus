import { describe, expect, it } from 'vitest';
import { MAX_CATCH_UP_TICKS, consumeTicks } from '../../src/app/loop.ts';

describe('Zeitschritt-Budget', () => {
  it('die Tickzahl hängt nicht von der Bildrate ab', () => {
    const run = (frameMs: number, totalMs: number): number => {
      let rest = 0;
      let ticks = 0;
      for (let elapsed = 0; elapsed < totalMs; elapsed += frameMs) {
        const b = consumeTicks(rest, frameMs, 50);
        rest = b.restMs;
        ticks += b.ticks;
      }
      return ticks;
    };
    expect(run(10, 3000)).toBe(60);
    expect(run(20, 3000)).toBe(60);
    expect(run(100, 3000)).toBe(60);
  });

  it('nach einem Hänger wird begrenzt nachgeholt', () => {
    expect(consumeTicks(0, 60000, 50)).toEqual({ ticks: MAX_CATCH_UP_TICKS, restMs: 0 });
    expect(consumeTicks(0, -5, 50)).toEqual({ ticks: 0, restMs: 0 });
  });
});
