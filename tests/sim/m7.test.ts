import { describe, expect, it } from 'vitest';
import {
  buildingLevel, createGame, findById, keepRequirement, protectedStock, reduceGame, roadLengthMilli, storageCapacity, towerActionCost,
  type GameAction, type GameState,
} from '../../src/sim/index.ts';
import { loadGame, SAVE_KEY } from '../../src/app/save.ts';
import { data } from './testdata.ts';

const act = (g: GameState, ...actions: GameAction[]): GameState =>
  actions.reduce((s, a) => {
    const r = reduceGame(s, a, data);
    if (r.error) throw new Error(`${a.type}: ${r.error}`);
    return r.state;
  }, g);
const err = (g: GameState, a: GameAction) => reduceGame(g, a, data).error;
const at = (g: GameState, seconds: number): GameAction => ({ type: 'AdvanceTime', now: g.now + seconds * 1000 });
const withRes = (g: GameState, n: number): GameState => ({ ...g, resources: { gold: n, wood: n, stone: n } });
/** Stadt mit Burgfried 2 und fertigem Holzfäller und Speicher. */
function town(): GameState {
  let g = withRes(createGame(5, 0, data), 100_000);
  g = act(g, { type: 'BuildBuilding', plot: 'p1', building: 'holzfaeller' }, { type: 'BuildBuilding', plot: 'p4', building: 'speicher' }, { type: 'UpgradeKeep' });
  g = act(g, at(g, 600), { type: 'ChooseRoad', road: 'ostbogen' });
  return g;
}

describe('M7: Ausbaustufen der Gebäude', () => {
  it('ein Ausbau kostet Vorräte, braucht Zeit und gilt erst danach; solange arbeitet das Gebäude weiter', () => {
    let g = withRes(town(), 20_000);
    const def = findById(data.buildings.buildings, 'holzfaeller', 'Gebäude');
    const next = def.levels[1]!;
    expect(err(g, { type: 'UpgradeBuilding', plot: 'p2' })).toBe('plot_empty');
    expect(err(g, { type: 'UpgradeBuilding', plot: 'x' })).toBe('unknown_plot');
    g = { ...act(g, { type: 'UpgradeBuilding', plot: 'p1' }), resources: { gold: 0, wood: 0, stone: 0 } };
    expect(g.daily.counters.built).toBeGreaterThanOrEqual(1);
    expect(err(g, { type: 'UpgradeBuilding', plot: 'p1' })).toBe('building_busy');
    const half = act(g, at(g, next.buildSeconds / 2));
    expect(half.buildings.find((b) => b.plot === 'p1')!.level).toBe(1);
    expect(half.resources.wood).toBe((def.levels[0]!.producePerHour.wood * (next.buildSeconds / 2)) / 3600);
    const done = act(g, at(g, next.buildSeconds));
    expect(done.buildings.find((b) => b.plot === 'p1')).toMatchObject({ level: 2, upgradeDoneAt: null });
    expect(buildingLevel(done.buildings.find((b) => b.plot === 'p1')!, data).producePerHour.wood).toBe(next.producePerHour.wood);
    // Eine Stunde auf Stufe 2 bringt den Ertrag der Stufe 2.
    const later = act(done, at(done, 3600));
    expect(later.resources.wood - done.resources.wood).toBe(next.producePerHour.wood);
  });

  it('das Ergebnis hängt nicht davon ab, wie oft über einen Ausbau hinweg abgerechnet wird', () => {
    const start = { ...act(withRes(town(), 20_000), { type: 'UpgradeBuilding', plot: 'p1' }), resources: { gold: 0, wood: 0, stone: 0 } };
    const once = act(start, at(start, 7200));
    let many = start;
    for (let i = 0; i < 720; i++) many = act(many, at(many, 10));
    expect(many.resources).toEqual(once.resources);
    expect(many.buildings).toEqual(once.buildings);
  });

  it('eine Stufe braucht den Burgfried derselben Stufe; ganz oben ist Schluss', () => {
    let g = town();
    g = act(g, { type: 'UpgradeBuilding', plot: 'p1' }, at(g, 3600));
    expect(g.keepLevel).toBe(2);
    expect(err(g, { type: 'UpgradeBuilding', plot: 'p1' })).toBe('level_locked');
    expect(err(withRes(g, 0), { type: 'UpgradeBuilding', plot: 'p4' })).toBe('not_enough_resources');
    const top = findById(data.buildings.buildings, 'holzfaeller', 'Gebäude').levels.length;
    const maxed = { ...g, keepLevel: 8, buildings: g.buildings.map((b) => ({ ...b, level: top })) };
    expect(err(maxed, { type: 'UpgradeBuilding', plot: 'p1' })).toBe('max_level');
  });

  it('die Bot-Allianz hilft auch beim Ausbau (PLATZHALTER)', () => {
    let g = act(town(), { type: 'JoinAlliance' }, { type: 'UpgradeBuilding', plot: 'p4' });
    const until = g.buildings.find((b) => b.plot === 'p4')!.upgradeDoneAt!;
    g = act(g, { type: 'RequestHelp', plot: 'p4' });
    expect(err(g, { type: 'RequestHelp', plot: 'p4' })).toBe('help_already_requested');
    g = act(g, at(g, data.alliance.helpIntervalSeconds));
    const b = g.buildings.find((x) => x.plot === 'p4')!;
    expect(b.helpsReceived).toBe(1);
    expect(b.upgradeDoneAt ?? b.doneAt).toBeLessThan(until);
    expect(err(g, { type: 'RequestHelp', plot: 'p1' })).toBe('nothing_to_help');
  });
});

