import { MILLI, PERMILLE, mulDiv } from '../fixed.ts';
import { findById, type CityTowerRef, type GameData, type RoadDef, type TowerLevelDef, type UnitDef, type WaveGroupDef } from '../data.ts';
import { roadLengthMilli, roadPointMilli } from '../road.ts';
import { rngFromSeed, rngInt, type RngState } from '../rng.ts';

/**
 * Schlacht-Simulation, Stand M3. Verteidigung und Angriff sind dieselbe Schlacht:
 * Angreifer laufen die Straße vom Torhaus zum Burgfried, Türme auf Bauplätzen schießen von selbst.
 * Nur die Seite des Spielers unterscheidet sich (`playerSide`) und damit, welche Eingaben er hat.
 *
 * Reihenfolge innerhalb eines Ticks (verbindlich, auch für die C#-Fassung):
 *   1. Eingaben dieses Ticks in Listenreihenfolge anwenden (ungültige werden übergangen)
 *   2. Fällige Einheiten in Planreihenfolge aufstellen
 *   3. Einheiten in Reihenfolge ihrer Kennung bewegen (Pechnasen bremsen); vor einem stehenden Tor und vor
 *      stehender Miliz halten sie an und beschädigen sie
 *      (Schritte 2 und 3 entfallen, solange die Welle am Haltepunkt steht; siehe `frozen`)
 *   4. Am Burgfried angekommene Einheiten entfernen, Burgfried-Schaden
 *   5. Türme in Reihenfolge der Bauplätze der Stadt: Abklingzeit oder Wirkung (Schuss, Pech, Miliz)
 *   6. Durchbruchstiefe und Ergebnis prüfen, Tick hochzählen
 */

export type CityTower = CityTowerRef;

export interface BattleWave {
  readonly groups: readonly WaveGroupDef[];
}

/** Startzustand einer Schlacht. Zusammen mit Startwert und Eingaben ist sie vollständig bestimmt. */
export interface BattleSetup {
  /** Der Verteidiger baut Türme, der Angreifer löst Wellen aus und setzt Fähigkeiten ein. */
  readonly playerSide: 'defender' | 'attacker';
  readonly roadId: string;
  /** Burgfried-Stufe der verteidigten Stadt (bestimmt bebaubare Plätze und Turmtypen). */
  readonly keepLevel: number;
  readonly towers: readonly CityTower[];
  /** Gold des Verteidigers für Türme während der Schlacht. */
  readonly gold: number;
  readonly keepHp: number;
  readonly unlosable: boolean;
  /** Solange kein Turm steht, hält die Welle an, sobald der vorderste Angreifer diese Wegstrecke erreicht (0 = aus). */
  readonly holdMilliUntilTower: number;
  /** Mauerabschnitt, den der Held des Verteidigers verstärkt. */
  readonly heroSection: string | null;
  readonly gateHp: number;
  readonly waves: readonly BattleWave[];
  /** Alle Wellen laufen bei Tick 0 los. */
  readonly autoRelease: boolean;
  /** Fähigkeiten des Angreifer-Helden. */
  readonly abilities: readonly string[];
  /** Nach so vielen Ticks endet die Schlacht zugunsten des Verteidigers (0 = keine Grenze). */
  readonly maxTicks: number;
}

export type BattleAction =
  | { readonly type: 'ReleaseWave' }
  | { readonly type: 'BuildTower'; readonly slot: string; readonly tower: string }
  | { readonly type: 'UpgradeTower'; readonly slot: string }
  | { readonly type: 'UseAbility'; readonly ability: string; readonly slot: string | null };

export interface BattleInput {
  readonly tick: number;
  readonly action: BattleAction;
}

export interface Unit {
  readonly id: number;
  readonly def: string;
  readonly pos: number;
  readonly hp: number;
}

export interface PendingSpawn {
  readonly tick: number;
  readonly def: string;
}

export interface BattleTower extends CityTower {
  /** Ticks bis zum nächsten Schuss. */
  readonly cooldown: number;
  /** Bis zu diesem Tick außer Gefecht (Brandpfeile). */
  readonly disabledUntil: number;
  /** Letzter Schuss, nur für die Darstellung (-1 = noch keiner). Ort in Milli-Kacheln. */
  readonly lastShotTick: number;
  readonly targetX: number;
  readonly targetY: number;
  /** Von diesem Turm besiegte Angreifer (für die Schwachstellen-Auswertung). */
  readonly kills: number;
  /** Wachstube: Leben der Miliz, Tick ihres Nachrückens und ihr Standort als Wegstrecke. */
  readonly militiaHp: number;
  readonly militiaRespawnAt: number;
  readonly militiaPos: number;
}

