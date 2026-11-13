/**
 * Zufallsgenerator mit Startwert: xoshiro128** (Blackman/Vigna, gemeinfrei),
 * Startzustand aus dem Seed über splitmix32.
 *
 * Nur 32-Bit-Operationen ohne Vorzeichen, in C# mit `uint` wortgleich übertragbar
 * (`Math.imul(a, b) >>> 0` entspricht `unchecked(a * b)` auf `uint`).
 * Der Zustand ist ein schlichtes Array aus vier uint32 und Teil des Spielzustands.
 */
export type RngState = [number, number, number, number];

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** Erzeugt den Startzustand aus einem 32-Bit-Seed. */
export function rngFromSeed(seed: number): RngState {
  let z = seed >>> 0;
  const next = (): number => {
    z = (z + 0x9e3779b9) >>> 0;
    let x = z;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  };
  return [next(), next(), next(), next()];
}

/** Nächste uint32. Verändert `s` (nur auf einer Arbeitskopie des Zustands aufrufen). */
export function rngNextU32(s: RngState): number {
  const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
  const t = (s[1] << 9) >>> 0;
  s[2] = (s[2] ^ s[0]) >>> 0;
  s[3] = (s[3] ^ s[1]) >>> 0;
  s[1] = (s[1] ^ s[2]) >>> 0;
  s[0] = (s[0] ^ s[3]) >>> 0;
  s[2] = (s[2] ^ t) >>> 0;
  s[3] = rotl(s[3], 11);
  return result;
}

/**
 * Gleichverteilte Ganzzahl in [0, n). Verwerfungsverfahren ohne Modulo-Schiefe.
 * C#: `ulong limit = 4294967296UL / n * n`.
 */
export function rngInt(s: RngState, n: number): number {
  if (!Number.isInteger(n) || n <= 0 || n > 0x7fffffff) throw new Error('rngInt: n außerhalb [1, 2^31)');
  const limit = Math.floor(4294967296 / n) * n;
  for (;;) {
    const x = rngNextU32(s);
    if (x < limit) return x % n;
  }
}
