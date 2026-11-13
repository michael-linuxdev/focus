import { describe, expect, it } from 'vitest';
import { createGame, reduceGame } from '../../src/sim/index.ts';

describe('Spielzustand und Aktionen', () => {
  it('die Zeit läuft nur vorwärts', () => {
    const g = createGame(1, 1000);
    expect(reduceGame(g, { type: 'AdvanceTime', now: 2000 }).state.now).toBe(2000);
    const back = reduceGame(g, { type: 'AdvanceTime', now: 999 });
    expect(back.error).toBe('time_runs_backwards');
    expect(back.state).toBe(g);
  });

  it('FinishBattle zählt hoch und wechselt den Startwert', () => {
    const g = createGame(1, 0);
    const next = reduceGame(g, { type: 'FinishBattle', arrived: 3 }).state;
    expect(next.battlesFinished).toBe(1);
    expect(next.nextSeed).not.toBe(g.nextSeed);
    expect(reduceGame(g, { type: 'FinishBattle', arrived: -1 }).error).toBe('invalid_payload');
  });
});
