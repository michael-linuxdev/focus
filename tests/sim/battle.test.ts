import { describe, expect, it } from 'vitest';
import {
  createBattle, hashBattle, makeReplay, roadLengthMilli, roadPointMilli, rngFromSeed, rngInt, runBattle, stepBattle, validateBattleAction, verifyReplay,
  type BattleAction, type BattleInput, type BattleSetup,
} from '../../src/sim/index.ts';
import { data } from './testdata.ts';

const base: BattleSetup = {
  roadId: 'dorf_1', waveId: 'dorf_w2', towers: [], gold: 100, keepHp: 10,
  unlosable: false, autoRelease: false, holdMilliUntilTower: 0,
};
const build = (slot: string): BattleAction => ({ type: 'BuildTower', slot, tower: 'bogenturm' });
const inputs: BattleInput[] = [
  { tick: 0, action: build('s1') },
  { tick: 1, action: build('s2') },
  { tick: 2, action: { type: 'ReleaseWave' } },
];

describe('Straße', () => {
  const road = data.roads.roads[0]!;
  it('Länge und Punkte sind ganzzahlig', () => {
    expect(roadLengthMilli(road)).toBe(23000);
    expect(roadPointMilli(road, 0)).toEqual([4000, 0]);
    expect(roadPointMilli(road, 3500)).toEqual([3500, 3000]);
    expect(roadPointMilli(road, 99999)).toEqual([4000, 13000]);
  });
  it('schräge Abschnitte werden abgelehnt', () => {
    expect(() => roadLengthMilli({ id: 'x', waypoints: [[0, 0], [1, 1]], towerSlots: [] })).toThrow();
  });
});

describe('Schlacht, fester Zeitschritt', () => {
  it('dieselbe Wiederholung liefert immer dasselbe Ergebnis', () => {
    const a = runBattle(base, 42, inputs, data);
    const b = runBattle(base, 42, inputs, data);
    expect(a.result).toBe('won');
    expect(a).toEqual(b);
    expect(hashBattle(a)).toBe(hashBattle(b));
  });

  it('Referenz-Wiederholung hat festes Ergebnis (Prüffall für die C#-Fassung)', () => {
    const final = runBattle(base, 42, inputs, data);
    expect({ tick: final.tick, hash: hashBattle(final), gold: final.gold, killed: final.killed, leaked: final.leaked }).toMatchInlineSnapshot(`
      {
        "gold": 50,
        "hash": 2274043726,
        "killed": 10,
        "leaked": 0,
        "tick": 431,
      }
    `);
  });

  it('anderer Startwert oder andere Eingaben ändern den Verlauf', () => {
    const ref = hashBattle(runBattle(base, 42, inputs, data, 200));
    expect(hashBattle(runBattle(base, 43, inputs, data, 200))).not.toBe(ref);
    expect(hashBattle(runBattle(base, 42, [inputs[0]!, { tick: 3, action: { type: 'ReleaseWave' } }], data, 200))).not.toBe(ref);
  });

  it('eine Wiederholung lässt sich nachrechnen, eine verfälschte fällt auf', () => {
    const final = runBattle(base, 42, inputs, data);
    const replay = JSON.parse(JSON.stringify(makeReplay(base, 42, inputs, final, data)));
    expect(verifyReplay(replay, data)).toBe('ok');
    expect(verifyReplay({ ...replay, seed: 41 }, data)).toBe('result_mismatch');
    expect(verifyReplay({ ...replay, setup: { ...replay.setup, gold: 9999 } }, data)).toBe('result_mismatch');
    expect(verifyReplay({ ...replay, dataVersion: '0' }, data)).toBe('data_version_mismatch');
  });

  it('der Eingangszustand bleibt unberührt', () => {
    const start = createBattle(base, 1, data);
    const frozen = JSON.stringify(start);
    stepBattle(start, [build('s1'), { type: 'ReleaseWave' }], data);
    expect(JSON.stringify(start)).toBe(frozen);
  });
});