/** `held`: der Verteidiger hat gehalten. `breached`: der Burgfried ist gefallen. */
export type BattleResult = 'running' | 'held' | 'breached';

export interface BattleState {
  readonly tick: number;
  readonly rng: RngState;
  readonly setup: BattleSetup;
  readonly roadLength: number;
  readonly releasedWaves: number;
  /** Aufsteigend nach Tick, bei Gleichstand in Planreihenfolge. */
  readonly pending: readonly PendingSpawn[];
  readonly units: readonly Unit[];
  readonly nextUnitId: number;
  readonly towers: readonly BattleTower[];
  readonly gold: number;
  readonly keepHp: number;
  readonly gateHp: number;
  /** Durchbruchstiefe: 0 nichts, 1 Tor genommen, 2 Marktplatz erreicht, 3 Burgfried erreicht. */
  readonly depth: number;
  /** Bis zu diesem Tick nehmen Angreifer verringerten Schaden (Schildwall). */
  readonly shieldUntil: number;
  /** Je Fähigkeit aus `setup.abilities`: frühester Tick des nächsten Einsatzes. */
  readonly abilityReadyAt: readonly number[];
  /** Besiegte Angreifer in Reihenfolge ihres Falls (Einheitentyp). */
  readonly fallen: readonly string[];
  readonly leaked: number;
  readonly result: BattleResult;
}

export type ActionError =
  | 'battle_done'
  | 'not_your_side'
  | 'no_wave_left'
  | 'unknown_slot'
  | 'unknown_tower'
  | 'slot_occupied'
  | 'slot_empty'
  | 'slot_locked'
  | 'tower_locked'
  | 'max_level'
  | 'not_enough_gold'
  | 'unknown_ability'
  | 'ability_not_ready'
  | 'target_required';

/** Wie viele Angreifer gefallen sind. */
export function killedCount(state: BattleState): number {
  return state.fallen.length;
}

function planWave(wave: BattleWave, startTick: number, rng: RngState): PendingSpawn[] {
  const plan: PendingSpawn[] = [];
  for (const g of wave.groups) {
    for (let i = 0; i < g.count; i++) {
      plan.push({ tick: startTick + g.startTick + i * g.intervalTicks + rngInt(rng, g.jitterTicks + 1), def: g.unit });
    }
  }
  return plan;
}

/** Stabile Sortierung: gleiche Ticks behalten die bisherige Reihenfolge. */
function sortPending(list: readonly PendingSpawn[]): PendingSpawn[] {
  return list.map((p, i) => ({ p, i })).sort((a, b) => a.p.tick - b.p.tick || a.i - b.i).map((x) => x.p);
}

/** Abstand der Probepunkte, mit denen der Standort der Miliz auf der Straße gesucht wird. */
const MILITIA_SEARCH_STEP = 250;

/**
 * Standort der Miliz: der Punkt der Straße, der dem Bauplatz am nächsten liegt (bei Gleichstand der frühere),
 * gesucht in festen Schritten hinter dem Tor.
 */
export function militiaPosition(road: RoadDef, slotX: number, slotY: number, data: GameData): number {
  const length = roadLengthMilli(road);
  let best = data.rules.gateMilli + MILITIA_SEARCH_STEP;
  let bestDist = -1;
  for (let pos = best; pos < length; pos += MILITIA_SEARCH_STEP) {
    const [x, y] = roadPointMilli(road, pos);
    const dx = x - slotX * MILLI;
    const dy = y - slotY * MILLI;
    const dist = dx * dx + dy * dy;
    if (bestDist < 0 || dist < bestDist) {
      best = pos;
      bestDist = dist;
    }
  }
  return best;
}

