import { describe, expect, it } from 'vitest';
import {
  createBattle, hashBattle, killedCount, makeReplay, marketMilli, roadLengthMilli, roadPointMilli, rngFromSeed, rngInt, runBattle, stepBattle, validateBattleAction, verifyReplay,
  type BattleAction, type BattleInput, type BattleSetup,
} from '../../src/sim/index.ts';
import { data } from './testdata.ts';

const wave = (id: string) => ({ groups: data.waves.waves.find((w) => w.id === id)!.groups });
const defense: BattleSetup = {
  playerSide: 'defender', roadId: 'dorf_1', keepLevel: 1, towers: [], gold: 100, keepHp: 10, unlosable: false, holdMilliUntilTower: 0,
  heroSection: null, gateHp: 0, waves: [wave('dorf_w2')], autoRelease: true, abilities: [], maxTicks: 0,
};
const attack: BattleSetup = {
  playerSide: 'attacker', roadId: 'dorf_1', keepLevel: 1, towers: [{ slot: 's1', def: 'bogenturm', level: 1 }], gold: 0, keepHp: 1, unlosable: false,
  holdMilliUntilTower: 0, heroSection: null, gateHp: 200,
  waves: [
    { groups: [{ unit: 'ramme', count: 2, startTick: 0, intervalTicks: 8, jitterTicks: 0 }] },
    { groups: [{ unit: 'gepanzert', count: 4, startTick: 0, intervalTicks: 8, jitterTicks: 0 }] },
    { groups: [{ unit: 'leicht', count: 6, startTick: 0, intervalTicks: 8, jitterTicks: 0 }] },
  ],
  autoRelease: false, abilities: ['schildwall', 'brandpfeile'], maxTicks: 1800,
};
const build = (slot: string, tower = 'bogenturm'): BattleAction => ({ type: 'BuildTower', slot, tower });
const release: BattleAction = { type: 'ReleaseWave' };
const defenseInputs: BattleInput[] = [{ tick: 0, action: build('s1') }, { tick: 1, action: build('s2') }];
const attackInputs: BattleInput[] = [
  { tick: 0, action: release },
  { tick: 40, action: { type: 'UseAbility', ability: 'brandpfeile', slot: 's1' } },
  { tick: 100, action: release },
  { tick: 150, action: { type: 'UseAbility', ability: 'schildwall', slot: null } },
  { tick: 200, action: release },
];

describe('Straße', () => {
  const road = data.roads.roads[0]!;
  it('Länge und Punkte sind ganzzahlig', () => {
    expect(roadLengthMilli(road)).toBe(23000);
    expect(roadPointMilli(road, 3500)).toEqual([3500, 3000]);
    expect(roadPointMilli(road, 99999)).toEqual([4000, 13000]);
    expect(marketMilli(23000, data)).toBe(11500);
  });
  it('schräge Abschnitte werden abgelehnt', () => {
    expect(() => roadLengthMilli({ id: 'x', waypoints: [[0, 0], [1, 1]] })).toThrow();
  });
});