describe('M7: Lagerplatz', () => {
  it('Erträge füllen die Vorräte nur bis zum Lagerplatz; Beute und Belohnungen dürfen darüber liegen', () => {
    let g = town();
    const cap = storageCapacity(g, data);
    expect(cap.wood).toBe(data.city.start.capacity.wood + findById(data.buildings.buildings, 'speicher', 'Gebäude').levels[0]!.capacity.wood);
    g = { ...g, resources: { gold: 0, wood: cap.wood - 100, stone: 0 } };
    g = act(g, at(g, 24 * 3600));
    expect(g.resources.wood).toBe(cap.wood);
    // Was schon darüber liegt, bleibt; es kommt nur nichts dazu.
    const over = act({ ...g, resources: { ...g.resources, wood: cap.wood + 5000 } }, at(g, 3600));
    expect(over.resources.wood).toBe(cap.wood + 5000);
    const joined = act({ ...g, resources: { ...g.resources, wood: cap.wood } }, { type: 'JoinAlliance' });
    expect(joined.resources.wood).toBe(cap.wood + data.alliance.joinReward.wood);
  });

  it('ein größerer Speicher fasst und schützt mehr', () => {
    let g = town();
    const before = { cap: storageCapacity(g, data), prot: protectedStock(g, data) };
    g = act(g, { type: 'UpgradeBuilding', plot: 'p4' }, at(g, 3600));
    expect(storageCapacity(g, data).stone).toBeGreaterThan(before.cap.stone);
    expect(protectedStock(g, data).gold).toBeGreaterThan(before.prot.gold);
  });

  it('jede Burgfried-Stufe ist mit dem verlangten Speicher bezahlbar, aber nicht ohne ihn', () => {
    const speicher = findById(data.buildings.buildings, 'speicher', 'Gebäude');
    for (const level of data.city.keepLevels) {
      const need = level.requires.find((r) => r.building === 'speicher');
      if (!need) continue;
      const cap = data.city.start.capacity.wood + speicher.levels[need.level - 1]!.capacity.wood;
      expect(level.cost.wood, `Burgfried ${level.level}`).toBeLessThanOrEqual(cap);
      expect(speicher.levels[need.level - 1]!.keepLevel).toBeLessThan(level.level);
    }
    // Jeder Ausbau eines Gebäudes passt in das Lager, das auf der Burgfried-Stufe davor erreichbar ist.
    for (const def of data.buildings.buildings) {
      def.levels.forEach((l, i) => {
        if (i === 0) return;
        const reachable = speicher.levels.filter((s, n) => s.keepLevel <= l.keepLevel && (def.id !== 'speicher' || n < i)).at(-1)!;
        expect(l.cost.wood, `${def.id} ${i + 1}`).toBeLessThanOrEqual(data.city.start.capacity.wood + reachable.capacity.wood);
      });
    }
  });
});

