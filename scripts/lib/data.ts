import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameData } from '../../src/sim/index.ts';

/** Lädt die Datendateien für Skripte, die ohne Vite direkt mit Node laufen. */
export function loadData(): GameData {
  const dir = join(import.meta.dirname, '..', '..', 'data');
  const read = (name: string): unknown => JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
  const names = ['game', 'roads', 'city', 'buildings', 'units', 'troops', 'towers', 'hero', 'rules', 'camps', 'waves', 'tutorial', 'alliance', 'goals'];
  return Object.fromEntries(names.map((n) => [n, read(n)])) as unknown as GameData;
}