describe('Wiederholungen', () => {
  it('dieselbe Wiederholung liefert immer dasselbe Ergebnis (Verteidigung und Angriff)', () => {
    for (const [setup, inputs] of [[defense, defenseInputs], [attack, attackInputs]] as const) {
      const a = runBattle(setup, 42, inputs, data);
      const b = runBattle(setup, 42, inputs, data);
      expect(a.result).not.toBe('running');
      expect(a).toEqual(b);
      expect(hashBattle(a)).toBe(hashBattle(b));
    }
  });

  it('Referenz-Wiederholungen haben ein festes Ergebnis (Prüffälle für die C#-Fassung)', () => {
    const d = runBattle(defense, 42, defenseInputs, data);
    const a = runBattle(attack, 42, attackInputs, data);
    expect({
      defense: { tick: d.tick, hash: hashBattle(d), gold: d.gold, killed: killedCount(d), leaked: d.leaked, result: d.result },
      attack: { tick: a.tick, hash: hashBattle(a), depth: a.depth, fallen: killedCount(a), gateHp: a.gateHp, result: a.result },
    }).toMatchInlineSnapshot(`
      {
        "attack": {
          "depth": 3,
          "fallen": 0,
          "gateHp": 0,
          "hash": 943784507,
          "result": "breached",
          "tick": 529,
        },
        "defense": {
          "gold": 49,
          "hash": 3055775279,
          "killed": 11,
          "leaked": 3,
          "result": "held",
          "tick": 716,
        },
      }
    `);
  });

  it('anderer Startwert oder andere Eingaben ändern den Verlauf', () => {
    const ref = hashBattle(runBattle(defense, 42, defenseInputs, data, 200));
    expect(hashBattle(runBattle(defense, 43, defenseInputs, data, 200))).not.toBe(ref);
    expect(hashBattle(runBattle(defense, 42, [defenseInputs[0]!], data, 200))).not.toBe(ref);
  });

  it('eine Wiederholung lässt sich nachrechnen, eine verfälschte fällt auf', () => {
    const final = runBattle(attack, 42, attackInputs, data);
    const replay = JSON.parse(JSON.stringify(makeReplay(attack, 42, attackInputs, final, data)));
    expect(verifyReplay(replay, data)).toBe('ok');
    expect(verifyReplay({ ...replay, seed: 41 }, data)).toBe('result_mismatch');
    expect(verifyReplay({ ...replay, inputs: replay.inputs.slice(0, 2) }, data)).toBe('result_mismatch');
    expect(verifyReplay({ ...replay, setup: { ...replay.setup, gateHp: 1 } }, data)).toBe('result_mismatch');
    expect(verifyReplay({ ...replay, dataVersion: '0' }, data)).toBe('data_version_mismatch');
  });

  it('der Eingangszustand bleibt unberührt', () => {
    const start = createBattle(defense, 1, data);
    const frozen = JSON.stringify(start);
    stepBattle(start, [build('s1')], data);
    expect(JSON.stringify(start)).toBe(frozen);
  });
});

describe('Verteidigung', () => {
  it('Bauen und Ausbauen kosten Gold und werden geprüft', () => {
    let s = createBattle(defense, 1, data);
    expect(validateBattleAction(s, build('gibt_es_nicht'), data)).toBe('unknown_slot');
    expect(validateBattleAction(s, build('s1', 'kanone'), data)).toBe('unknown_tower');
    expect(validateBattleAction(s, build('s6'), data)).toBe('slot_locked');
    expect(validateBattleAction(s, build('s1', 'katapult'), data)).toBe('tower_locked');
    expect(validateBattleAction(s, { type: 'UpgradeTower', slot: 's1' }, data)).toBe('slot_empty');
    expect(validateBattleAction(s, release, data)).toBe('not_your_side');
    s = stepBattle(s, [build('s1')], data);
    expect(s.gold).toBe(50);
    expect(validateBattleAction(s, build('s1'), data)).toBe('slot_occupied');
    expect(validateBattleAction(s, { type: 'UpgradeTower', slot: 's1' }, data)).toBe('not_enough_gold');
    const up = stepBattle({ ...s, gold: 200 }, [{ type: 'UpgradeTower', slot: 's1' }], data);
    expect(up.gold).toBe(120);
    // Höhere Stufen brauchen einen höheren Burgfried; ganz oben ist Schluss.
    expect(validateBattleAction(up, { type: 'UpgradeTower', slot: 's1' }, data)).toBe('level_locked');
    const top = data.towers.towers[0]!.levels.length;
    const maxed = { ...up, setup: { ...up.setup, keepLevel: 8 }, towers: up.towers.map((tw) => ({ ...tw, level: top })) };
    expect(validateBattleAction(maxed, { type: 'UpgradeTower', slot: 's1' }, data)).toBe('max_level');
    expect(stepBattle(s, [build('s1'), { type: 'UpgradeTower', slot: 's2' }, release], data)).toEqual(stepBattle(s, [], data));
  });

  it('Gold am Ende = Start - Baukosten + Kopfgeld je besiegtem Angreifer', () => {
    const final = runBattle(defense, 7, defenseInputs, data);
    const bounty = final.fallen.reduce((sum, id) => sum + data.units.units.find((u) => u.id === id)!.bounty, 0);
    expect(final.gold).toBe(100 - 50 - 50 + bounty);
    const total = wave('dorf_w2').groups.reduce((n, g) => n + g.count, 0);
    expect(killedCount(final) + final.leaked).toBe(total);
  });

  it('ohne Türme fällt der Burgfried, wenn die Schlacht verlierbar ist', () => {
    const final = runBattle({ ...defense, waves: [wave('dorf_loop')] }, 1, [], data);
    expect(final.result).toBe('breached');
    expect(final.depth).toBe(3);
  });

  it('das Katapult trifft dichte Gruppen, die Heldin verstärkt ihren Abschnitt', () => {
    const dense: BattleSetup = { ...defense, keepLevel: 2, unlosable: true, waves: [{ groups: [{ unit: 'raeuber', count: 16, startTick: 0, intervalTicks: 4, jitterTicks: 0 }] }] };
    const kills = (setup: BattleSetup): number => killedCount(runBattle(setup, 5, [], data));
    const bow = kills({ ...dense, towers: [{ slot: 's1', def: 'bogenturm', level: 1 }] });
    const catapult = kills({ ...dense, towers: [{ slot: 's1', def: 'katapult', level: 1 }] });
    const withHero = kills({ ...dense, towers: [{ slot: 's1', def: 'bogenturm', level: 1 }], heroSection: 'nord' });
    const heroElsewhere = kills({ ...dense, towers: [{ slot: 's1', def: 'bogenturm', level: 1 }], heroSection: 'sued' });
    expect(catapult).toBeGreaterThan(bow);
    expect(withHero).toBeGreaterThan(bow);
    expect(heroElsewhere).toBe(bow);
  });
});

