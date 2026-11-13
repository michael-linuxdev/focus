import { describe, expect, it } from 'vitest';
import {
  armyCapacity, armySize, attackSetup, campStockPermille, createGame, defaultLineup, findById, reduceGame, validateGameAction,
  type GameAction, type GameState,
} from '../../src/sim/index.ts';
import { loadGame, SAVE_KEY } from '../../src/app/save.ts';
import { t } from '../../src/app/texts.ts';
import { playBattle, playTutorial, simpleAttack } from './bot.ts';
import { data } from './testdata.ts';

const HOUR = 3_600_000;
const act = (g: GameState, ...actions: GameAction[]): GameState =>
  actions.reduce((s, a) => {
    const r = reduceGame(s, a, data);
    if (r.error) throw new Error(`${a.type}: ${r.error}`);
    return r.state;
  }, g);
const err = (g: GameState, a: GameAction) => reduceGame(g, a, data).error;
const later = (g: GameState, hours: number): GameState => act(g, { type: 'AdvanceTime', now: g.now + hours * HOUR });
const end = playTutorial(createGame(7, 0, data), data, 'freies_spiel', 0, true).game;
/** Stadt mit vollem Heer und ohne angekündigten Nachtangriff, damit nur der Gegenangriff zählt. */
const armed = (g: GameState = end): GameState => ({ ...g, raidDueAt: null, army: { ready: { leicht: 12, gepanzert: 8, ramme: 4 }, training: null, hospital: [] } });
const attack = (g: GameState, camp: string): GameState => {
  const lineup = defaultLineup(g, data);
  const { inputs } = playBattle(attackSetup(g, camp, lineup, data), g.nextSeed, data, simpleAttack(120));
  return act(g, { type: 'ResolveAttack', camp, lineup, inputs });
};

describe('M10: Weltkarte in Ringen', () => {
  it('jeder Ring ab 3 hat ein Lager und eine Stadt, stärker als der Ring davor, mit Namen', () => {
    for (let ring = 3; ring <= 8; ring++) {
      const targets = data.camps.camps.filter((c) => c.ring === ring);
      expect(targets.map((c) => c.kind).sort()).toEqual(['camp', 'city']);
      const before = data.camps.camps.filter((c) => c.ring === ring - 1 && !c.shielded);
      for (const c of targets) {
        expect(t(`target.${c.id}`)).not.toContain('⟦');
        expect(c.keepLevel).toBe(ring);
        expect(data.city.keepLevels.find((l) => l.level === ring)!.roads).toContain(c.roadId);
        for (const tw of c.towers) {
          const slot = findById(data.city.towerSlots, tw.slot, 'Bauplatz');
          expect(slot.keepLevel).toBeLessThanOrEqual(ring);
          expect(findById(data.towers.towers, tw.def, 'Turm').levels[tw.level - 1]!.keepLevel).toBeLessThanOrEqual(ring);
        }
        expect(new Set(c.towers.map((tw) => tw.slot)).size).toBe(c.towers.length);
        expect(c.stock.wood).toBeGreaterThan(Math.max(...before.filter((b) => b.kind === c.kind).map((b) => b.stock.wood)));
      }
    }
  });

  it('auf der Karte liegen die gleichzeitig sichtbaren Ziele nicht übereinander', () => {
    for (let keep = 1; keep <= 8; keep++) {
      const visible = [...data.camps.camps.filter((c) => c.ring >= keep - 1 && c.ring <= keep + 1).map((c) => c.map), { x: 50, y: 46 }];
      for (let i = 0; i < visible.length; i++) {
        for (let k = i + 1; k < visible.length; k++) {
          const far = Math.abs(visible[i]!.x - visible[k]!.x) >= 24 || Math.abs(visible[i]!.y - visible[k]!.y) >= 12;
          expect(far, `Burgfried ${keep}: ${JSON.stringify(visible[i])} und ${JSON.stringify(visible[k])}`).toBe(true);
        }
      }
    }
  });

  it('ein Ziel aus einem höheren Ring ist gesperrt, bis der Burgfried so weit ist', () => {
    const g = armed();
    const far = data.camps.camps.find((c) => c.ring === g.keepLevel + 1)!;
    expect(err(g, { type: 'ResolveAttack', camp: far.id, lineup: defaultLineup(g, data), inputs: [] })).toBe('target_locked');
    expect(validateGameAction({ ...g, keepLevel: far.ring }, { type: 'ResolveAttack', camp: far.id, lineup: defaultLineup(g, data), inputs: [] }, data)).toBeNull();
  });

  it('nach einem Angriff wachsen die Vorräte des Ziels erst wieder nach', () => {
    const camp = data.camps.camps[0]!;
    let g = armed({ ...end, campRaids: {} }); // im geführten Ablauf wurde dieses Lager schon einmal angegriffen
    expect(campStockPermille(g, camp.id, data)).toBe(1000);
    g = attack(g, camp.id);
    const first = g.lastAttack!.loot;
    expect(first.gold).toBeGreaterThan(0);
    expect(campStockPermille(g, camp.id, data)).toBe(0);
    // Gleich noch einmal: nichts zu holen.
    g = attack(armed(g), camp.id);
    expect(g.lastAttack!.loot).toEqual({ gold: 0, wood: 0, stone: 0 });
    g = later(g, data.rules.campRegenHours / 2);
    expect(campStockPermille(g, camp.id, data)).toBe(500);
    g = attack(armed(g), camp.id);
    expect(g.lastAttack!.loot.gold).toBe(Math.floor(first.gold / 2));
    expect(campStockPermille(later(g, data.rules.campRegenHours * 3), camp.id, data)).toBe(1000);
  });
});