function newTower(t: CityTower, road: RoadDef, data: GameData): BattleTower {
  const def = findById(data.towers.towers, t.def, 'Turm');
  const slot = findById(data.city.towerSlots, t.slot, 'Bauplatz');
  const militia = def.kind === 'militia';
  return {
    slot: t.slot, def: t.def, level: t.level, cooldown: 0, disabledUntil: 0, lastShotTick: -1, targetX: 0, targetY: 0, kills: 0,
    militiaHp: militia ? towerLevel(t, data).militiaHp : 0,
    militiaRespawnAt: 0,
    militiaPos: militia ? militiaPosition(road, slot.x, slot.y, data) : 0,
  };
}

export function towerLevel(t: CityTower, data: GameData): TowerLevelDef {
  const level = findById(data.towers.towers, t.def, 'Turm').levels[t.level - 1];
  if (!level) throw new Error(`Turm ${t.def}: Stufe ${t.level} fehlt`);
  return level;
}

export type TowerActionError = 'unknown_slot' | 'unknown_tower' | 'slot_occupied' | 'slot_empty' | 'slot_locked' | 'tower_locked' | 'max_level';

/**
 * Goldkosten für Bau oder Ausbau eines Turms, oder der Grund, warum es nicht geht.
 * Dieselbe Regel gilt in der Schlacht und im Stadtbau.
 */
export function towerActionCost(
  towers: readonly CityTower[],
  keepLevel: number,
  action: { readonly type: 'BuildTower'; readonly slot: string; readonly tower: string } | { readonly type: 'UpgradeTower'; readonly slot: string },
  data: GameData,
): number | TowerActionError {
  const slot = data.city.towerSlots.find((s) => s.id === action.slot);
  if (!slot) return 'unknown_slot';
  if (slot.keepLevel > keepLevel) return 'slot_locked';
  const tower = towers.find((t) => t.slot === action.slot);
  if (action.type === 'BuildTower') {
    const def = data.towers.towers.find((t) => t.id === action.tower);
    if (!def) return 'unknown_tower';
    if (def.keepLevel > keepLevel) return 'tower_locked';
    if (tower) return 'slot_occupied';
    return def.levels[0]!.cost;
  }
  if (!tower) return 'slot_empty';
  const next = findById(data.towers.towers, tower.def, 'Turm').levels[tower.level];
  return next ? next.cost : 'max_level';
}

export function createBattle(setup: BattleSetup, seed: number, data: GameData): BattleState {
  const road = findById(data.roads.roads, setup.roadId, 'Straße');
  const rng = rngFromSeed(seed);
  let pending: PendingSpawn[] = [];
  if (setup.autoRelease) {
    for (const wave of setup.waves) pending = pending.concat(planWave(wave, 0, rng));
    pending = sortPending(pending);
  }
  return {
    tick: 0,
    rng,
    setup,
    roadLength: roadLengthMilli(road),
    releasedWaves: setup.autoRelease ? setup.waves.length : 0,
    pending,
    units: [],
    nextUnitId: 1,
    towers: setup.towers.map((t) => newTower(t, road, data)),
    gold: setup.gold,
    keepHp: setup.keepHp,
    gateHp: setup.gateHp,
    depth: 0,
    shieldUntil: 0,
    abilityReadyAt: setup.abilities.map(() => 0),
    fallen: [],
    leaked: 0,
    result: 'running',
  };
}

/** Prüft eine Eingabe gegen den Zustand. `null` heißt gültig. */
export function validateBattleAction(state: BattleState, action: BattleAction, data: GameData): ActionError | null {
  if (state.result !== 'running') return 'battle_done';
  switch (action.type) {
    case 'ReleaseWave':
      if (state.setup.playerSide !== 'attacker') return 'not_your_side';
      return state.releasedWaves < state.setup.waves.length ? null : 'no_wave_left';
    case 'BuildTower':
    case 'UpgradeTower': {
      if (state.setup.playerSide !== 'defender') return 'not_your_side';
      const cost = towerActionCost(state.towers, state.setup.keepLevel, action, data);
      if (typeof cost !== 'number') return cost;
      return cost > state.gold ? 'not_enough_gold' : null;
    }
    case 'UseAbility': {
      if (state.setup.playerSide !== 'attacker') return 'not_your_side';
      const index = state.setup.abilities.indexOf(action.ability);
      const def = data.hero.abilities.find((a) => a.id === action.ability);
      if (index < 0 || !def) return 'unknown_ability';
      if (state.tick < state.abilityReadyAt[index]!) return 'ability_not_ready';
      if (def.kind === 'disableTower') {
        if (action.slot === null) return 'target_required';
        if (!state.towers.some((t) => t.slot === action.slot)) return 'slot_empty';
      }
      return null;
    }
  }
}

