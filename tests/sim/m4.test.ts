import { describe, expect, it } from 'vitest';
import {
  activeGoals, scaledReward, createBattle, createGame, defenseSetup, killedCount, militiaPosition, protectedStock, raidSetup, reduceGame, rngFromSeed, rngInt, runBattle, stepBattle, verifyReplay, weakSection,
  type BattleSetup, type GameAction, type GameState,
} from '../../src/sim/index.ts';
import { playTutorial } from './bot.ts';
import { data } from './testdata.ts';

const HOUR = 3_600_000;
const act = (g: GameState, ...actions: GameAction[]): GameState =>
  actions.reduce((s, a) => {
    const r = reduceGame(s, a, data);
    if (r.error) throw new Error(`${a.type}: ${r.error}`);
    return r.state;
  }, g);
const err = (g: GameState, a: GameAction) => reduceGame(g, a, data).error;
const at = (g: GameState, seconds: number): GameAction => ({ type: 'AdvanceTime', now: g.now + seconds * 1000 });
const grown = (): GameState => playTutorial(createGame(21, 1_700_000_000_000, data), data, 'freies_spiel').game;

const march = (unit: string, count: number, towers: BattleSetup['towers'], extra: Partial<BattleSetup> = {}): BattleSetup => ({
  playerSide: 'attacker', roadId: 'dorf_1', keepLevel: 2, towers, gold: 0, keepHp: 1, unlosable: false, holdMilliUntilTower: 0, heroSection: null, gateHp: 0,
  waves: [{ groups: [{ unit, count, startTick: 0, intervalTicks: 10, jitterTicks: 0 }] }], autoRelease: true, abilities: [], maxTicks: 3000, ...extra,
});

describe('Pechnase', () => {
  const pech = [{ slot: 's1', def: 'pechnase', level: 1 }];
  const pechLevel = data.towers.towers.find((t) => t.id === 'pechnase')!.levels[0]!;

  it('bremst alle im Umkreis', () => {
    const plain = runBattle(march('leicht', 1, []), 1, [], data);
    const slowed = runBattle(march('leicht', 1, pech, { keepHp: 99 }), 1, [], data, 3000);
    expect(plain.result).toBe('breached');
    // Ohne Pech braucht ein Leichter 23000 / 70 Ticks; mit Pech stirbt er oder kommt deutlich später an.
    expect(slowed.fallen.length === 1 || slowed.tick > plain.tick).toBe(true);
    let s = createBattle(march('gepanzert', 1, pech), 1, data);
    let insideSteps: number[] = [];
    for (let i = 0; i < 200; i++) {
      const before = s.units[0]?.pos ?? 0;
      s = stepBattle(s, [], data);
      if (s.units[0]) insideSteps.push(s.units[0].pos - before);
    }
    expect(Math.min(...insideSteps)).toBe(Math.trunc((32 * pechLevel.slowPermille) / 1000));
    expect(Math.max(...insideSteps)).toBe(32);
  });

  it('trifft Gepanzerte trotz Rüstung besser als ein Bogenturm gleicher Stufe', () => {
    const hpLeft = (def: string): number => {
      let s = createBattle(march('gepanzert', 1, [{ slot: 's1', def, level: 1 }], { keepHp: 99 }), 1, data);
      for (let i = 0; i < 260 && s.units.length > 0; i++) s = stepBattle(s, [], data);
      return s.units[0]?.hp ?? 0;
    };
    // Rüstung zieht dem Bogenturm je Schuss 3 ab, der Pechnase nichts; dazu bleibt die Einheit länger im Umkreis.
    expect(hpLeft('pechnase')).toBeLessThan(110);
    expect(hpLeft('pechnase')).toBeLessThanOrEqual(hpLeft('bogenturm'));
  });
});

