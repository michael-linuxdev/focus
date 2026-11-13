import { STATE_VERSION, createGame, type GameData, type GameState } from '../sim/index.ts';

/**
 * Speicherstand lokal auf dem Gerät, mit Versionsnummer und Migrationen.
 * `migrations[n]` hebt einen Stand von Version n auf n + 1. Ein Update darf keinen Stand zerstören:
 * Unlesbares wird unter einem Sicherungsschlüssel aufbewahrt statt überschrieben.
 */
export const SAVE_KEY = 'mk.save';
export const SAVE_BACKUP_KEY = 'mk.save.unlesbar';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type Migration = (old: Record<string, unknown>, data: GameData) => Record<string, unknown>;

export const migrations: Readonly<Record<number, Migration>> = {
  // 1 -> 2 (M1): Der M0-Stand kannte nur Uhr und Startwert. Stadt und Gold beginnen mit den Startwerten.
  1: (old, data) => ({
    ...createGame(typeof old['nextSeed'] === 'number' ? old['nextSeed'] : 1, typeof old['now'] === 'number' ? old['now'] : 0, data),
    version: 2,
  }),
};

export function migrate(
  raw: unknown,
  data: GameData,
  targetVersion: number = STATE_VERSION,
  steps: Readonly<Record<number, Migration>> = migrations,
): GameState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  let cur = raw as Record<string, unknown>;
  for (;;) {
    const v = cur['version'];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > targetVersion) return null;
    if (v === targetVersion) return cur as unknown as GameState;
    const step = steps[v];
    if (!step) return null;
    cur = step(cur, data);
  }
}

export function loadGame(store: KeyValueStore, data: GameData): GameState | null {
  const text = store.getItem(SAVE_KEY);
  if (text === null) return null;
  let state: GameState | null = null;
  try {
    state = migrate(JSON.parse(text), data);
  } catch {
    state = null;
  }
  if (state === null) store.setItem(SAVE_BACKUP_KEY, text);
  return state;
}

export function saveGame(store: KeyValueStore, state: GameState): void {
  store.setItem(SAVE_KEY, JSON.stringify(state));
}
