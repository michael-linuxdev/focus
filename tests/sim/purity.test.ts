import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architekturregel: `src/sim/` kennt weder Darstellung noch Uhr, Zufall oder Speicher
 * und rechnet nicht mit Gleitkomma-Funktionen, deren Ergebnis vom Gerät abhängen kann.
 */
const simDir = join(import.meta.dirname, '..', '..', 'src', 'sim');

const forbidden: readonly [RegExp, string][] = [
  [/\bMath\.(random|sqrt|sin|cos|tan|atan2?|pow|exp|log\w*|hypot|cbrt|fround)\b/, 'Zufall oder Gleitkomma-Funktion'],
  [/\bDate\b|\bperformance\b|\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/, 'Uhrzeit'],
  [/\b(window|document|navigator|localStorage|sessionStorage|indexedDB|fetch|crypto|console)\b/, 'Umgebung'],
  [/\bparseFloat\b|\btoFixed\b/, 'Gleitkomma'],
];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

describe('Reinheit der Spiellogik', () => {
  it.each(files(simDir).map((f) => relative(simDir, f)))('%s', (file) => {
    const code = readFileSync(join(simDir, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    for (const [pattern, what] of forbidden) {
      expect(code.match(pattern)?.[0], `${what} in src/sim/${file}`).toBeUndefined();
    }
    for (const m of code.matchAll(/from\s+'([^']+)'/g)) {
      const target = m[1]!;
      expect(target.startsWith('.'), `Fremdimport ${target}`).toBe(true);
      expect(relative(simDir, join(simDir, file, '..', target)).startsWith('..'), `Import aus ${target} verlässt src/sim`).toBe(false);
    }
  });
});