function applyAction(state: BattleState, action: BattleAction, rng: RngState, road: RoadDef, data: GameData): BattleState {
  if (validateBattleAction(state, action, data) !== null) return state;
  switch (action.type) {
    case 'ReleaseWave': {
      const plan = planWave(state.setup.waves[state.releasedWaves]!, state.tick, rng);
      return { ...state, releasedWaves: state.releasedWaves + 1, pending: sortPending([...state.pending, ...plan]) };
    }
    case 'BuildTower': {
      const cost = towerActionCost(state.towers, state.setup.keepLevel, action, data) as number;
      return { ...state, gold: state.gold - cost, towers: [...state.towers, newTower({ slot: action.slot, def: action.tower, level: 1 }, road, data)] };
    }
    case 'UpgradeTower': {
      const cost = towerActionCost(state.towers, state.setup.keepLevel, action, data) as number;
      return { ...state, gold: state.gold - cost, towers: state.towers.map((t) => (t.slot === action.slot ? { ...t, level: t.level + 1 } : t)) };
    }
    case 'UseAbility': {
      const index = state.setup.abilities.indexOf(action.ability);
      const def = findById(data.hero.abilities, action.ability, 'Fähigkeit');
      const abilityReadyAt = state.abilityReadyAt.map((t, i) => (i === index ? state.tick + def.cooldownTicks : t));
      if (def.kind === 'shield') return { ...state, abilityReadyAt, shieldUntil: state.tick + def.durationTicks };
      return {
        ...state,
        abilityReadyAt,
        towers: state.towers.map((t) => (t.slot === action.slot ? { ...t, disabledUntil: state.tick + def.durationTicks } : t)),
      };
    }
  }
}

/** Wegstrecke des Marktplatzes auf einer Straße der Länge `roadLength`. */
export function marketMilli(roadLength: number, data: GameData): number {
  return mulDiv(roadLength, data.rules.marketPermille, PERMILLE);
}

