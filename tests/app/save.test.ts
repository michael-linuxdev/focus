import { describe, expect, it } from 'vitest';
import { SAVE_BACKUP_KEY, SAVE_KEY, loadGame, migrate, saveGame, type KeyValueStore } from '../../src/app/save.ts';
import { createGame } from '../../src/sim/index.ts';
import { gameData as data } from '../../src/app/data.ts';

function memoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

describe('Speicherstand', () => {
  it('überlebt Speichern und Laden', () => {
    const store = memoryStore();
    const g = createGame(99, 123456, data);
    saveGame(store, g);
    expect(loadGame(store, data)).toEqual(g);
  });

  it('alte Stände werden schrittweise angehoben', () => {
    const steps = {
      1: (o: Record<string, unknown>) => ({ ...o, version: 2, a: 1 }),
      2: (o: Record<string, unknown>) => ({ ...o, version: 3, b: 2 }),
    };
    expect(migrate({ version: 1 }, data, 3, steps)).toEqual({ version: 3, a: 1, b: 2 });
  });

  it('ein Stand aus M0 (Version 1) wird übernommen statt verworfen', () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, JSON.stringify({ version: 1, now: 5000, nextSeed: 77, battlesFinished: 3 }));
    expect(loadGame(store, data)).toEqual(createGame(77, 5000, data));
    expect(store.map.has(SAVE_BACKUP_KEY)).toBe(false);
  });

  it('Unlesbares und Stände aus der Zukunft werden gesichert statt zerstört', () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, '{kaputt');
    expect(loadGame(store, data)).toBeNull();
    expect(store.map.get(SAVE_BACKUP_KEY)).toBe('{kaputt');
    expect(migrate({ version: 999 }, data)).toBeNull();
    expect(migrate(null, data)).toBeNull();
  });
});