describe('Eingreifen des Verteidigers', () => {
  const active: BattleSetup = { ...defense, volley: true, rally: true, towers: [{ slot: 's1', def: 'bogenturm', level: 1 }], unlosable: true };

  it('Pfeilhagel trifft alle Angreifer im Umkreis des Punktes, bringt Kopfgeld und hat eine Abklingzeit', () => {
    let s = createBattle({ ...active, towers: [] }, 3, data);
    for (let i = 0; i < 120; i++) s = stepBattle(s, [], data);
    const road = data.roads.roads[0]!;
    const target = s.units[0]!;
    const [x, y] = roadPointMilli(road, target.pos);
    const near = s.units.filter((u) => { const [ux, uy] = roadPointMilli(road, u.pos); return (ux - x) ** 2 + (uy - y) ** 2 <= data.rules.volley.radiusMilli ** 2; });
    const after = stepBattle(s, [{ type: 'Volley', x, y }], data);
    for (const u of near) {
      const hit = after.units.find((a) => a.id === u.id);
      const armor = data.units.units.find((d) => d.id === u.def)!.armor;
      if (hit) expect(hit.hp).toBe(u.hp - (data.rules.volley.damage - armor));
      else expect(u.hp).toBeLessThanOrEqual(data.rules.volley.damage - armor);
    }
    const far = s.units.filter((u) => !near.includes(u));
    for (const u of far) expect(after.units.find((a) => a.id === u.id)?.hp).toBe(u.hp);
    expect(after.volleyReadyAt).toBe(s.tick + data.rules.volley.cooldownTicks);
    expect(validateBattleAction(after, { type: 'Volley', x, y }, data)).toBe('ability_not_ready');
    expect(validateBattleAction(s, { type: 'Volley', x: 1.5, y }, data)).toBe('invalid_target');
  });

  it('ohne Freigabe im Startzustand gibt es weder Pfeilhagel noch Kampfruf; der Angreifer hat sie nie', () => {
    const plain = createBattle(defense, 1, data);
    expect(validateBattleAction(plain, { type: 'Volley', x: 0, y: 0 }, data)).toBe('unknown_ability');
    expect(validateBattleAction(plain, { type: 'Rally' }, data)).toBe('unknown_ability');
    expect(validateBattleAction(createBattle(attack, 1, data), { type: 'Volley', x: 0, y: 0 }, data)).toBe('not_your_side');
  });

  it('Kampfruf: Türme schießen für die Dauer doppelt so schnell', () => {
    const shots = (rally: boolean): number => {
      let s = createBattle(active, 3, data);
      let n = 0;
      let last = -1;
      for (let i = 0; i < 60 + data.hero.rally.durationTicks; i++) {
        s = stepBattle(s, rally && i === 60 ? [{ type: 'Rally' }] : [], data);
        const t = s.towers[0]!;
        if (i >= 60 && t.lastShotTick !== last) n++;
        last = t.lastShotTick;
      }
      return n;
    };
    expect(shots(true)).toBeGreaterThan(shots(false) * 1.5);
    const s = stepBattle(createBattle(active, 3, data), [{ type: 'Rally' }], data);
    expect(s.hasteUntil).toBe(data.hero.rally.durationTicks);
    expect(validateBattleAction(s, { type: 'Rally' }, data)).toBe('ability_not_ready');
  });

  it('wer eingreift, lässt weniger Angreifer durch als wer zuschaut', () => {
    const w3: BattleSetup = { ...active, waves: [wave('dorf_w3')], rally: false };
    const passive = runBattle(w3, 5, [], data);
    let s = createBattle(w3, 5, data);
    const road = data.roads.roads[0]!;
    while (s.result === 'running') {
      const front = s.units.reduce<typeof s.units[number] | null>((a, b) => (a && a.pos > b.pos ? a : b), null);
      const act: BattleAction[] = front && s.tick >= s.volleyReadyAt ? [{ type: 'Volley', x: roadPointMilli(road, front.pos)[0], y: roadPointMilli(road, front.pos)[1] }] : [];
      s = stepBattle(s, act, data);
    }
    expect(s.leaked).toBeLessThan(passive.leaked);
  });
});