/** Ein Zeitschritt. Ungültige Eingaben werden übergangen und ändern nichts. */
export function stepBattle(state: BattleState, actions: readonly BattleAction[], data: GameData): BattleState {
  if (state.result !== 'running') return state;
  const road: RoadDef = findById(data.roads.roads, state.setup.roadId, 'Straße');
  const rng: RngState = [...state.rng];
  const unitDef = (id: string): UnitDef => findById(data.units.units, id, 'Einheit');

  // 1. Eingaben
  let s = state;
  for (const action of actions) s = applyAction(s, action, rng, road, data);

  // Haltepunkt: Solange kein Turm steht und der vorderste Angreifer dort angekommen ist,
  // steht die Welle still (keine Bewegung, Nachrücker verschieben sich um einen Tick).
  const hold = s.setup.holdMilliUntilTower;
  const frozen = hold > 0 && s.towers.length === 0 && s.units.some((u) => u.pos >= hold);

  /** Arbeitskopie der Türme: Miliz nimmt schon in der Bewegungsphase Schaden. */
  const tw = s.towers.map((t) => ({ ...t }));
  let nextUnitId = s.nextUnitId;
  let pending = s.pending;
  let keepHp = s.keepHp;
  let gateHp = s.gateHp;
  let leaked = s.leaked;
  let units: Unit[] = [];
  if (frozen) {
    pending = pending.map((p) => ({ tick: p.tick + 1, def: p.def }));
    units = [...s.units];
  } else {
    // 2. Aufstellen
    const spawned: Unit[] = [...s.units];
    let due = 0;
    while (due < pending.length && pending[due]!.tick <= s.tick) {
      const def = unitDef(pending[due]!.def);
      spawned.push({ id: nextUnitId++, def: def.id, pos: 0, hp: def.hp });
      due++;
    }
    if (due > 0) pending = pending.slice(due);

    // 3. und 4. Bewegen, Tor, Miliz, Ankunft
    const gate = data.rules.gateMilli;
    const slowers = tw
      .filter((t) => findById(data.towers.towers, t.def, 'Turm').kind === 'slow' && s.tick >= t.disabledUntil)
      .map((t) => ({ slot: findById(data.city.towerSlots, t.slot, 'Bauplatz'), level: towerLevel(t, data) }));
    const guards = tw.filter((t) => findById(data.towers.towers, t.def, 'Turm').kind === 'militia');
    for (const u of spawned) {
      const def = unitDef(u.def);
      let speed = def.speedMilliPerTick;
      if (slowers.length > 0) {
        const [ux, uy] = roadPointMilli(road, u.pos);
        let factor = PERMILLE;
        for (const sl of slowers) {
          const dx = ux - sl.slot.x * MILLI;
          const dy = uy - sl.slot.y * MILLI;
          if (dx * dx + dy * dy <= sl.level.rangeMilli * sl.level.rangeMilli) factor = Math.min(factor, sl.level.slowPermille);
        }
        speed = Math.max(1, mulDiv(speed, factor, PERMILLE));
      }
      let pos = u.pos + speed;
      if (gateHp > 0 && pos >= gate) {
        pos = gate;
        gateHp = Math.max(0, gateHp - def.siege);
      } else {
        for (const g of guards) {
          if (g.militiaHp <= 0 || u.pos > g.militiaPos || pos < g.militiaPos) continue;
          pos = g.militiaPos;
          g.militiaHp = Math.max(0, g.militiaHp - def.melee);
          if (g.militiaHp === 0) g.militiaRespawnAt = s.tick + towerLevel(g, data).militiaRespawnTicks;
          break;
        }
      }
      if (pos >= s.roadLength) {
        leaked++;
        if (!s.setup.unlosable) keepHp = Math.max(0, keepHp - def.keepDamage);
      } else {
        units.push({ id: u.id, def: u.def, pos, hp: u.hp });
      }
    }
  }

  // 5. Türme
  let gold = s.gold;
  let fallen = s.fallen;
  const shielded = s.tick < s.shieldUntil;
  const shieldPermille = data.hero.abilities.find((a) => a.kind === 'shield')?.damageTakenPermille ?? PERMILLE;
  /** Trifft die Einheiten, für die `hit` gilt; liefert die Zahl der Besiegten. */
  const strike = (base: number, ignoreArmor: boolean, militia: boolean, hit: (u: Unit) => boolean): number => {
    let kills = 0;
    const survivors: Unit[] = [];
    for (const u of units) {
      if (!hit(u)) {
        survivors.push(u);
        continue;
      }
      const ud = unitDef(u.def);
      const raw = militia ? mulDiv(base, ud.militiaDamagePermille, PERMILLE) : base;
      let dmg = Math.max(1, raw - (ignoreArmor ? 0 : ud.armor));
      if (shielded) dmg = Math.max(1, mulDiv(dmg, shieldPermille, PERMILLE));
      const hp = u.hp - dmg;
      if (hp <= 0) {
        gold += ud.bounty;
        fallen = [...fallen, u.def];
        kills++;
      } else {
        survivors.push({ id: u.id, def: u.def, pos: u.pos, hp });
      }
    }
    units = survivors;
    return kills;
  };
  const towers: BattleTower[] = [];
  for (const slot of data.city.towerSlots) {
    const tower = tw.find((t) => t.slot === slot.id);
    if (!tower) continue;
    if (s.tick < tower.disabledUntil) {
      towers.push(tower);
      continue;
    }
    const def = findById(data.towers.towers, tower.def, 'Turm');
    const level = towerLevel(tower, data);
    if (def.kind === 'militia' && tower.militiaHp <= 0) {
      // Gefallene Miliz rückt nach der Wartezeit nach.
      towers.push(s.tick >= tower.militiaRespawnAt ? { ...tower, militiaHp: level.militiaHp, cooldown: 0 } : tower);
      continue;
    }
    if (tower.cooldown > 0) {
      towers.push({ ...tower, cooldown: tower.cooldown - 1 });
      continue;
    }
    const base = slot.section === s.setup.heroSection ? mulDiv(level.damage, PERMILLE + data.hero.sectionBonusPermille, PERMILLE) : level.damage;
    const rangeSq = level.rangeMilli * level.rangeMilli;
    const inRange = (u: Unit): boolean => {
      const [ux, uy] = roadPointMilli(road, u.pos);
      const dx = ux - slot.x * MILLI;
      const dy = uy - slot.y * MILLI;
      return dx * dx + dy * dy <= rangeSq;
    };
    let kills = 0;
    let tx = 0;
    let ty = 0;
    let acted = false;
    if (def.kind === 'slow') {
      // Pechnase: trifft alle in Reichweite, Rüstung schützt nicht.
      acted = units.some(inRange);
      if (acted) kills = strike(base, true, false, inRange);
      tx = slot.x * MILLI;
      ty = slot.y * MILLI;
    } else if (def.kind === 'militia') {
      // Miliz: schlägt die vorderste aufgehaltene Einheit (kleinste Kennung).
      const victim = units.find((u) => u.pos === tower.militiaPos);
      if (victim) {
        acted = true;
        [tx, ty] = roadPointMilli(road, victim.pos);
        kills = strike(base, false, true, (u) => u.id === victim.id);
      }
    } else {
      // Ziel: am weitesten vorgerückte Einheit in Reichweite, bei Gleichstand die mit der kleinsten Kennung.
      let target: Unit | null = null;
      for (const u of units) {
        if (target && u.pos <= target.pos) continue;
        if (inRange(u)) target = u;
      }
      if (target) {
        acted = true;
        [tx, ty] = roadPointMilli(road, target.pos);
        const targetId = target.id;
        const splashSq = def.splashMilli * def.splashMilli;
        kills = strike(base, false, false, (u) => {
          if (u.id === targetId) return true;
          if (def.splashMilli === 0) return false;
          const [ux, uy] = roadPointMilli(road, u.pos);
          return (ux - tx) * (ux - tx) + (uy - ty) * (uy - ty) <= splashSq;
        });
      }
    }
    towers.push(acted ? { ...tower, cooldown: level.cooldownTicks - 1, lastShotTick: s.tick, targetX: tx, targetY: ty, kills: tower.kills + kills } : tower);
  }

  // 6. Durchbruchstiefe und Ergebnis
  let depth = s.depth;
  let front = 0;
  for (const u of units) front = Math.max(front, u.pos);
  if (depth < 1 && gateHp <= 0 && front > data.rules.gateMilli) depth = 1;
  if (depth < 2 && front >= marketMilli(s.roadLength, data)) depth = 2;
  if (leaked > 0) depth = 3;

  const tick = s.tick + 1;
  let result: BattleResult = 'running';
  if (keepHp <= 0) result = 'breached';
  else if (s.releasedWaves === s.setup.waves.length && pending.length === 0 && units.length === 0) result = 'held';
  else if (s.setup.maxTicks > 0 && tick >= s.setup.maxTicks) result = 'held';

  return { ...s, tick, rng, pending, units, nextUnitId, towers, gold, keepHp, gateHp, depth, fallen, leaked, result };
}

