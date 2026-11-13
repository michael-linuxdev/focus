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

  it('Stände aus M0 und M1 werden übernommen statt verworfen', () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, JSON.stringify({ version: 1, now: 5000, nextSeed: 77, battlesFinished: 3 }));
    expect(loadGame(store, data)).toEqual(createGame(77, 5000, data));
    expect(store.map.has(SAVE_BACKUP_KEY)).toBe(false);

    const m1 = { version: 2, now: 9000, nextSeed: 5, gold: 120, wavesWon: 3, lastDefense: null,
      towers: [{ slot: 's1', def: 'bogenturm', level: 2 }, { slot: 's2', def: 'bogenturm', level: 1 }] };
    store.setItem(SAVE_KEY, JSON.stringify(m1));
    const loaded = loadGame(store, data)!;
    expect(loaded.version).toBe(6);
    expect(loaded.resources).toEqual({ gold: 120, wood: 0, stone: 0 });
    expect(loaded.towers).toEqual(m1.towers);
    expect(loaded.defensesWon).toBe(3);
    // Der Spieler landet dort, wo er im Ablauf stand: beim Holzfäller.
    expect(data.tutorial.steps[loaded.tutorialStep]!.id).toBe('holzfaeller');
  });

  it('ein Stand aus M3 (Version 3) behält alles und bekommt die neuen Felder', () => {
    const store = memoryStore();
    const now = 1_700_000_000_000;
    const m3 = {
      version: 3, now, nextSeed: 9, resources: { gold: 240, wood: 100, stone: 95 },
      towers: [{ slot: 's1', def: 'bogenturm', level: 2 }, { slot: 's3', def: 'katapult', level: 1 }],
      buildings: [{ plot: 'p1', def: 'holzfaeller', doneAt: now - 5000, producedUntil: now - 5000 }],
      keepLevel: 2, keepDoneAt: null, roadId: 'westschleife', roadChoicePending: false, hero: { joined: true, section: 'mitte' },
      army: { ready: { leicht: 6, gepanzert: 4, ramme: 2 }, training: null, hospital: [] },
      defensesWon: 5, attacksDone: 1, tutorialStep: 17, replays: [], nextReplayId: 7, lastAttack: null,
    };
    store.setItem(SAVE_KEY, JSON.stringify(m3));
    const loaded = loadGame(store, data)!;
    expect(loaded.version).toBe(6);
    expect(loaded.resources).toEqual(m3.resources);
    expect(loaded.roadId).toBe('westschleife');
    expect(loaded.army.ready).toEqual(m3.army.ready);
    expect(loaded.buildings[0]).toMatchObject({ def: 'holzfaeller', helpRequestedAt: null, helpsReceived: 0 });
    expect(loaded.raidsResolved).toBe(0);
    expect(loaded.shieldUntil).toBe(now + data.rules.newPlayerShieldHours * 3_600_000);
    expect(loaded.daily.counters).toEqual({ defenses: 0, attacks: 0, built: 0, trained: 0 });
    // Der Ablauf geht dort weiter, wo M3 endete: bei der Weltkarte.
    expect(data.tutorial.steps[loaded.tutorialStep]!.id).toBe('weltkarte');
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