describe('Haltepunkt und Unverlierbarkeit', () => {
  const first: BattleSetup = { ...defense, waves: [wave('dorf_w1')], gold: 50, unlosable: true, holdMilliUntilTower: data.tutorial.defenses[0]!.holdMilliUntilTower };
  const firstCount = wave('dorf_w1').groups.reduce((n, g) => n + g.count, 0);

  it('ohne ersten Turm wartet die Welle am Haltepunkt, beliebig lange', () => {
    const s = runBattle(first, 3, [], data, 3000);
    expect(s.result).toBe('running');
    expect(s.units[0]!.pos).toBeGreaterThanOrEqual(first.holdMilliUntilTower);
    expect(s.units[0]!.pos).toBeLessThan(first.holdMilliUntilTower + 100);
    expect(s.units.length + s.pending.length).toBe(firstCount);
    expect(s.leaked).toBe(0);
  });

  it('Warten kostet nichts: gleiches Ergebnis wie bei sofortigem Bau', () => {
    const late = runBattle(first, 3, [{ tick: 400, action: build('s1') }], data);
    expect(late.result).toBe('held');
    const early = runBattle(first, 3, [{ tick: 0, action: build('s1') }], data);
    expect(killedCount(late)).toBe(killedCount(early));
    expect(late.leaked).toBe(early.leaked);
    expect(killedCount(late) + late.leaked).toBe(firstCount);
  });

  it('unverlierbare Schlachten gehen bei beliebigen Eingaben nie verloren', () => {
    const slots = ['s1', 's2', 's3', 's4', 's5', 's6', 'x'];
    for (let seed = 1; seed <= 40; seed++) {
      const rng = rngFromSeed(seed);
      const random: BattleInput[] = [];
      for (let tick = 0; tick < 1500; tick += 1 + rngInt(rng, 40)) {
        const slot = slots[rngInt(rng, slots.length)]!;
        const kind = rngInt(rng, 4);
        random.push({ tick, action: kind === 0 ? build(slot) : kind === 1 ? { type: 'UpgradeTower', slot } : kind === 2 ? build(slot, 'katapult') : rngInt(rng, 2) === 0 ? release : { type: 'Volley', x: rngInt(rng, 9000), y: rngInt(rng, 14000) } });
      }
      for (const def of data.tutorial.defenses) {
        const s = runBattle({ ...first, volley: true, rally: true, waves: [wave(def.wave)], holdMilliUntilTower: def.holdMilliUntilTower }, seed, random, data);
        expect(s.result).not.toBe('breached');
        expect(s.keepHp).toBe(10);
      }
    }
  });
});

