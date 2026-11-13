import { STATE_VERSION, createGame, reduceGame, type GameData, type GameState } from '../sim/index.ts';

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
  // 1 -> 2 (M1): Der M0-Stand kannte nur Uhr und Startwert.
  1: (old) => ({ version: 2, now: num(old['now'], 0), nextSeed: num(old['nextSeed'], 1), gold: null, towers: [], wavesWon: 0 }),
  // 2 -> 3 (M2/M3): Gold wird zu Vorräten, dazu Gebäude, Burgfried, Heldin, Armee und Wiederholungen.
  // Türme, Gold und gewonnene Wellen bleiben; der Tutorial-Schritt ergibt sich daraus beim Laden neu.
  2: (old, data) => {
    const fresh = createGame(num(old['nextSeed'], 1), num(old['now'], 0), data);
    return {
      ...fresh,
      resources: { ...fresh.resources, gold: num(old['gold'], fresh.resources.gold) },
      towers: Array.isArray(old['towers']) ? old['towers'] : [],
      defensesWon: num(old['wavesWon'], 0),
    };
  },
  // 3 -> 4 (M4): Schild, Weltkarte, Allianz, Tagesziele und Nachtangriff kommen dazu; Gebäude merken sich Allianzhilfe.
  3: (old, data) => {
    const fresh = createGame(num(old['nextSeed'], 1), num(old['now'], 0), data);
    const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? (value as Record<string, unknown>[]) : []);
    return {
      ...old,
      version: 4,
      buildings: list(old['buildings']).map((b) => ({ ...b, helpRequestedAt: null, helpsReceived: 0 })),
      replays: list(old['replays']).map((r) => ({ ...r, weakSection: null })),
      shieldUntil: fresh.shieldUntil,
      worldSeen: false,
      allianceJoined: false,
      daily: fresh.daily,
      goalsClaimed: 0,
      raidDueAt: null,
      raidAcknowledged: false,
      raidReport: null,
    };
  },
  // 4 -> 5: Zähler der Nachtangriffe (der erste kostet nichts). Wer schon einen Bericht gesehen hat, hatte seinen ersten.
  4: (old) => ({ ...old, version: 5, raidsResolved: Array.isArray(old['replays']) && old['replays'].some((r) => (r as Record<string, unknown>)['kind'] === 'raid') ? 1 : 0 }),
  // 5 -> 6: Sterne je gespeicherter Schlacht (ältere Schlachten haben keine).
  5: (old) => ({ ...old, version: 6, replays: (Array.isArray(old['replays']) ? (old['replays'] as Record<string, unknown>[]) : []).map((r) => ({ ...r, stars: 0 })) }),
  // 6 -> 7 (M7): Gebäude haben Ausbaustufen.
  6: (old) => ({ ...old, version: 7, buildings: (Array.isArray(old['buildings']) ? (old['buildings'] as Record<string, unknown>[]) : []).map((b) => ({ ...b, level: 1, upgradeDoneAt: null })) }),
  // 7 -> 8 (M8): Zähler der berechneten Wellen. Wer schon weitergespielt hat, steigt bei den Wellen seiner Burgfried-Stufe ein.
  7: (old, data) => {
    const extra = Math.max(0, num(old['defensesWon'], 0) - data.tutorial.defenses.length);
    const unlockedWaves = Math.max(0, num(old['keepLevel'], 1) - 1) * data.waves.scaling.wavesPerKeepLevel;
    return { ...old, version: 8, wavesCleared: Math.min(extra, Math.max(0, unlockedWaves - 1)) };
  },
};

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

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
    // Eine Zeitmeldung rechnet Fälliges ab und bringt den Tutorial-Schritt auf den Stand des geladenen Zustands.
    if (state) state = reduceGame(state, { type: 'AdvanceTime', now: state.now }, data).state;
  } catch {
    state = null;
  }
  if (state === null) store.setItem(SAVE_BACKUP_KEY, text);
  return state;
}

export function saveGame(store: KeyValueStore, state: GameState): void {
  store.setItem(SAVE_KEY, JSON.stringify(state));
}
