import { describe, expect, it } from 'vitest';
import {
  createBattle, createGame, defenseDef, defenseSetup, findById, growPermille, isBossWave, raidSetup, reduceGame, runBattle, scaledDefense, scaledWave, stepBattle, unitMaxHp, waveNumber, wavesUnlocked,
  type GameState,
} from '../../src/sim/index.ts';
import { loadGame, SAVE_KEY } from '../../src/app/save.ts';
import { activeDefense, playBattle, playTutorial } from './bot.ts';
import { data } from './testdata.ts';

const sc = data.waves.scaling;
const end = playTutorial(createGame(7, 0, data), data, 'freies_spiel', 0, true).game;
const totalHp = (index: number, raid = false): number => {
  const w = scaledWave(index, data, raid);
  return w.groups.reduce((n, g) => n + g.count * findById(data.units.units, g.unit, 'Einheit').hp, 0) * w.hpPermille;
};

describe('M8: berechnete Wellen', () => {
  it('dieselbe Nummer ergibt immer dieselbe Welle; spätere Wellen sind stärker', () => {
    expect(scaledWave(7, data)).toEqual(scaledWave(7, data));
    for (let i = 0; i < 47; i++) {
      // Wellen mit Anführer fallen aus der Reihe; verglichen wird mit der nächsten gewöhnlichen.
      if (isBossWave(i, data) || isBossWave(i + 1, data)) continue;
      expect(scaledWave(i + 1, data).hpPermille).toBeGreaterThan(scaledWave(i, data).hpPermille);
    }
    expect(totalHp(40)).toBeGreaterThan(totalHp(4) * 4);
    expect(growPermille(1000, 1100, 2)).toBe(1210);
    expect(growPermille(7, 1500, 1)).toBe(10); // abschneidend
  });

  it('eine Welle bleibt überschaubar: nicht mehr als 120 Angreifer, alle Einheiten sind bekannt', () => {
    for (let i = 0; i < 48; i++) {
      const w = scaledWave(i, data);
      expect(w.groups.reduce((n, g) => n + g.count, 0)).toBeLessThanOrEqual(120);
      for (const g of w.groups) {
        findById(data.units.units, g.unit, 'Einheit');
        expect(g.count).toBeGreaterThanOrEqual(1);
        expect(g.intervalTicks).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('neue Gegner kommen erst später dazu; die letzte Welle jeder Burgfried-Stufe führt der Hauptmann an', () => {
    const ritter = sc.units.find((u) => u.unit === 'ritter')!;
    expect(scaledWave(ritter.fromWave - 1, data).groups.some((g) => g.unit === 'ritter')).toBe(false);
    expect(scaledWave(ritter.fromWave, data).groups.some((g) => g.unit === 'ritter')).toBe(true);
    for (let i = 0; i < 24; i++) {
      const w = scaledWave(i, data);
      expect(w.boss).toBe(i % sc.wavesPerKeepLevel === sc.wavesPerKeepLevel - 1);
      expect(w.groups.some((g) => g.unit === sc.boss.unit)).toBe(w.boss);
    }
    expect(wavesUnlocked(1, data)).toBe(0);
    expect(wavesUnlocked(3, data)).toBe(2 * sc.wavesPerKeepLevel);
  });

  it('die Angreifer einer berechneten Welle sind zäher, und die Schlacht bleibt nachrechenbar', () => {
    const setup = defenseSetup({ ...end, wavesCleared: 3 }, data);
    expect(setup.unitHpPermille).toBe(scaledWave(3, data).hpPermille);
    let b = createBattle(setup, 5, data);
    while (b.units.length === 0) b = stepBattle(b, [], data);
    const u = b.units[0]!;
    expect(u.hp).toBe(unitMaxHp(findById(data.units.units, u.def, 'Einheit').hp, setup));
    expect(u.hp).toBeGreaterThan(findById(data.units.units, u.def, 'Einheit').hp);
    expect(runBattle(setup, 5, [], data)).toEqual(runBattle(setup, 5, [], data));
    // Setups des geführten Ablaufs tragen das Feld nicht: alte Wiederholungen bleiben gültig.
    expect('unitHpPermille' in defenseSetup(createGame(1, 0, data), data)).toBe(false);
  });
});

describe('M8: Wellen wachsen mit der Stadt', () => {
  const win = (g: GameState): GameState => {
    const { inputs, final } = playBattle(defenseSetup(g, data), g.nextSeed, data, activeDefense(data));
    expect(final.result).toBe('held');
    return reduceGame(g, { type: 'ResolveDefense', inputs }, data).state;
  };

  it('nach dem geführten Ablauf zählt jede geschlagene neue Welle weiter', () => {
    expect(end.wavesCleared).toBeLessThan(wavesUnlocked(end.keepLevel, data));
    const planned = defenseDef(end, data);
    expect(planned).toMatchObject({ index: end.wavesCleared, repeat: false });
    const next = win(end);
    expect(next.wavesCleared).toBe(end.wavesCleared + 1);
    expect(waveNumber(next, data)).toBe(waveNumber(end, data) + 1);
    expect(next.replays.at(-1)!.replay.setup.waves[0]!.groups).toEqual(planned.groups);
  });

  it('sind alle Wellen der Burgfried-Stufe geschlagen, kommt die letzte gewöhnliche noch einmal: weniger Gold, kein Fortschritt', () => {
    const cap = wavesUnlocked(end.keepLevel, data);
    const done = { ...end, wavesCleared: cap };
    const planned = defenseDef(done, data);
    expect(planned).toMatchObject({ index: cap - 2, repeat: true, boss: false });
    expect(planned.victoryGold).toBeLessThan(scaledDefense(cap - 2, false, data).victoryGold);
    expect(win(done).wavesCleared).toBe(cap);
    // Mit dem nächsten Burgfried geht es weiter.
    expect(defenseDef({ ...done, keepLevel: end.keepLevel + 1 }, data)).toMatchObject({ index: cap, repeat: false });
    // Auf Stufe 1 gibt es noch keine berechneten Wellen: dort bleibt die Übungswelle.
    const early = { ...createGame(1, 0, data), defensesWon: data.tutorial.defenses.length };
    expect(defenseDef(early, data)).toMatchObject({ wave: data.tutorial.afterDefenses.wave, index: null, repeat: true });
  });

  it('Sieggold wächst mit der Welle', () => {
    expect(scaledDefense(30, false, data).victoryGold).toBeGreaterThan(scaledDefense(0, false, data).victoryGold * 5);
  });

  it('der Nachtangriff wächst mit, kommt aber kleiner und ohne Hauptmann', () => {
    expect(raidSetup({ ...end, wavesCleared: sc.raidFromWave - 1 }, data).waves[0]!.groups).toEqual(findById(data.waves.waves, data.rules.nightRaidWave, 'Welle').groups);
    for (const cleared of [sc.raidFromWave, sc.wavesPerKeepLevel, 2 * sc.wavesPerKeepLevel, 30]) {
      const raid = raidSetup({ ...end, wavesCleared: cleared }, data);
      expect(raid.waves[0]!.groups.some((g) => g.unit === sc.boss.unit)).toBe(false);
      expect(totalHp(cleared - 1, true)).toBeLessThan(totalHp(cleared - 1) - (isBossWave(cleared - 1, data) ? findById(data.units.units, sc.boss.unit, 'Einheit').hp * scaledWave(cleared - 1, data).hpPermille : 0));
    }
    expect(totalHp(29, true)).toBeGreaterThan(totalHp(5, true));
  });
});

describe('M8: Verluste in der eigenen Verteidigung', () => {
  it('wer selbst verteidigt und den Burgfried hält, verliert keine Vorräte, auch wenn Angreifer durchkommen', () => {
    expect(data.rules.defenseLossOnlyWhenBreached).toBe(true);
    // Die Stadt am Ende des Ablaufs, ohne Eingreifen: Der Burgfried hält, aber einzelne kommen durch.
    const weak: GameState = { ...end, wavesCleared: 4, resources: { gold: 20_000, wood: 20_000, stone: 20_000 } };
    let leaky: ReturnType<typeof runBattle> | null = null;
    for (let cleared = 0; cleared < 5 && !leaky; cleared++) {
      const final = runBattle(defenseSetup({ ...weak, wavesCleared: cleared }, data), weak.nextSeed, [], data);
      if (final.result === 'held' && final.leaked > 0) leaky = final;
      if (leaky) {
        const after = reduceGame({ ...weak, wavesCleared: cleared }, { type: 'ResolveDefense', inputs: [] }, data).state;
        expect(after.resources.wood).toBe(20_000);
        expect(after.replays.at(-1)!.loot).toEqual({ gold: 0, wood: 0, stone: 0 });
      }
    }
    expect(leaky, 'eine gehaltene Verteidigung mit Durchgekommenen').not.toBeNull();
  });

  it('fällt der Burgfried, gilt die Verlustgrenze wie bisher; im Nachtangriff zählt weiter die Tiefe', () => {
    const naked: GameState = { ...end, towers: [], wavesCleared: 4, raidsResolved: 5, raidDueAt: end.now, resources: { gold: 20_000, wood: 20_000, stone: 20_000 } };
    const lost = reduceGame(naked, { type: 'ResolveDefense', inputs: [] }, data).state;
    expect(lost.replays.at(-1)!.result).toBe('breached');
    expect(lost.resources.wood).toBeLessThan(20_000);
    expect(lost.resources.wood).toBeGreaterThanOrEqual(20_000 - (20_000 * data.rules.lootMaxPermille) / 1000);
    expect(lost.shieldUntil).toBeGreaterThan(naked.now);
    const raided = reduceGame(naked, { type: 'ResolveNightRaid' }, data).state;
    expect(raided.resources.wood).toBeLessThan(20_000);
  });
});

describe('M8: Speicherstand', () => {
  it('ein Stand aus M7 (Version 7) steigt bei den Wellen seiner Burgfried-Stufe ein', () => {
    const { wavesCleared: _w, ...rest } = end;
    const load = (old: object): GameState => {
      const map = new Map([[SAVE_KEY, JSON.stringify(old)]]);
      return loadGame({ getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) }, data)!;
    };
    expect(load({ ...rest, version: 7, defensesWon: 6 }).wavesCleared).toBe(0);
    expect(load({ ...rest, version: 7, defensesWon: 9 }).wavesCleared).toBe(3);
    // Wer schon sehr oft verteidigt hat, überspringt nicht den Anführer seiner Stufe.
    expect(load({ ...rest, version: 7, defensesWon: 80 }).wavesCleared).toBe(wavesUnlocked(end.keepLevel, data) - 1);
  });
});