describe('M7: Burgfried bis Stufe 8 und Turmstufen', () => {
  it('der Burgfried verlangt den ausgebauten Speicher und nennt, was fehlt', () => {
    let g = town();
    expect(keepRequirement(g, data)).toEqual({ building: 'speicher', level: 2 });
    expect(err(g, { type: 'UpgradeKeep' })).toBe('requirement_missing');
    g = act(g, { type: 'UpgradeBuilding', plot: 'p4' });
    expect(err(g, { type: 'UpgradeKeep' })).toBe('requirement_missing'); // der Ausbau läuft noch
    g = act(g, at(g, 3600));
    expect(keepRequirement(g, data)).toBeNull();
    g = act(withRes(g, 100_000), { type: 'UpgradeKeep' });
    g = act(g, at(g, 24 * 3600));
    expect(g.keepLevel).toBe(3);
    expect(g.roadChoicePending).toBe(true);
  });

  it('höhere Turmstufen brauchen einen höheren Burgfried, in der Stadt wie in der Schlacht', () => {
    const towers = [{ slot: 's1', def: 'bogenturm', level: 2 }];
    const third = data.towers.towers[0]!.levels[2]!;
    expect(towerActionCost(towers, third.keepLevel - 1, { type: 'UpgradeTower', slot: 's1' }, data)).toBe('level_locked');
    expect(towerActionCost(towers, third.keepLevel, { type: 'UpgradeTower', slot: 's1' }, data)).toBe(third.cost);
    for (const tower of data.towers.towers) {
      tower.levels.forEach((l, i) => {
        expect(l.keepLevel).toBeGreaterThanOrEqual(tower.keepLevel);
        if (i > 0) {
          expect(l.keepLevel).toBeGreaterThanOrEqual(tower.levels[i - 1]!.keepLevel);
          expect(l.cost).toBeGreaterThan(tower.levels[i - 1]!.cost);
          expect(l.damage).toBeGreaterThan(tower.levels[i - 1]!.damage);
        }
      });
    }
  });

  it('jede Stufe bringt einen Bauplatz und wählbare Straßen; neue Straßen sind länger als die der Stufe 2', () => {
    const level2 = Math.max(...data.city.keepLevels[1]!.roads.map((id) => roadLengthMilli(findById(data.roads.roads, id, 'Straße'))));
    for (const level of data.city.keepLevels) {
      if (level.level < 2) continue;
      expect(data.city.towerSlots.some((s) => s.keepLevel === level.level), `Bauplatz für Stufe ${level.level}`).toBe(true);
      expect(level.roads.length).toBeGreaterThanOrEqual(3);
    }
    for (const id of ['schlangenweg', 'grosse_runde']) expect(roadLengthMilli(findById(data.roads.roads, id, 'Straße'))).toBeGreaterThan(level2);
    expect(data.city.keepLevels.at(-1)!.level).toBe(8);
  });

  it('ein Stand aus M6 (Version 6) behält seine Gebäude auf Stufe 1', () => {
    const g = town();
    const old = { ...g, version: 6, buildings: g.buildings.map(({ level: _l, upgradeDoneAt: _u, ...rest }) => rest) };
    const map = new Map([[SAVE_KEY, JSON.stringify(old)]]);
    const loaded = loadGame({ getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) }, data)!;
    expect(loaded.buildings.map((b) => [b.def, b.level, b.upgradeDoneAt])).toEqual([['holzfaeller', 1, null], ['speicher', 1, null]]);
    expect(loaded.keepLevel).toBe(2);
  });
});