describe('M10: Heer und Kaserne', () => {
  it('ausgebildet wird nur bis zur Heeresgröße; Truppen im Lazarett und in Ausbildung zählen mit', () => {
    const cap = armyCapacity(end, data);
    expect(cap).toBe(findById(data.buildings.buildings, 'kaserne', 'Gebäude').levels[0]!.armyCap);
    let g: GameState = { ...end, resources: { gold: 99_999, wood: 99_999, stone: 99_999 }, army: { ready: { leicht: cap - 10 }, training: null, hospital: [{ unit: 'leicht', count: 6, doneAt: end.now + HOUR }] } };
    expect(armySize(g)).toBe(cap - 4);
    expect(err(g, { type: 'TrainTroops', unit: 'leicht', count: 5 })).toBe('army_full');
    g = act(g, { type: 'TrainTroops', unit: 'leicht', count: 4 });
    expect(armySize(g)).toBe(cap);
    expect(armyCapacity({ ...end, buildings: [] }, data)).toBe(0);
  });

  it('eine ausgebaute Kaserne fasst mehr und macht die Truppen im Angriff zäher', () => {
    const levels = findById(data.buildings.buildings, 'kaserne', 'Gebäude').levels;
    levels.forEach((l, i) => {
      if (i === 0) return;
      expect(l.armyCap).toBeGreaterThan(levels[i - 1]!.armyCap);
      expect(l.troopHpPermille).toBeGreaterThan(levels[i - 1]!.troopHpPermille);
    });
    const camp = data.camps.camps[0]!.id;
    const g = armed();
    expect('unitHpPermille' in attackSetup(g, camp, defaultLineup(g, data), data)).toBe(false); // Stufe 1: Setup wie bisher
    const strong = { ...g, buildings: g.buildings.map((b) => (b.def === 'kaserne' ? { ...b, level: 4 } : b)) };
    expect(attackSetup(strong, camp, defaultLineup(strong, data), data).unitHpPermille).toBe(levels[3]!.troopHpPermille);
    expect(armyCapacity(strong, data)).toBe(levels[3]!.armyCap);
  });
});

describe('M10: Städte schlagen zurück (PLATZHALTER)', () => {
  const city = data.camps.camps.find((c) => c.kind === 'city' && !c.shielded && c.ring <= end.keepLevel)!;
  const camp = data.camps.camps.find((c) => c.kind === 'camp')!;

  it('ein Angriff auf ein Räuberlager lässt den Schild stehen und bleibt ohne Folgen', () => {
    const g = attack(armed(), camp.id);
    expect(g.shieldUntil).toBe(end.shieldUntil);
    expect(g.revenge).toBeNull();
    expect(err(g, { type: 'ResolveRevenge' })).toBe('no_revenge');
  });

  it('wer eine Stadt angreift, verliert seinen Schild; ihr Gegenangriff kommt nach der angekündigten Zeit', () => {
    expect(end.shieldUntil).toBeGreaterThan(end.now);
    let g = attack(armed(), city.id);
    expect(g.shieldUntil).toBeLessThanOrEqual(g.now);
    expect(g.revenge).toEqual({ camp: city.id, dueAt: g.now + data.rules.revengeAfterHours * HOUR });
    expect(err(g, { type: 'ResolveRevenge' })).toBe('revenge_not_due');
    g = later(g, data.rules.revengeAfterHours);
    const before = g.resources;
    g = act(g, { type: 'ResolveRevenge' });
    const report = g.replays.at(-1)!;
    expect(report).toMatchObject({ kind: 'raid', from: city.id });
    expect(g.raidReport).toBe(report.id);
    expect(g.revenge).toBeNull();
    // Verlustgrenze wie beim Nachtangriff.
    for (const k of ['gold', 'wood', 'stone'] as const) expect(before[k] - g.resources[k]).toBeLessThanOrEqual((before[k] * data.rules.lootMaxPermille) / 1000);
  });

  it('ein Schild schützt vor dem Gegenangriff, solange er läuft', () => {
    let g = attack(armed(), city.id);
    g = later({ ...g, shieldUntil: g.now + 20 * HOUR }, data.rules.revengeAfterHours + 1);
    expect(err(g, { type: 'ResolveRevenge' })).toBe('revenge_not_due');
    expect(validateGameAction(later(g, 20), { type: 'ResolveRevenge' }, data)).toBeNull();
  });

  it('ein Stand aus M9 (Version 9) bekommt die neuen Felder', () => {
    const { campRaids: _c, revenge: _r, ...rest } = end;
    const map = new Map([[SAVE_KEY, JSON.stringify({ ...rest, version: 9 })]]);
    const loaded = loadGame({ getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) }, data)!;
    expect(loaded.campRaids).toEqual({});
    expect(loaded.revenge).toBeNull();
  });
});
