import { describe, expect, it } from 'vitest';
import {
  createBattle, hashBattle, makeReplay, roadLengthMilli, roadPointMilli, runBattle, stepBattle, validateBattleAction, verifyReplay,
  type BattleInput, type BattleSetup,
} from '../../src/sim/index.ts';
import { data } from './testdata.ts';

const setup: BattleSetup = { roadId: 'dorf_1', waveId: 'demo_1' };
const inputs: BattleInput[] = [{ tick: 20, action: { type: 'ReleaseWave' } }];

describe('Straße', () => {
  const road = data.roads.roads[0]!;
  it('Länge und Punkte sind ganzzahlig', () => {
    expect(roadLengthMilli(road)).toBe(23000);
    expect(roadPointMilli(road, 0)).toEqual([4000, 0]);
    expect(roadPointMilli(road, 3500)).toEqual([3500, 3000]);
    expect(roadPointMilli(road, 99999)).toEqual([4000, 13000]);
  });
  it('schräge Abschnitte werden abgelehnt', () => {
    expect(() => roadLengthMilli({ id: 'x', waypoints: [[0, 0], [1, 1]] })).toThrow();
  });
});

describe('Schlacht, fester Zeitschritt', () => {
  it('dieselbe Wiederholung liefert immer dasselbe Ergebnis', () => {
    const a = runBattle(setup, 42, inputs, data);
    const b = runBattle(setup, 42, inputs, data);
    expect(a.done).toBe(true);
    expect(a.arrived).toBe(6);
    expect(a).toEqual(b);
    expect(hashBattle(a)).toBe(hashBattle(b));
  });

  it('Referenz-Wiederholung hat festes Ergebnis (Prüffall für die C#-Fassung)', () => {
    const final = runBattle(setup, 42, inputs, data);
    expect({ tick: final.tick, hash: hashBattle(final) }).toMatchInlineSnapshot(`
      {
        "hash": 2437633192,
        "tick": 675,
      }
    `);
  });

  it('anderer Startwert oder anderer Auslösezeitpunkt ändert den Verlauf', () => {
    const base = hashBattle(runBattle(setup, 42, inputs, data, 200));
    expect(hashBattle(runBattle(setup, 43, inputs, data, 200))).not.toBe(base);
    expect(hashBattle(runBattle(setup, 42, [{ tick: 21, action: { type: 'ReleaseWave' } }], data, 200))).not.toBe(base);
  });

  it('eine Wiederholung lässt sich nachrechnen, eine verfälschte fällt auf', () => {
    const final = runBattle(setup, 42, inputs, data);
    const replay = JSON.parse(JSON.stringify(makeReplay(setup, 42, inputs, final, data)));
    expect(verifyReplay(replay, data)).toBe('ok');
    expect(verifyReplay({ ...replay, seed: 41 }, data)).toBe('result_mismatch');
    expect(verifyReplay({ ...replay, dataVersion: '0' }, data)).toBe('data_version_mismatch');
  });

  it('ungültige Eingaben ändern nichts, der Eingangszustand bleibt unberührt', () => {
    const start = createBattle(setup, 1, data);
    const frozen = JSON.stringify(start);
    const released = stepBattle(start, [{ type: 'ReleaseWave' }], data);
    expect(JSON.stringify(start)).toBe(frozen);
    expect(validateBattleAction(released, { type: 'ReleaseWave' })).toBe('wave_already_released');
    const twice = stepBattle(released, [{ type: 'ReleaseWave' }], data);
    const once = stepBattle(released, [], data);
    expect(twice).toEqual(once);
  });

  it('ohne Auslösen läuft die Schlacht nicht los', () => {
    const s = runBattle(setup, 1, [], data, 500);
    expect(s.done).toBe(false);
    expect(s.units.length).toBe(0);
  });
});
