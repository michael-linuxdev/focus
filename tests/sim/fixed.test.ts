import { describe, expect, it } from 'vitest';
import { idiv, mulDiv, permille } from '../../src/sim/index.ts';

describe('Ganzzahl-Arithmetik', () => {
  it('idiv schneidet zur Null hin ab, auch bei negativen Zahlen (wie C#)', () => {
    expect(idiv(7, 2)).toBe(3);
    expect(idiv(-7, 2)).toBe(-3);
    expect(idiv(7, -2)).toBe(-3);
    expect(() => idiv(1, 0)).toThrow();
  });

  it('mulDiv und permille liefern Ganzzahlen', () => {
    expect(mulDiv(1000, 333, 1000)).toBe(333);
    expect(mulDiv(999, 999, 1000)).toBe(998);
    expect(permille(1999, 250)).toBe(499);
    expect(() => mulDiv(2 ** 31, 2 ** 31, 1)).toThrow();
  });
});
