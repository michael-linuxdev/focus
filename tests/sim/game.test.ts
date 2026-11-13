import { describe, expect, it } from 'vitest';
import {
  attackSetup, cityHint, computeLoot, createGame, defaultLineup, defenseSetup, lootLimit, protectedStock, readyTroops, reduceGame, rngFromSeed, rngInt, unlocked, verifyReplay,
  type GameAction, type GameState, type Resources,
} from '../../src/sim/index.ts';
import { playBattle, playTutorial, firstTowerOnly, simpleAttack } from './bot.ts';
import { data } from './testdata.ts';

const start = (): GameState => createGame(5, 0, data);
const act = (g: GameState, ...actions: GameAction[]): GameState =>
  actions.reduce((s, a) => {
    const r = reduceGame(s, a, data);
    if (r.error) throw new Error(`${a.type}: ${r.error}`);
    return r.state;
  }, g);
const err = (g: GameState, a: GameAction) => reduceGame(g, a, data).error;
const rich = (g: GameState): GameState => ({ ...g, resources: { gold: 5000, wood: 5000, stone: 5000 } });
const at = (g: GameState, seconds: number): GameAction => ({ type: 'AdvanceTime', now: g.now + seconds * 1000 });

describe('Zeit und Aktionen', () => {
  it('die Zeit läuft nur vorwärts, ungültige Aktionen ändern nichts', () => {
    const g = createGame(1, 1000, data);
    expect(act(g, { type: 'AdvanceTime', now: 2000 }).now).toBe(2000);
    const back = reduceGame(g, { type: 'AdvanceTime', now: 999 }, data);
    expect(back.error).toBe('time_runs_backwards');
    expect(back.state).toBe(g);
  });

  it('eine Verteidigung wird nachgerechnet, nicht geglaubt', () => {
    const g = start();
    expect(err(g, { type: 'ResolveDefense', inputs: [] })).toBe('battle_not_finished');
    expect(err(g, { type: 'ResolveDefense', inputs: [{ tick: 5, action: { type: 'ReleaseWave' } }, { tick: 1, action: { type: 'ReleaseWave' } }] })).toBe('invalid_payload');
    const { inputs, final } = playBattle(defenseSetup(g, data), g.nextSeed, data, firstTowerOnly(data));
    const next = act(g, { type: 'ResolveDefense', inputs });
    expect(next.defensesWon).toBe(1);
    expect(next.resources.gold).toBe(final.gold + 30);
    expect(next.towers).toEqual([{ slot: 's1', def: 'bogenturm', level: 1 }]);
    expect(next.nextSeed).not.toBe(g.nextSeed);
    expect(next.replays.length).toBe(1);
    expect(verifyReplay(next.replays[0]!.replay, data)).toBe('ok');
    expect(next.tutorialStep).toBe(1);
  });
});