/**
 * Prüfsumme des Zustands (FNV-1a, 32 Bit, über eine feste Folge von Ganzzahlen).
 * Dient dem Vergleich von Wiederholungen, später auch gegen die C#-Fassung.
 * Felder nur für die Darstellung bleiben außen vor.
 */
export function hashBattle(state: BattleState): number {
  let h = 0x811c9dc5;
  const add = (n: number): void => {
    for (let shift = 0; shift < 32; shift += 8) {
      h = Math.imul(h ^ ((n >>> shift) & 0xff), 0x01000193) >>> 0;
    }
  };
  add(state.tick);
  for (const w of state.rng) add(w);
  add(state.releasedWaves);
  add(state.pending.length);
  for (const p of state.pending) add(p.tick);
  add(state.units.length);
  for (const u of state.units) {
    add(u.id);
    add(u.pos);
    add(u.hp);
  }
  add(state.nextUnitId);
  add(state.towers.length);
  for (const t of state.towers) {
    add(t.level);
    add(t.cooldown);
    add(t.disabledUntil);
    add(t.kills);
    add(t.militiaHp);
    add(t.militiaRespawnAt);
  }
  add(state.gold);
  add(state.keepHp);
  add(state.gateHp);
  add(state.depth);
  add(state.shieldUntil);
  for (const t of state.abilityReadyAt) add(t);
  add(state.fallen.length);
  add(state.leaked);
  add(state.result === 'running' ? 0 : state.result === 'held' ? 1 : 2);
  return h;
}