describe('Aktionen in der Schlacht', () => {
  it('Bauen und Ausbauen kosten Gold und werden geprüft', () => {
    let s = createBattle(base, 1, data);
    expect(validateBattleAction(s, build('gibt_es_nicht'), data)).toBe('unknown_slot');
    expect(validateBattleAction(s, { type: 'BuildTower', slot: 's1', tower: 'kanone' }, data)).toBe('unknown_tower');
    expect(validateBattleAction(s, { type: 'UpgradeTower', slot: 's1' }, data)).toBe('slot_empty');
    s = stepBattle(s, [build('s1')], data);
    expect(s.gold).toBe(50);
    expect(validateBattleAction(s, build('s1'), data)).toBe('slot_occupied');
    expect(validateBattleAction(s, { type: 'UpgradeTower', slot: 's1' }, data)).toBe('not_enough_gold');
    const rich = { ...s, gold: 200 };
    const up = stepBattle(rich, [{ type: 'UpgradeTower', slot: 's1' }], data);
    expect(up.gold).toBe(120);
    expect(up.towers[0]!.level).toBe(2);
    expect(validateBattleAction(up, { type: 'UpgradeTower', slot: 's1' }, data)).toBe('max_level');
  });

  it('ungültige Eingaben ändern nichts', () => {
    const s = stepBattle(createBattle({ ...base, gold: 0 }, 1, data), [{ type: 'ReleaseWave' }], data);
    expect(validateBattleAction(s, { type: 'ReleaseWave' }, data)).toBe('wave_already_released');
    expect(stepBattle(s, [{ type: 'ReleaseWave' }, build('s1'), { type: 'UpgradeTower', slot: 's2' }], data)).toEqual(stepBattle(s, [], data));
  });

  it('Gold am Ende = Start - Baukosten + Kopfgeld je besiegtem Angreifer', () => {
    const final = runBattle(base, 7, inputs, data);
    expect(final.gold).toBe(100 - 50 - 50 + final.killed * 5);
    expect(final.killed + final.leaked).toBe(10);
  });

  it('ohne Türme fällt der Burgfried, wenn die Schlacht verlierbar ist', () => {
    const final = runBattle({ ...base, waveId: 'dorf_loop' }, 1, [{ tick: 0, action: { type: 'ReleaseWave' } }], data);
    expect(final.result).toBe('lost');
    expect(final.keepHp).toBe(0);
  });
});

describe('Haltepunkt und Unverlierbarkeit', () => {
  const first: BattleSetup = { ...base, waveId: 'dorf_w1', gold: 50, unlosable: true, autoRelease: true, holdMilliUntilTower: 2400 };

  it('ohne ersten Turm warten die Räuber am Haltepunkt, beliebig lange', () => {
    const s = runBattle(first, 3, [], data, 3000);
    expect(s.result).toBe('running');
    expect(s.units.length).toBe(2);
    expect(s.pending.length).toBe(2);
    expect(s.units[0]!.pos).toBe(2400);
    expect(s.leaked).toBe(0);
  });

  it('mit dem ersten Turm geht es weiter und endet mit einem Sieg', () => {
    const s = runBattle(first, 3, [{ tick: 400, action: build('s1') }], data);
    expect(s.result).toBe('won');
    expect(s.killed).toBe(4);
    expect(s.leaked).toBe(0);
    // Warten kostet nichts: gleiches Ergebnis wie bei sofortigem Bau.
    expect(runBattle(first, 3, [{ tick: 0, action: build('s1') }], data).killed).toBe(4);
  });

  it('unverlierbare Schlachten gehen bei beliebigen Eingaben nie verloren', () => {
    const slots = ['s1', 's2', 's3', 's4', 's5', 'x'];
    for (let seed = 1; seed <= 60; seed++) {
      const rng = rngFromSeed(seed);
      const random: BattleInput[] = [];
      for (let tick = 0; tick < 1500; tick += 1 + rngInt(rng, 40)) {
        const slot = slots[rngInt(rng, slots.length)]!;
        const kind = rngInt(rng, 3);
        random.push({ tick, action: kind === 0 ? build(slot) : kind === 1 ? { type: 'UpgradeTower', slot } : { type: 'ReleaseWave' } });
      }
      for (const waveId of ['dorf_w1', 'dorf_w2', 'dorf_w3']) {
        const s = runBattle({ ...first, waveId, autoRelease: waveId === 'dorf_w1', holdMilliUntilTower: waveId === 'dorf_w1' ? 2400 : 0 }, seed, random, data);
        expect(s.result).not.toBe('lost');
        expect(s.keepHp).toBe(10);
      }
    }
  });
});
