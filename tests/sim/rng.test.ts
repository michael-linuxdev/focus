import { describe, expect, it } from 'vitest';
import { rngFromSeed, rngInt, rngNextU32 } from '../../src/sim/index.ts';

describe('Zufall mit Startwert', () => {
  it('liefert feste Referenzwerte (Prüfvektor für die C#-Fassung)', () => {
    const s = rngFromSeed(12345);
    expect([...s]).toMatchInlineSnapshot(`
      [
        1200724404,
        818072533,
        996137225,
        2397394836,
      ]
    `);
    const out = Array.from({ length: 5 }, () => rngNextU32(s));
    expect(out).toMatchInlineSnapshot(`
      [
        518667457,
        440444462,
        4232892992,
        3757857622,
        3939018813,
      ]
    `);
  });

  it('gleicher Startwert, gleiche Folge; anderer Startwert, andere Folge', () => {
    const a = rngFromSeed(7);
    const b = rngFromSeed(7);
    const c = rngFromSeed(8);
    const seqA = Array.from({ length: 100 }, () => rngNextU32(a));
    const seqB = Array.from({ length: 100 }, () => rngNextU32(b));
    const seqC = Array.from({ length: 100 }, () => rngNextU32(c));
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it('rngInt bleibt im Bereich und trifft jeden Wert', () => {
    const s = rngFromSeed(1);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rngInt(s, 6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
    expect(rngInt(s, 1)).toBe(0);
    expect(() => rngInt(s, 0)).toThrow();
  });

  it('alle Ausgaben sind uint32', () => {
    const s = rngFromSeed(0xffffffff);
    for (let i = 0; i < 1000; i++) {
      const v = rngNextU32(s);
      expect(Number.isInteger(v) && v >= 0 && v <= 0xffffffff).toBe(true);
    }
  });
});