describe('Stadtbau', () => {
  it('der erste Hinweis zeigt auf den ersten Bauplatz; Freischaltungen folgen dem Ablauf', () => {
    const g = start();
    expect(cityHint(g, data)).toEqual({ type: 'slot', slot: 's1', tower: 'bogenturm' });
    expect(unlocked(g, 'defend', data)).toBe(false);
    expect(unlocked(g, 'attack', data)).toBe(false);
    const later = playTutorial(g, data, 'holzfaeller').game;
    expect(unlocked(later, 'defend', data)).toBe(true);
    expect(unlocked(later, 'building:holzfaeller', data)).toBe(true);
    expect(unlocked(later, 'keep', data)).toBe(false);
  });

  it('Gebäude brauchen Bauzeit; der erste Timer lässt sich kostenlos überspringen, spätere nicht', () => {
    let g = playTutorial(start(), data, 'holzfaeller').game;
    expect(err(g, { type: 'BuildBuilding', plot: 'p9', building: 'holzfaeller' })).toBe('unknown_plot');
    expect(err(g, { type: 'BuildBuilding', plot: 'p1', building: 'schmiede' })).toBe('unknown_building');
    g = act(g, { type: 'BuildBuilding', plot: 'p1', building: 'holzfaeller' });
    expect(g.buildings[0]!.doneAt).toBe(g.now + 10_000);
    expect(err(g, { type: 'BuildBuilding', plot: 'p1', building: 'steinbruch' })).toBe('plot_occupied');
    expect(err(g, { type: 'BuildBuilding', plot: 'p2', building: 'holzfaeller' })).toBe('already_built');
    g = act(g, { type: 'SkipTimerFree', plot: 'p1' });
    expect(g.buildings[0]!.doneAt).toBe(g.now);
    expect(err(g, { type: 'SkipTimerFree', plot: 'p1' })).toBe('nothing_to_skip');
    g = act(g, { type: 'BuildBuilding', plot: 'p2', building: 'steinbruch' });
    expect(err(g, { type: 'SkipTimerFree', plot: 'p2' })).toBe('skip_not_free');
    expect(err(g, { type: 'BuildBuilding', plot: 'p3', building: 'kaserne' })).toBe('not_enough_resources');
  });

  it('Erträge hängen nur von der verstrichenen Zeit ab, nicht davon, wie oft abgerechnet wird', () => {
    let a = act(rich(start()), { type: 'BuildBuilding', plot: 'p1', building: 'holzfaeller' });
    let b = a;
    const wood0 = a.resources.wood;
    a = act(a, at(a, 3600 + 10));
    for (let i = 0; i < 361; i++) b = act(b, at(b, 10));
    expect(a.resources.wood - wood0).toBe(1800);
    expect(b.resources).toEqual(a.resources);
    // Krumme Schritte: nichts geht verloren, nichts entsteht doppelt.
    let c = act(rich(start()), { type: 'BuildBuilding', plot: 'p1', building: 'holzfaeller' });
    const rng = rngFromSeed(3);
    while (c.now < 3_610_000) c = act(c, { type: 'AdvanceTime', now: Math.min(3_610_000, c.now + 1 + rngInt(rng, 70_000)) });
    expect(c.resources).toEqual(a.resources);
  });

  it('Burgfried Stufe 2: Bauzeit, dann Wahl aus drei Straßenverläufen, neue Bauplätze, Katapult und Heldin', () => {
    let g = rich(start());
    expect(err(g, { type: 'BuildTower', slot: 's6', tower: 'bogenturm' })).toBe('slot_locked');
    expect(err(g, { type: 'BuildTower', slot: 's3', tower: 'katapult' })).toBe('tower_locked');
    expect(err(g, { type: 'AssignHero', section: 'nord' })).toBe('no_hero');
    expect(err(g, { type: 'ChooseRoad', road: 'ostbogen' })).toBe('no_road_choice');
    g = act(g, { type: 'UpgradeKeep' });
    expect(err(g, { type: 'UpgradeKeep' })).toBe('keep_busy');
    g = act(g, at(g, 19));
    expect(g.keepLevel).toBe(1);
    g = act(g, at(g, 1));
    expect(g.keepLevel).toBe(2);
    expect(g.roadChoicePending).toBe(true);
    expect(g.hero.joined).toBe(true);
    expect(readyTroops(g, 'gepanzert')).toBe(4);
    expect(err(g, { type: 'ChooseRoad', road: 'dorf_1' })).toBe('unknown_road');
    g = act(g, { type: 'ChooseRoad', road: 'westschleife' }, { type: 'BuildTower', slot: 's6', tower: 'bogenturm' }, { type: 'BuildTower', slot: 's3', tower: 'katapult' }, { type: 'AssignHero', section: 'mitte' });
    expect(g.roadId).toBe('westschleife');
    expect(defenseSetup(g, data).heroSection).toBe('mitte');
    expect(err(g, { type: 'UpgradeKeep' })).toBe('keep_max_level');
    expect(err(g, { type: 'AssignHero', section: 'west' })).toBe('unknown_section');
  });

  it('Truppen: Ausbildung braucht Kaserne, Rohstoffe und Zeit', () => {
    let g = rich(start());
    expect(err(g, { type: 'TrainTroops', unit: 'leicht', count: 5 })).toBe('no_barracks');
    g = act(g, { type: 'BuildBuilding', plot: 'p3', building: 'kaserne' }, at(g, 15));
    expect(err(g, { type: 'TrainTroops', unit: 'drache', count: 1 })).toBe('unknown_troop');
    expect(err(g, { type: 'TrainTroops', unit: 'leicht', count: 0 })).toBe('invalid_payload');
    g = act(g, { type: 'TrainTroops', unit: 'leicht', count: 5 });
    expect(g.resources.gold).toBe(5000 - 80 - 25);
    expect(err(g, { type: 'TrainTroops', unit: 'leicht', count: 1 })).toBe('training_busy');
    g = act(g, at(g, 9));
    expect(readyTroops(g, 'leicht')).toBe(0);
    g = act(g, at(g, 1));
    expect(readyTroops(g, 'leicht')).toBe(5);
    expect(g.army.training).toBeNull();
  });
});