describe('Wachstube', () => {
  const guard = [{ slot: 's2', def: 'wachstube', level: 1 }];
  const guardLevel = data.towers.towers.find((t) => t.id === 'wachstube')!.levels[0]!;

  it('die Miliz steht auf dem nächstgelegenen Punkt der Straße hinter dem Tor', () => {
    const road = data.roads.roads[0]!;
    const pos = militiaPosition(road, 2, 5, data);
    expect(pos).toBe(8000); // Bauplatz (2,5) liegt neben der Straße bei (1,5)
    expect(militiaPosition(road, 4, 0, data)).toBeGreaterThan(data.rules.gateMilli);
  });

  it('hält Angreifer auf, bis sie gefallen ist, und rückt später nach', () => {
    let s = createBattle(march('gepanzert', 3, guard), 1, data);
    const mPos = s.towers[0]!.militiaPos;
    let heldTicks = 0;
    let fellAt = -1;
    for (let i = 0; i < 1500 && s.result === 'running'; i++) {
      s = stepBattle(s, [], data);
      const t = s.towers[0]!;
      if (t.militiaHp > 0 && fellAt < 0) {
        for (const u of s.units) expect(u.pos).toBeLessThanOrEqual(mPos);
        if (s.units.some((u) => u.pos === mPos)) heldTicks++;
      } else if (fellAt < 0) fellAt = s.tick;
    }
    expect(heldTicks).toBeGreaterThan(5);
    expect(fellAt).toBeGreaterThan(0);
    // Nachrücken: nach der Wartezeit steht wieder Miliz.
    let later = createBattle(march('gepanzert', 3, guard, { keepHp: 99 }), 1, data);
    for (let i = 0; i < fellAt + guardLevel.militiaRespawnTicks + 2; i++) later = stepBattle(later, [], data);
    expect(later.towers[0]!.militiaHp).toBe(guardLevel.militiaHp);
  });

  it('Rammböcke räumen Miliz schnell weg, nehmen dabei aber besonders viel Schaden', () => {
    const run = (unit: string) => {
      let s = createBattle(march(unit, 1, guard, { keepHp: 99 }), 1, data);
      let held = 0;
      let hpAfter = -1;
      for (let i = 0; i < 1200; i++) {
        s = stepBattle(s, [], data);
        const u = s.units[0];
        if (u && u.pos === s.towers[0]!.militiaPos && s.towers[0]!.militiaHp > 0) held++;
        if (hpAfter < 0 && s.towers[0]!.militiaHp === 0) hpAfter = u ? u.hp : 0;
      }
      return { held, hpAfter, lost: hpAfter < 0 ? 0 : data.units.units.find((u) => u.id === unit)!.hp - hpAfter };
    };
    const ram = run('ramme');
    const armored = run('gepanzert');
    expect(ram.hpAfter).toBeGreaterThanOrEqual(0); // der Rammbock bricht die Miliz
    expect(ram.held).toBeLessThan(armored.held > 0 ? armored.held : 9999);
    // Pro Treffer der Miliz: Rammbock Schaden * 3 - 1 Rüstung, Gepanzerter Schaden - 3 Rüstung.
    expect(ram.lost / Math.max(1, ram.held)).toBeGreaterThan(armored.lost / Math.max(1, armored.held) || 0);
  });
});