describe('Angriff', () => {
  it('der Angreifer löst Wellen aus, baut aber nicht', () => {
    const s = createBattle(attack, 1, data);
    expect(validateBattleAction(s, build('s2'), data)).toBe('not_your_side');
    expect(validateBattleAction(s, release, data)).toBeNull();
    const all = runBattle(attack, 1, [0, 1, 2].map((tick) => ({ tick, action: release })), data, 3);
    expect(all.releasedWaves).toBe(3);
    expect(validateBattleAction(all, release, data)).toBe('no_wave_left');
  });

  it('vor dem Tor halten die Truppen an; Rammböcke brechen es schneller', () => {
    const only = (unit: string, count: number): BattleSetup => ({ ...attack, towers: [], waves: [{ groups: [{ unit, count, startTick: 0, intervalTicks: 8, jitterTicks: 0 }] }] });
    const gateFallsAt = (setup: BattleSetup): number => {
      let s = createBattle(setup, 1, data);
      s = stepBattle(s, [release], data);
      while (s.gateHp > 0 && s.result === 'running') {
        expect(Math.max(0, ...s.units.map((u) => u.pos))).toBeLessThanOrEqual(data.rules.gateMilli);
        expect(s.depth).toBe(0);
        s = stepBattle(s, [], data);
      }
      return s.tick;
    };
    expect(gateFallsAt(only('ramme', 2))).toBeLessThan(gateFallsAt(only('leicht', 2)));
  });

  it('die Durchbruchstiefe steigt in drei Stufen und nie zurück', () => {
    let s = createBattle({ ...attack, towers: [] }, 1, data);
    s = stepBattle(s, [release], data);
    const seen = [0];
    while (s.result === 'running') {
      s = stepBattle(s, [], data);
      expect(s.depth).toBeGreaterThanOrEqual(seen[seen.length - 1]!);
      if (s.depth !== seen[seen.length - 1]) seen.push(s.depth);
    }
    expect(seen).toEqual([0, 1, 2, 3]);
    expect(s.result).toBe('breached');
  });

  it('nach der Zeitgrenze endet die Schlacht zugunsten des Verteidigers', () => {
    const s = runBattle(attack, 1, [], data);
    expect(s.result).toBe('held');
    expect(s.tick).toBe(1800);
    expect(s.depth).toBe(0);
  });

  it('Fähigkeiten: Brandpfeile legen einen Turm lahm, Schildwall senkt den Schaden, beide haben Abklingzeit', () => {
    let s = createBattle(attack, 1, data);
    expect(validateBattleAction(s, { type: 'UseAbility', ability: 'brandpfeile', slot: null }, data)).toBe('target_required');
    expect(validateBattleAction(s, { type: 'UseAbility', ability: 'brandpfeile', slot: 's2' }, data)).toBe('slot_empty');
    expect(validateBattleAction(s, { type: 'UseAbility', ability: 'feuerball', slot: null }, data)).toBe('unknown_ability');
    s = stepBattle(s, [{ type: 'UseAbility', ability: 'brandpfeile', slot: 's1' }], data);
    expect(s.towers[0]!.disabledUntil).toBe(140);
    expect(validateBattleAction(s, { type: 'UseAbility', ability: 'brandpfeile', slot: 's1' }, data)).toBe('ability_not_ready');

    const light: BattleSetup = { ...attack, gateHp: 0, waves: [{ groups: [{ unit: 'leicht', count: 6, startTick: 0, intervalTicks: 8, jitterTicks: 0 }] }] };
    const fallen = (extra: BattleInput[]): number => killedCount(runBattle(light, 1, [{ tick: 0, action: release }, ...extra], data));
    const plain = fallen([]);
    expect(fallen([{ tick: 1, action: { type: 'UseAbility', ability: 'brandpfeile', slot: 's1' } }])).toBeLessThan(plain);
    expect(fallen([{ tick: 20, action: { type: 'UseAbility', ability: 'schildwall', slot: null } }])).toBeLessThan(plain);
  });

  it('Gepanzerte halten mehr aus als Leichte', () => {
    const one = (unit: string): BattleSetup => ({ ...attack, gateHp: 0, towers: [{ slot: 's1', def: 'bogenturm', level: 1 }, { slot: 's2', def: 'bogenturm', level: 1 }, { slot: 's3', def: 'bogenturm', level: 1 }], waves: [{ groups: [{ unit, count: 3, startTick: 0, intervalTicks: 20, jitterTicks: 0 }] }] });
    const depth = (unit: string): number => runBattle(one(unit), 1, [{ tick: 0, action: release }], data).depth;
    expect(depth('gepanzert')).toBeGreaterThanOrEqual(depth('leicht'));
  });
});