describe('Angriff und Verlustgrenzen', () => {
  const armed = (): GameState => playTutorial(start(), data, 'erster_angriff').game;
  const camp = data.camps.camps[0]!;

  it('die Aufstellung wird geprüft', () => {
    const g = armed();
    const lineup = defaultLineup(g, data);
    expect(lineup.length).toBe(3);
    expect(err(g, { type: 'ResolveAttack', camp: 'nirgendwo', lineup, inputs: [] })).toBe('unknown_camp');
    expect(err(g, { type: 'ResolveAttack', camp: camp.id, lineup: lineup.slice(0, 2), inputs: [] })).toBe('invalid_lineup');
    expect(err(g, { type: 'ResolveAttack', camp: camp.id, lineup: [[], [], []], inputs: [] })).toBe('invalid_lineup');
    expect(err(g, { type: 'ResolveAttack', camp: camp.id, lineup: [[{ unit: 'leicht', count: 99 }], [], []], inputs: [] })).toBe('not_enough_troops');
    expect(err(g, { type: 'ResolveAttack', camp: camp.id, lineup: [[{ unit: 'raeuber', count: 1 }], [], []], inputs: [] })).toBe('invalid_lineup');
    // Ohne Eingaben läuft die Zeit ab: abgewehrt, keine Beute, keine Verluste.
    const idle = act(g, { type: 'ResolveAttack', camp: camp.id, lineup, inputs: [] });
    expect(idle.lastAttack).toEqual({ camp: camp.id, depth: 0, loot: { gold: 0, wood: 0, stone: 0 }, fallen: [] });
  });

  it('besiegte Truppen kommen ins Lazarett und kehren zurück', () => {
    const g = armed();
    const lineup = defaultLineup(g, data);
    const { inputs, final } = playBattle(attackSetup(g, camp.id, lineup, data), g.nextSeed, data, simpleAttack(120));
    let after = act(g, { type: 'ResolveAttack', camp: camp.id, lineup, inputs });
    const outcome = after.lastAttack!;
    expect(outcome.depth).toBe(final.depth);
    const lost = outcome.fallen.reduce((n, f) => n + f.count, 0);
    expect(lost).toBe(final.fallen.length);
    expect(lost).toBeGreaterThan(0);
    for (const t of data.troops.troops) {
      const inHospital = after.army.hospital.filter((h) => h.unit === t.unit).reduce((n, h) => n + h.count, 0);
      expect(readyTroops(after, t.unit) + inHospital).toBe(readyTroops(g, t.unit));
    }
    after = act(after, at(after, 3600));
    expect(after.army.hospital).toEqual([]);
    for (const t of data.troops.troops) expect(readyTroops(after, t.unit)).toBe(readyTroops(g, t.unit));
    expect(verifyReplay(after.replays[after.replays.length - 1]!.replay, data)).toBe('ok');
    expect(after.resources.gold).toBe(g.resources.gold + outcome.loot.gold);
  });

  it('Beute überschreitet nie den festen Anteil der ungeschützten Vorräte, der Grundstock bleibt unberührt', () => {
    const rng = rngFromSeed(9);
    const rnd = (): Resources => ({ gold: rngInt(rng, 100000), wood: rngInt(rng, 100000), stone: rngInt(rng, 100000) });
    for (let i = 0; i < 2000; i++) {
      const stock = rnd();
      const prot = rnd();
      const limit = lootLimit(stock, prot, data.rules);
      let previous = 0;
      for (let depth = 0; depth <= 3; depth++) {
        const loot = computeLoot(stock, prot, depth, data.rules);
        for (const k of ['gold', 'wood', 'stone'] as const) {
          const unprotected = Math.max(0, stock[k] - prot[k]);
          expect(loot[k]).toBeLessThanOrEqual(limit[k]);
          expect(limit[k] * 1000).toBeLessThanOrEqual(unprotected * data.rules.lootMaxPermille);
          expect(stock[k] - loot[k]).toBeGreaterThanOrEqual(Math.min(stock[k], prot[k]));
        }
        expect(loot.gold).toBeGreaterThanOrEqual(previous);
        previous = loot.gold;
      }
    }
    expect(computeLoot(camp.stock, camp.protected, 0, data.rules)).toEqual({ gold: 0, wood: 0, stone: 0 });
    expect(computeLoot(camp.stock, camp.protected, 3, data.rules)).toEqual({ gold: 150, wood: 75, stone: 75 });
  });

  it('der Speicher schützt einen Grundstock', () => {
    let g = rich(start());
    expect(protectedStock(g, data)).toEqual({ gold: 0, wood: 0, stone: 0 });
    g = act(g, { type: 'BuildBuilding', plot: 'p4', building: 'speicher' }, at(g, 120));
    expect(protectedStock(g, data)).toEqual({ gold: 150, wood: 150, stone: 150 });
  });

  it('es werden höchstens so viele Wiederholungen aufbewahrt wie vorgesehen', () => {
    let g = armed();
    for (let i = 0; i < 12; i++) g = act(g, { type: 'ResolveAttack', camp: camp.id, lineup: defaultLineup(g, data), inputs: [] });
    expect(g.replays.length).toBe(data.rules.maxReplays);
    expect(g.replays[g.replays.length - 1]!.id).toBe(g.nextReplayId - 1);
  });
});