describe('Schild und Verluste der eigenen Stadt', () => {
  it('neue Spieler haben einen längeren Schild als nach einer Niederlage', () => {
    const g = createGame(1, 5000, data);
    expect(g.shieldUntil).toBe(5000 + data.rules.newPlayerShieldHours * HOUR);
    expect(data.rules.newPlayerShieldHours).toBeGreaterThan(data.rules.defeatShieldHours);
  });

  it('nach einer Niederlage schützt ein Schild für einige Stunden; die Beute der Räuber bleibt in der Verlustgrenze', () => {
    // Stadt ohne Türme, Schild abgelaufen, verlierbare Welle.
    let g = grown();
    g = act({ ...g, towers: [], shieldUntil: 0, resources: { gold: 1000, wood: 800, stone: 600 } }, at(g, 1));
    const prot = protectedStock(g, data);
    const before = g.resources;
    g = act(g, { type: 'ResolveDefense', inputs: [] });
    const saved = g.replays[g.replays.length - 1]!;
    expect(saved.result).toBe('breached');
    expect(g.shieldUntil).toBe(g.now + data.rules.defeatShieldHours * HOUR);
    for (const k of ['gold', 'wood', 'stone'] as const) {
      const unprotected = Math.max(0, before[k] - prot[k]);
      const lost = before[k] - g.resources[k];
      expect(lost).toBe(saved.loot[k]);
      expect(lost).toBeGreaterThan(0);
      expect(lost * 1000).toBeLessThanOrEqual(unprotected * data.rules.lootMaxPermille);
      expect(g.resources[k]).toBeGreaterThanOrEqual(Math.min(before[k], prot[k]));
    }
  });

  it('ein längerer Schild wird durch eine Niederlage nicht verkürzt', () => {
    let g = grown();
    const long = g.shieldUntil;
    g = act({ ...g, towers: [] }, { type: 'ResolveDefense', inputs: [] });
    expect(g.shieldUntil).toBe(long);
  });

  it('Vorräte gehen erst ab der eingestellten Durchbruchstiefe verloren (Marktplatz), ein genommenes Tor allein kostet nichts', () => {
    expect(data.rules.cityLossMinDepth).toBe(2);
    let g = grown();
    g = act({ ...g, towers: [], shieldUntil: 0, resources: { gold: 1000, wood: 800, stone: 600 } }, at(g, 1));
    // Dieselbe verlorene Schlacht (Tiefe 3), einmal mit der echten Schwelle, einmal mit einer unerreichbaren.
    const real = reduceGame(g, { type: 'ResolveDefense', inputs: [] }, data).state;
    const never = reduceGame(g, { type: 'ResolveDefense', inputs: [] }, { ...data, rules: { ...data.rules, cityLossMinDepth: 4 } }).state;
    expect(real.resources.wood).toBeLessThan(g.resources.wood);
    expect(never.resources.wood).toBe(g.resources.wood);
    expect(never.replays[never.replays.length - 1]!.loot).toEqual({ gold: 0, wood: 0, stone: 0 });
    // Schwelle genau auf der erreichten Tiefe: Verlust wie mit der echten Schwelle.
    const exact = reduceGame(g, { type: 'ResolveDefense', inputs: [] }, { ...data, rules: { ...data.rules, cityLossMinDepth: 3 } }).state;
    expect(exact.resources).toEqual(real.resources);
  });

  it('der erste Nachtangriff kostet nichts, der zweite nach der normalen Regel', () => {
    let g = grown();
    g = act({ ...g, towers: [], resources: { gold: 1000, wood: 800, stone: 600 } }, at(g, 5 * 3600));
    const before = g.resources;
    g = act(g, { type: 'ResolveNightRaid' });
    const first = g.replays[g.replays.length - 1]!;
    expect(first.result).toBe('breached');
    expect(first.loot).toEqual({ gold: 0, wood: 0, stone: 0 });
    expect(g.resources.wood).toBe(before.wood);
    expect(g.resources.gold).toBeGreaterThanOrEqual(before.gold);
    expect(g.raidsResolved).toBe(1);
    // Der Schild nach der Niederlage gilt trotzdem.
    expect(g.shieldUntil).toBeGreaterThan(g.now);
    g = act(g, { type: 'DismissRaidReport' }, at(g, 5 * 3600), { type: 'ResolveNightRaid' });
    const second = g.replays[g.replays.length - 1]!;
    expect(second.loot.wood).toBeGreaterThan(0);
    expect(g.raidsResolved).toBe(2);
  });

  it('wird die Welle schon am Tor gestoppt, geht nichts verloren', () => {
    const g = grown();
    const s = runBattle({ ...defenseSetup(g, data), waves: [{ groups: [{ unit: 'raeuber', count: 1, startTick: 0, intervalTicks: 0, jitterTicks: 0 }] }] }, 1, [], data);
    expect(s.result).toBe('held');
    expect(s.depth).toBe(0);
  });

  it('beliebige Städte verlieren beim Nachtangriff nie mehr als die Grenze', () => {
    const base = grown();
    const rng = rngFromSeed(4);
    for (let i = 0; i < 40; i++) {
      const towers = base.towers.filter(() => rngInt(rng, 2) === 0);
      const resources = { gold: rngInt(rng, 5000), wood: rngInt(rng, 5000), stone: rngInt(rng, 5000) };
      let g: GameState = { ...base, towers, resources, nextSeed: rngInt(rng, 1 << 30), raidsResolved: i % 3 };
      g = act(g, at(g, 5 * 3600));
      const prot = protectedStock(g, data);
      const before = g.resources;
      g = act(g, { type: 'ResolveNightRaid' });
      for (const k of ['gold', 'wood', 'stone'] as const) {
        const lost = before[k] - g.resources[k];
        // Gold kann durch Kopfgeld sogar steigen; verloren geht höchstens der feste Anteil des Ungeschützten.
        const stock = k === 'gold' ? g.resources.gold + g.replays[g.replays.length - 1]!.loot.gold : before[k];
        expect(lost * 1000).toBeLessThanOrEqual(Math.max(0, stock - prot[k]) * data.rules.lootMaxPermille);
        expect(g.resources[k]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('Nachtangriff bei Rückkehr', () => {
  it('wird erst nach der Ankündigung und der Wartezeit berechnet, ohne Eingaben, als Wiederholung', () => {
    const fresh = createGame(1, 0, data);
    expect(err(fresh, { type: 'ResolveNightRaid' })).toBe('no_raid_announced');
    let g = grown();
    expect(err(g, { type: 'ResolveNightRaid' })).toBe('raid_not_due');
    g = act(g, at(g, 4 * 3600 - 1));
    expect(err(g, { type: 'ResolveNightRaid' })).toBe('raid_not_due');
    g = act(g, at(g, 1));
    const again = act(g, { type: 'ResolveNightRaid' });
    g = act(g, { type: 'ResolveNightRaid' });
    expect(g).toEqual(again);
    const saved = g.replays[g.replays.length - 1]!;
    expect(saved.kind).toBe('raid');
    expect(saved.replay.inputs).toEqual([]);
    expect(verifyReplay(saved.replay, data)).toBe('ok');
    expect(g.raidReport).toBe(saved.id);
    expect(data.city.sections.some((s) => s.id === saved.weakSection)).toBe(true);
    // Der nächste Angriff ist wieder angekündigt, aber noch nicht fällig.
    expect(err(g, { type: 'ResolveNightRaid' })).toBe('raid_not_due');
    g = act(g, { type: 'DismissRaidReport' });
    expect(g.raidReport).toBeNull();
    expect(err(g, { type: 'DismissRaidReport' })).toBe('nothing_to_dismiss');
  });

  it('der schwache Abschnitt ist der mit den wenigsten besiegten Angreifern', () => {
    const g = grown();
    const final = runBattle(raidSetup(g, data), 3, [], data);
    const weak = weakSection(final, data)!;
    const kills = (section: string): number =>
      final.towers.filter((t) => data.city.towerSlots.find((s) => s.id === t.slot)!.section === section).reduce((n, t) => n + t.kills, 0);
    for (const s of data.city.sections) expect(kills(weak)).toBeLessThanOrEqual(kills(s.id));
    expect(killedCount(final)).toBe(final.towers.reduce((n, t) => n + t.kills, 0));
  });
});

describe('Weltkarte, Allianz (Platzhalter) und Tagesziele', () => {
  it('Ziele unter Schild sind nicht angreifbar', () => {
    const g = grown();
    const lineup = [[{ unit: 'leicht', count: 1 }], [], []];
    expect(err(g, { type: 'ResolveAttack', camp: 'eschenfurt', lineup, inputs: [] })).toBe('target_shielded');
    expect(err(g, { type: 'ResolveAttack', camp: 'falkenried', lineup, inputs: [] })).toBeNull();
  });

  it('Beitritt bringt die Belohnung genau einmal', () => {
    const g = playTutorial(createGame(3, 0, data), data, 'allianz').game;
    const joined = act(g, { type: 'JoinAlliance' });
    expect(joined.resources.gold - g.resources.gold).toBe(data.alliance.joinReward.gold);
    expect(err(joined, { type: 'JoinAlliance' })).toBe('already_joined');
  });

  it('Hilfe beim Bauen verkürzt den Timer, unabhängig davon, wie oft abgerechnet wird', () => {
    let g = playTutorial(createGame(3, 0, data), data, 'hilfe').game;
    const hof = (s: GameState) => s.buildings.find((b) => b.def === 'hof')!;
    const plot = hof(g).plot;
    const full = hof(g).doneAt;
    expect(err({ ...g, allianceJoined: false }, { type: 'RequestHelp', plot })).toBe('no_alliance');
    expect(err(g, { type: 'RequestHelp', plot: 'p1' })).toBe('nothing_to_help');
    g = act(g, { type: 'RequestHelp', plot });
    expect(err(g, { type: 'RequestHelp', plot })).toBe('help_already_requested');
    let a = act(g, at(g, 60));
    let b = g;
    for (let i = 0; i < 60; i++) b = act(b, at(b, 1));
    expect(hof(a).helpsReceived).toBe(data.alliance.maxHelps);
    expect(hof(a).doneAt).toBe(full - data.alliance.maxHelps * data.alliance.helpReduceSeconds * 1000);
    expect(hof(b)).toEqual(hof(a));
    // Hilfe macht einen Bau nie rückwirkend fertig.
    let c = act(playTutorial(createGame(3, 0, data), data, 'speicher').game, { type: 'JoinAlliance' });
    c = act(c, { type: 'BuildBuilding', plot: 'p6', building: 'lazarett' }, at(c, 175), { type: 'RequestHelp', plot: 'p6' }, at(c, 176));
    expect(c.buildings.find((x) => x.def === 'lazarett')!.doneAt).toBeGreaterThan(c.now);
    c = act(c, at(c, 4));
    // Die erste Hilfe kommt vier Sekunden nach der Bitte: fertig ab diesem Moment, nicht früher.
    expect(c.buildings.find((x) => x.def === 'lazarett')!.doneAt).toBe(c.now - 1000);
  });

  it('Tagesziele: Belohnung erst bei erreichtem Zähler, nur einmal, am nächsten Tag von vorn', () => {
    let g = grown();
    expect(err(g, { type: 'ClaimDailyGoal', goal: 'faulenzen' })).toBe('unknown_goal');
    expect(g.daily.counters.attacks).toBe(1);
    const gold = g.resources.gold;
    const open = activeGoals(g, data).find((goal) => !g.daily.claimed.includes(goal.id) && g.daily.counters[goal.counter] >= goal.count)!;
    g = act(g, { type: 'ClaimDailyGoal', goal: open.id });
    expect(g.resources.gold).toBe(gold + scaledReward(open.reward, g, data).gold);
    expect(err(g, { type: 'ClaimDailyGoal', goal: open.id })).toBe('goal_already_claimed');
    g = act(g, at(g, 24 * 3600));
    expect(g.daily.claimed).toEqual([]);
    expect(g.daily.counters).toEqual({ defenses: 0, attacks: 0, built: 0, trained: 0, stars: 0, towers: 0 });
    expect(['goal_not_reached', 'goal_not_active']).toContain(err(g, { type: 'ClaimDailyGoal', goal: open.id }));
  });
});
