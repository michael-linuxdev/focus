import { describe, expect, it } from 'vitest';
import { createGame, currentHint, defenseStep, defenseSetup, createBattle, reduceGame, verifyReplay, type GameState } from '../../src/sim/index.ts';
import { bareMinimum, followHints, playDefense } from './bot.ts';
import { data } from './testdata.ts';

describe('Spielzustand und Aktionen', () => {
  it('die Zeit läuft nur vorwärts', () => {
    const g = createGame(1, 1000, data);
    expect(reduceGame(g, { type: 'AdvanceTime', now: 2000 }, data).state.now).toBe(2000);
    const back = reduceGame(g, { type: 'AdvanceTime', now: 999 }, data);
    expect(back.error).toBe('time_runs_backwards');
    expect(back.state).toBe(g);
  });

  it('eine Verteidigung wird nachgerechnet, nicht geglaubt', () => {
    const g = createGame(5, 0, data);
    expect(reduceGame(g, { type: 'ResolveDefense', inputs: [] }, data).error).toBe('battle_not_finished');
    expect(reduceGame(g, { type: 'ResolveDefense', inputs: [{ tick: 5, action: { type: 'ReleaseWave' } }, { tick: 1, action: { type: 'ReleaseWave' } }] }, data).error).toBe('invalid_payload');
    const { inputs, final } = playDefense(g, data, followHints(data));
    const next = reduceGame(g, { type: 'ResolveDefense', inputs }, data).state;
    expect(next.wavesWon).toBe(1);
    expect(next.gold).toBe(final.gold + 30);
    expect(next.towers).toEqual([{ slot: 's1', def: 'bogenturm', level: 1 }]);
    expect(next.nextSeed).not.toBe(g.nextSeed);
    expect(verifyReplay(next.lastDefense!, data)).toBe('ok');
  });
});

describe('Ablauf Minute 0 bis 3', () => {
  it('der erste Hinweis zeigt auf den ersten Bauplatz, ohne dass der Spieler etwas getan hat', () => {
    const g = createGame(1, 0, data);
    const battle = createBattle(defenseSetup(g, data), g.nextSeed, data);
    expect(battle.released).toBe(true);
    expect(currentHint(defenseStep(g, data), battle, data)).toEqual({ type: 'buildTower', slot: 's1', tower: 'bogenturm' });
  });

  function playTutorial(seed: number, policy: ReturnType<typeof followHints>): { game: GameState; leaked: number; ticks: number[] } {
    let game = createGame(seed, 0, data);
    let leaked = 0;
    const ticks: number[] = [];
    for (let i = 0; i < data.tutorial.defenseSteps.length; i++) {
      const { inputs, final } = playDefense(game, data, policy);
      expect(final.result).toBe('won');
      leaked += final.leaked;
      ticks.push(final.tick);
      const r = reduceGame(game, { type: 'ResolveDefense', inputs }, data);
      expect(r.error).toBeNull();
      game = r.state;
    }
    return { game, leaked, ticks };
  }

  it('wer den Hinweisen folgt, gewinnt alle drei Wellen ohne Durchbruch und kann jeden Hinweis bezahlen', () => {
    let longest = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const { game, leaked, ticks } = playTutorial(seed, followHints(data));
      expect(leaked).toBe(0);
      expect(game.wavesWon).toBe(3);
      expect(game.towers).toEqual([{ slot: 's1', def: 'bogenturm', level: 2 }, { slot: 's2', def: 'bogenturm', level: 1 }]);
      longest = Math.max(longest, ...ticks);
    }
    // Eine Runde dauert höchstens 90 Sekunden.
    expect(longest).toBeLessThanOrEqual(90 * data.game.ticksPerSecond);
  });

  it('auch wer nur das Nötigste tut, verliert nicht', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { game } = playTutorial(seed, bareMinimum(data));
      expect(game.wavesWon).toBe(3);
      expect(game.gold).toBeGreaterThanOrEqual(0);
    }
  });
});
