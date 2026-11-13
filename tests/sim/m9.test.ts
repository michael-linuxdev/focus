import { describe, expect, it } from 'vitest';
import { activeGoals, createGame, loginReward, reduceGame, scaledReward, weeklyGoal, type GameAction, type GameState } from '../../src/sim/index.ts';
import { loadGame, SAVE_KEY } from '../../src/app/save.ts';
import { playTutorial } from './bot.ts';
import { data } from './testdata.ts';

const DAY = 86_400_000;
const act = (g: GameState, ...actions: GameAction[]): GameState =>
  actions.reduce((s, a) => {
    const r = reduceGame(s, a, data);
    if (r.error) throw new Error(`${a.type}: ${r.error}`);
    return r.state;
  }, g);
const err = (g: GameState, a: GameAction) => reduceGame(g, a, data).error;
const onDay = (g: GameState, day: number): GameState => act(g, { type: 'AdvanceTime', now: Math.max(g.now, day * DAY + 1000) });
const end = playTutorial(createGame(7, 0, data), data, 'freies_spiel', 0, true).game;

describe('M9: Tagesziele wechseln', () => {
  it('jeden Tag gelten die festen Ziele und einige wechselnde; über die Tage kommt jedes Ziel dran', () => {
    const seen = new Set<string>();
    for (let day = 0; day < 14; day++) {
      const goals = activeGoals(onDay(end, day + 1), data);
      expect(goals.length).toBe(data.goals.dailyFixed + data.goals.dailyRotating);
      expect(new Set(goals.map((g) => g.id)).size).toBe(goals.length);
      expect(goals.slice(0, data.goals.dailyFixed)).toEqual(data.goals.goals.slice(0, data.goals.dailyFixed));
      for (const g of goals) seen.add(g.id);
    }
    expect(seen.size).toBe(data.goals.goals.length);
    expect(activeGoals(onDay(end, 3), data)).not.toEqual(activeGoals(onDay(end, 4), data));
  });

  it('ein Ziel, das heute nicht gilt, lässt sich nicht abholen', () => {
    const g = onDay(end, 2);
    const inactive = data.goals.goals.find((x) => !activeGoals(g, data).some((a) => a.id === x.id))!;
    const done = { ...g, daily: { ...g.daily, counters: { ...g.daily.counters, [inactive.counter]: 999 } } };
    expect(err(done, { type: 'ClaimDailyGoal', goal: inactive.id })).toBe('goal_not_active');
  });

  it('Belohnungen wachsen mit dem Burgfried', () => {
    const goal = data.goals.goals[0]!;
    const low = scaledReward(goal.reward, { ...end, keepLevel: 2 }, data);
    const high = scaledReward(goal.reward, { ...end, keepLevel: 6 }, data);
    expect(high.gold).toBeGreaterThan(low.gold * 5);
    expect(scaledReward(goal.reward, { ...end, keepLevel: 1 }, data)).toEqual(goal.reward); // im geführten Ablauf unverändert
    expect(scaledReward(goal.reward, { ...end, keepLevel: 99 }, data)).toEqual(scaledReward(goal.reward, { ...end, keepLevel: 8 }, data));
  });

  it('Sterne und Türme zählen mit', () => {
    let g = { ...onDay(end, 5), resources: { gold: 50_000, wood: 0, stone: 0 } };
    const tower = g.towers.find((t) => t.level === 1)!;
    g = act(g, { type: 'UpgradeTower', slot: tower.slot });
    expect(g.daily.counters.towers).toBe(1);
    expect(g.weekly.counters.towers).toBe(end.weekly.counters.towers + 1); // die Woche zählt die Türme des Ablaufs mit
  });
});

describe('M9: Wochenziel und Rückkehr', () => {
  it('das Wochenziel zählt über die Tage der Woche, wird einmal abgeholt und wechselt mit der Woche', () => {
    let g = onDay(end, 7);
    const goal = weeklyGoal(g, data);
    expect(err(g, { type: 'ClaimWeeklyGoal' })).toBe('goal_not_reached');
    g = { ...g, weekly: { ...g.weekly, counters: { ...g.weekly.counters, [goal.counter]: goal.count - 1 } } };
    g = onDay(g, 9); // Tageswechsel innerhalb der Woche löscht den Wochenzähler nicht
    expect(g.weekly.counters[goal.counter]).toBe(goal.count - 1);
    g = { ...g, weekly: { ...g.weekly, counters: { ...g.weekly.counters, [goal.counter]: goal.count } } };
    const before = g.resources;
    g = act(g, { type: 'ClaimWeeklyGoal' });
    expect(g.resources.gold - before.gold).toBe(scaledReward(goal.reward, g, data).gold);
    expect(err(g, { type: 'ClaimWeeklyGoal' })).toBe('goal_already_claimed');
    g = onDay(g, 14);
    expect(g.weekly).toMatchObject({ claimed: false, week: 2 });
    expect(weeklyGoal(g, data).id).not.toBe(goal.id);
  });

  it('die Belohnung für die Rückkehr gibt es einmal am Tag; sie wird reihum größer, ein verpasster Tag setzt nichts zurück', () => {
    let g = onDay(end, 20);
    const first = loginReward(g, data)!;
    expect(first).toEqual(scaledReward(data.goals.login[0]!, g, data));
    g = act(g, { type: 'ClaimLoginReward' });
    expect(loginReward(g, data)).toBeNull();
    expect(err(g, { type: 'ClaimLoginReward' })).toBe('login_already_claimed');
    g = onDay(g, 23); // zwei Tage gefehlt
    expect(loginReward(g, data)).toEqual(scaledReward(data.goals.login[1]!, g, data));
    for (let d = 0; d < data.goals.login.length; d++) g = act(onDay(g, 24 + d), { type: 'ClaimLoginReward' });
    expect(g.login.claims).toBe(1 + data.goals.login.length);
    expect(loginReward(onDay(g, 40), data)).toEqual(scaledReward(data.goals.login[1]!, g, data));
  });

  it('ein Stand aus M8 (Version 8) bekommt Wochenziel, Rückkehr und die neuen Zähler', () => {
    const { weekly: _w, login: _l, ...rest } = end;
    const old = { ...rest, version: 8, daily: { ...end.daily, counters: { defenses: 2, attacks: 1, built: 0, trained: 6 } } };
    const map = new Map([[SAVE_KEY, JSON.stringify(old)]]);
    const loaded = loadGame({ getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) }, data)!;
    expect(loaded.daily.counters).toEqual({ defenses: 2, attacks: 1, built: 0, trained: 6, stars: 0, towers: 0 });
    expect(loaded.weekly.claimed).toBe(false);
    expect(loaded.login).toEqual({ day: -1, claims: 0 });
  });
});
