import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import {
  MILLI, attackSetup, canAfford, cityHint, createBattle, createGame, defaultLineup, defenseDef, defenseSetup, findById, hashBattle,
  readyTroops, reduceGame, roadLengthMilli, roadPointMilli, stepBattle, towerActionCost, tutorialStep, unlocked, validateBattleAction, validateGameAction,
  type BattleAction, type BattleInput, type BattleState, type GameAction, type GameState, type Resources, type SavedReplay, type UnitCount,
} from '../sim/index.ts';
import { drawStage, formatSeconds, targetAt, tileCenter, type Effect, type Layout, type Scene } from '../render/stage.ts';
import { Hud, type Btn, type HudModel, type MapNode, type StepperRow } from '../ui/Hud.tsx';
import { gameData as data } from './data.ts';
import { consumeTicks } from './loop.ts';
import { loadGame, saveGame } from './save.ts';
import { t } from './texts.ts';

/**
 * Hülle um die Spiellogik: Uhr, Zufalls-Startwert, Speicher, Bildschleife und der Wechsel zwischen
 * den Ansichten leben hier, nie in `src/sim/`. Die Oberfläche ändert den Spielzustand nur über
 * `dispatch` (Spielaktionen) und `battleAct` (Schlachtaktionen).
 */
type Screen =
  | { kind: 'city' }
  | { kind: 'battle'; side: 'defense' | 'attack'; battle: BattleState; inputs: BattleInput[]; queued: BattleAction[]; camp: string; lineup: UnitCount[][]; targeting: string | null }
  | { kind: 'attackSetup'; camp: string; lineup: UnitCount[][] }
  | { kind: 'result' }
  | { kind: 'world' }
  | { kind: 'replays' }
  | { kind: 'replay'; saved: SavedReplay; battle: BattleState; next: number; speed: number; verdict: 'ok' | 'mismatch' | null };

type Sheet = null | { kind: 'tower'; slot: string } | { kind: 'building'; plot: string } | { kind: 'keep' } | { kind: 'hero' } | { kind: 'train' } | { kind: 'alliance' } | { kind: 'goals' };

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;
const tickMs = 1000 / data.game.ticksPerSecond;
const BANNER_MS = 1800;
const EFFECT_KEEP_MS = 1000;
const SAVE_EVERY_MS = 5000;
const heroName = t(`hero.${data.hero.id}`);

/** Uhr der Hülle. Der Versatz ist der Zeitraffer für Tests und die Entwicklerseite. */
let clockOffsetMs = 0;
const clock = (): number => Date.now() + clockOffsetMs;

let game: GameState = loadGame(localStorage, data) ?? createGame(crypto.getRandomValues(new Uint32Array(1))[0] ?? 1, clock(), data);
let screen: Screen = { kind: 'city' };
let sheet: Sheet = null;
let effects: Effect[] = [];
let banner: { text: string; until: number; then: (() => void) | null } | null = null;
let goldDeniedUntil = 0;
let layout: Layout | null = null;
let desync = false;
let speedFactor = 1;
let lastSaveMs = 0;
/** Sieggold der laufenden Verteidigung, für die Anzeige danach. */
let victoryGold = 0;
/** Nach einer Wiederholung hervorgehobener schwacher Abschnitt. */
let weak: { section: string; until: number } | null = null;
const WEAK_MS = 12000;

// ---------- Spielzustand ändern ----------

function save(): void {
  saveGame(localStorage, game);
  lastSaveMs = performance.now();
}

function tickClock(): void {
  const now = clock();
  if (now <= game.now) return;
  const before = game;
  game = reduceGame(game, { type: 'AdvanceTime', now }, data).state;
  if (before.hero.joined !== game.hero.joined) showBanner(t('banner.hero', { name: heroName }), null);
  // PLATZHALTER Bot-Allianz: jede angerechnete Hilfe wird als kleiner Text an der Baustelle gezeigt.
  for (const b of game.buildings) {
    const old = before.buildings.find((x) => x.plot === b.plot);
    const plot = data.city.plots.find((p) => p.id === b.plot);
    if (!old || !plot) continue;
    for (let i = old.helpsReceived; i < b.helpsReceived; i++) {
      const member = data.alliance.members[i % data.alliance.members.length]!;
      effects.push({ kind: 'text', x: plot.x, y: plot.y - (i - old.helpsReceived) * 0.5, text: t('help.given', { name: t(`member.${member}`) }), start: performance.now() });
    }
  }
  for (const key of ['gold', 'wood', 'stone'] as const) {
    const gain = game.resources[key] - before.resources[key];
    if (gain <= 0) continue;
    const source = game.buildings.find((b) => findById(data.buildings.buildings, b.def, 'Gebäude').producePerHour[key] > 0);
    const plot = source && data.city.plots.find((p) => p.id === source.plot);
    if (plot) effects.push({ kind: 'text', x: plot.x, y: plot.y, text: `+${gain}`, start: performance.now() });
  }
}

/** Einzige Stelle, an der die Oberfläche den Spielzustand ändert. */
function dispatch(action: GameAction): boolean {
  tickClock();
  const result = reduceGame(game, action, data);
  if (result.error) return false;
  game = result.state;
  save();
  return true;
}

function showBanner(text: string, then: (() => void) | null): void {
  banner = { text, until: performance.now() + BANNER_MS, then };
}

function deny(x: number, y: number): void {
  effects.push({ kind: 'deny', x, y, text: '', start: performance.now() });
  goldDeniedUntil = performance.now() + 500;
}

// ---------- Ansichten wechseln ----------

function toCity(): void {
  screen = { kind: 'city' };
  sheet = null;
  if (tutorialStep(game, data).autoDefense) startDefense();
}

function startDefense(): void {
  tickClock();
  sheet = null;
  victoryGold = defenseDef(game, data).victoryGold;
  screen = { kind: 'battle', side: 'defense', battle: createBattle(defenseSetup(game, data), game.nextSeed, data), inputs: [], queued: [], camp: '', lineup: [], targeting: null };
}

function startAttack(camp: string, lineup: UnitCount[][]): void {
  tickClock();
  if (validateGameAction(game, { type: 'ResolveAttack', camp, lineup, inputs: [] }, data) !== null) return;
  screen = { kind: 'battle', side: 'attack', battle: createBattle(attackSetup(game, camp, lineup, data), game.nextSeed, data), inputs: [], queued: [], camp, lineup, targeting: null };
}

function startReplay(saved: SavedReplay): void {
  screen = { kind: 'replay', saved, battle: createBattle(saved.replay.setup, saved.replay.seed, data), next: 0, speed: 1, verdict: null };
}

/** Einzige Stelle, an der die Oberfläche in eine Schlacht eingreift: eine geprüfte Aktion einreihen. */
function battleAct(action: BattleAction): boolean {
  if (screen.kind !== 'battle') return false;
  if (validateBattleAction(screen.battle, action, data) !== null) return false;
  screen.queued.push(action);
  return true;
}

function finishBattle(s: Extract<Screen, { kind: 'battle' }>): void {
  const expected = hashBattle(s.battle);
  const ok = s.side === 'defense'
    ? dispatch({ type: 'ResolveDefense', inputs: s.inputs })
    : dispatch({ type: 'ResolveAttack', camp: s.camp, lineup: s.lineup, inputs: s.inputs });
  if (!ok || game.replays[game.replays.length - 1]?.replay.finalHash !== expected) desync = true;
  if (s.side === 'attack') {
    screen = { kind: 'result' };
    return;
  }
  const won = s.battle.result === 'held';
  const lostGold = game.replays[game.replays.length - 1]?.loot.gold ?? 0;
  showBanner(won ? t('banner.victory', { gold: victoryGold }) : lostGold > 0 ? `${t('banner.defeat')} · ${t('banner.lost', { gold: lostGold })}` : t('banner.defeat'), toCity);
}

// ---------- Tippen auf das Spielfeld ----------

function currentRoadId(): string {
  return screen.kind === 'battle' || screen.kind === 'replay' ? screen.battle.setup.roadId : game.roadId;
}

function onTap(clientX: number, clientY: number): void {
  if (!layout || banner?.then) return;
  const rect = canvas.getBoundingClientRect();
  const road = findById(data.roads.roads, currentRoadId(), 'Straße');
  const target = targetAt(layout, road, clientX - rect.left, clientY - rect.top, data);
  if (!target) return;

  if (screen.kind === 'battle' && screen.side === 'attack') {
    if (screen.targeting && target.kind === 'slot' && battleAct({ type: 'UseAbility', ability: screen.targeting, slot: target.id })) screen.targeting = null;
    return;
  }
  const inDefense = screen.kind === 'battle';
  if (screen.kind !== 'city' && !inDefense) return;
  if (sheet || (screen.kind === 'city' && cityPanel() !== null)) return;
  weak = null;

  if (target.kind === 'slot') {
    const slot = findById(data.city.towerSlots, target.id, 'Bauplatz');
    const towers = screen.kind === 'battle' ? screen.battle.towers : game.towers;
    const gold = screen.kind === 'battle' ? screen.battle.gold : game.resources.gold;
    if (slot.keepLevel > game.keepLevel) return;
    if (towers.some((tw) => tw.slot === slot.id)) {
      const cost = towerActionCost(towers, game.keepLevel, { type: 'UpgradeTower', slot: slot.id }, data);
      if (typeof cost !== 'number') return;
      if (cost > gold) deny(slot.x, slot.y);
      else buildTower({ type: 'UpgradeTower', slot: slot.id });
    } else if (availableTowers().length > 1) {
      sheet = { kind: 'tower', slot: slot.id };
    } else {
      const tower = availableTowers()[0]!;
      if (tower.levels[0]!.cost > gold) deny(slot.x, slot.y);
      else buildTower({ type: 'BuildTower', slot: slot.id, tower: tower.id });
    }
    return;
  }
  if (inDefense) return;

  if (target.kind === 'plot') {
    const plot = findById(data.city.plots, target.id, 'Bauplatz');
    const building = game.buildings.find((b) => b.plot === plot.id);
    if (!building) {
      if (buildableBuildings().length > 0) sheet = { kind: 'building', plot: plot.id };
    } else if (building.doneAt > game.now) {
      if (!dispatch({ type: 'SkipTimerFree', plot: plot.id }) && !dispatch({ type: 'RequestHelp', plot: plot.id })) deny(plot.x, plot.y);
      else effects.push({ kind: 'ring', x: plot.x, y: plot.y, text: '', start: performance.now() });
    } else if (building.def === 'kaserne' && unlocked(game, 'train', data)) {
      sheet = { kind: 'train' };
    }
    return;
  }
  if (target.kind === 'keep' && unlocked(game, 'keep', data) && game.keepDoneAt === null && data.city.keepLevels.some((l) => l.level === game.keepLevel + 1)) {
    sheet = { kind: 'keep' };
  }
}

/** Baut oder verbessert einen Turm: in der Schlacht als Schlachtaktion, sonst als Spielaktion. */
function buildTower(action: { type: 'BuildTower'; slot: string; tower: string } | { type: 'UpgradeTower'; slot: string }): void {
  const ok = screen.kind === 'battle' ? battleAct(action) : dispatch(action);
  const slot = findById(data.city.towerSlots, action.slot, 'Bauplatz');
  if (!ok) deny(slot.x, slot.y);
  else if (screen.kind !== 'battle') effects.push({ kind: 'ring', x: slot.x, y: slot.y, text: '', start: performance.now() });
  sheet = null;
}

/** Türme, die der Spieler jetzt bauen darf: Burgfried-Stufe erreicht und im Ablauf freigeschaltet. */
function availableTowers() {
  return data.towers.towers.filter((tw, i) => tw.keepLevel <= game.keepLevel && (i === 0 || unlocked(game, `tower:${tw.id}`, data)));
}

function buildableBuildings() {
  return data.buildings.buildings.filter((b) => unlocked(game, `building:${b.id}`, data) && !game.buildings.some((x) => x.def === b.id));
}

// ---------- Schlacht-Effekte ----------

function addBattleEffects(prev: BattleState, next: BattleState, nowMs: number): void {
  const road = findById(data.roads.roads, next.setup.roadId, 'Straße');
  if (next.fallen.length > prev.fallen.length) {
    for (const u of prev.units) {
      if (next.units.some((n) => n.id === u.id)) continue;
      const def = findById(data.units.units, u.def, 'Einheit');
      if (u.pos + def.speedMilliPerTick >= prev.roadLength) continue;
      const [x, y] = roadPointMilli(road, u.pos);
      if (def.bounty > 0) effects.push({ kind: 'text', x: x / MILLI, y: y / MILLI, text: `+${def.bounty}`, start: nowMs });
    }
  }
  for (const tw of next.towers) {
    const before = prev.towers.find((p) => p.slot === tw.slot);
    if (before && before.level === tw.level) continue;
    const slot = data.city.towerSlots.find((s) => s.id === tw.slot);
    if (slot) effects.push({ kind: 'ring', x: slot.x, y: slot.y, text: '', start: nowMs });
  }
}

// ---------- Darstellung ----------

function weakTile(): Scene['hint'] {
  if (!weak || screen.kind !== 'city') return null;
  const slots = data.city.towerSlots.filter((sl) => sl.section === weak!.section && sl.keepLevel <= game.keepLevel);
  const empty = slots.find((sl) => !game.towers.some((tw) => tw.slot === sl.id));
  const target = empty ?? slots[0];
  return target ? { x: target.x, y: target.y, cost: null } : null;
}

function hintTile(): Scene['hint'] {
  if (banner?.then || sheet) return null;
  if (weak) return weakTile();
  const hint = tutorialStep(game, data).hint;
  if (!hint) return null;
  if (screen.kind === 'battle' && screen.side === 'defense') {
    if (hint.type !== 'slot') return null;
    const occupied = screen.battle.towers.some((tw) => tw.slot === hint.slot);
    const action: BattleAction = occupied ? { type: 'UpgradeTower', slot: hint.slot } : { type: 'BuildTower', slot: hint.slot, tower: hint.tower };
    if (validateBattleAction(screen.battle, action, data) !== null) return null;
    const slot = findById(data.city.towerSlots, hint.slot, 'Bauplatz');
    return { x: slot.x, y: slot.y, cost: null };
  }
  if (screen.kind !== 'city' || game.roadChoicePending) return null;
  const valid = cityHint(game, data);
  if (!valid) return null;
  if (valid.type === 'slot') {
    const slot = findById(data.city.towerSlots, valid.slot, 'Bauplatz');
    const occupied = game.towers.some((tw) => tw.slot === slot.id);
    return { x: slot.x, y: slot.y, cost: occupied ? null : String(findById(data.towers.towers, valid.tower, 'Turm').levels[0]!.cost) };
  }
  if (valid.type === 'plot') {
    const plot = findById(data.city.plots, valid.plot, 'Bauplatz');
    return { x: plot.x, y: plot.y, cost: null };
  }
  if (valid.type === 'keep') {
    const road = findById(data.roads.roads, game.roadId, 'Straße');
    const [x, y] = roadPointMilli(road, roadLengthMilli(road));
    return { x: x / MILLI, y: y / MILLI, cost: null };
  }
  return null;
}

function buildScene(nowMs: number): Scene {
  const cheapestTower = Math.min(...availableTowers().map((tw) => tw.levels[0]!.cost));
  const base = { hint: hintTile(), effects, timeMs: nowMs, cheapestTower, weakSection: screen.kind === 'city' && weak ? weak.section : null };
  if (screen.kind === 'battle' || screen.kind === 'replay') {
    const b = screen.battle;
    const attack = b.setup.playerSide === 'attacker';
    return {
      ...base,
      roadId: b.setup.roadId, keepLevel: b.setup.keepLevel, towers: b.towers, units: b.units, tick: b.tick,
      buildGold: screen.kind === 'battle' && !attack ? b.gold : null,
      buildings: null,
      gate: b.setup.gateHp > 0 ? { hp: b.gateHp, max: b.setup.gateHp } : null,
      showMarket: attack,
      keep: b.setup.unlosable || attack ? null : { hp: b.keepHp, max: b.setup.keepHp },
      keepBusySeconds: null,
      heroSection: b.setup.heroSection,
      enemyCity: attack,
      targeting: screen.kind === 'battle' && screen.targeting !== null,
      shielded: b.tick < b.shieldUntil,
    };
  }
  const labels: Record<string, string> = {};
  for (const b of data.buildings.buildings) labels[b.id] = t(`building.${b.id}`);
  return {
    ...base,
    roadId: game.roadId, keepLevel: game.keepLevel, towers: game.towers, units: [], tick: -1,
    buildGold: game.resources.gold,
    buildings: { list: game.buildings, now: game.now, showEmpty: buildableBuildings().length > 0, labels, helpLabel: game.allianceJoined ? t('help.ask') : null },
    gate: null, showMarket: false, keep: null,
    keepBusySeconds: game.keepDoneAt === null ? null : Math.max(0, Math.ceil((game.keepDoneAt - game.now) / 1000)),
    heroSection: game.hero.section, enemyCity: false, targeting: false, shielded: false,
  };
}

function depthText(depth: number): string {
  return t(`result.depth${depth}`);
}

function buildHud(nowMs: number): HudModel {
  const hint = banner?.then ? null : tutorialStep(game, data).hint;
  const model = {
    resources: game.resources,
    showAllResources: unlocked(game, 'resources', data),
    goldDenied: nowMs < goldDeniedUntil,
    topRight: t('hud.wave', { n: game.defensesWon + 1 }),
    depth: null as number | null,
    banner: banner?.text ?? null,
    bottom: [] as Btn[],
    bottomSecondary: [] as Btn[],
    status: null as string | null,
    map: null as HudModel['map'],
    sheet: null as HudModel['sheet'],
    panel: null as HudModel['panel'],
  };

  if (screen.kind === 'battle') {
    const s = screen;
    const b = s.battle;
    if (s.side === 'defense') return { ...model, resources: { ...game.resources, gold: b.gold }, sheet: towerSheet() };
    const left = Math.max(0, Math.ceil((b.setup.maxTicks - b.tick) / data.game.ticksPerSecond));
    const bottom: Btn[] = [{
      id: 'release', label: t('attack.release', { n: Math.min(b.releasedWaves + 1, b.setup.waves.length) }),
      disabled: b.releasedWaves >= b.setup.waves.length, hint: b.releasedWaves === 0, onClick: () => void battleAct({ type: 'ReleaseWave' }),
    }];
    b.setup.abilities.forEach((id, i) => {
      const def = findById(data.hero.abilities, id, 'Fähigkeit');
      const wait = Math.max(0, Math.ceil(((b.abilityReadyAt[i] ?? 0) - b.tick) / data.game.ticksPerSecond));
      bottom.push({
        id: `ability-${id}`, label: t(`ability.${id}`), sub: wait > 0 ? t('ability.wait', { n: wait }) : s.targeting === id ? t('attack.pickTower') : undefined,
        disabled: wait > 0, active: s.targeting === id,
        onClick: () => {
          if (def.kind === 'disableTower') s.targeting = s.targeting === id ? null : id;
          else battleAct({ type: 'UseAbility', ability: id, slot: null });
        },
      });
    });
    return { ...model, topRight: t('attack.time', { n: left }), depth: b.depth, bottom };
  }

  if (screen.kind === 'replay') {
    const s = screen;
    const verdict = s.verdict === null ? null : s.verdict === 'ok' ? t('replay.identical') : t('replay.mismatch');
    return {
      ...model, topRight: verdict ?? t(`replay.${s.saved.kind}`), depth: s.saved.kind === 'attack' ? s.battle.depth : null, banner: verdict,
      bottom: [
        { id: 'replay-speed', label: t('replay.speed', { n: s.speed }), onClick: () => { s.speed = s.speed >= 4 ? 1 : s.speed * 2; } },
        ...(s.saved.weakSection !== null && s.verdict !== null
          ? [{ id: 'replay-weak', label: t('raid.weak'), hint: true, onClick: () => { const section = s.saved.weakSection; toCity(); if (section !== null) weak = { section, until: performance.now() + WEAK_MS }; } }]
          : []),
        { id: 'replay-back', label: t('replay.back'), onClick: () => { screen = { kind: 'replays' }; } },
      ],
    };
  }

  if (screen.kind === 'replays') {
    const buttons: Btn[] = [...game.replays].reverse().map((r) => ({
      id: `replay-${r.id}`,
      label: t('replay.entry', { kind: t(`replay.${r.kind}`), result: r.kind === 'attack' ? depthText(r.depth) : t(r.result === 'breached' ? 'defense.breached' : 'defense.held') }),
      sub: new Date(r.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      onClick: () => startReplay(r),
    }));
    buttons.push({ id: 'replays-back', label: t('replay.back'), quiet: true, onClick: toCity });
    return { ...model, panel: { title: t('replay.title'), lines: game.replays.length === 0 ? [t('replay.none')] : [], rows: [], buttons } };
  }

  if (screen.kind === 'result') {
    const out = game.lastAttack;
    const lost = out ? out.fallen.reduce((n, f) => n + f.count, 0) : 0;
    const last = game.replays[game.replays.length - 1];
    return {
      ...model,
      panel: {
        title: depthText(out?.depth ?? 0), lines: lost > 0 ? [t('result.hospital', { n: lost })] : [], loot: out?.loot, rows: [],
        buttons: [
          { id: 'result-ok', label: t('result.ok'), onClick: toCity },
          ...(last ? [{ id: 'result-replay', label: t('result.replay'), quiet: true, onClick: () => startReplay(last) }] : []),
        ],
      },
    };
  }

  if (screen.kind === 'attackSetup') {
    const s = screen;
    const used = (unit: string): number => s.lineup.reduce((n, wave) => n + wave.filter((e) => e.unit === unit).reduce((k, e) => k + e.count, 0), 0);
    const change = (wave: number, unit: string, delta: number): void => {
      s.lineup = s.lineup.map((entries, w) => (w !== wave ? entries : entries.map((e) => (e.unit === unit ? { unit, count: Math.max(0, e.count + delta) } : e))));
    };
    const rows: StepperRow[] = s.lineup.map((entries, w) => ({
      label: t('attack.wave', { n: w + 1 }),
      cells: data.troops.troops.map((troop) => ({
        id: `lineup-${w}-${troop.unit}`, label: t(`unit.${troop.unit}`), count: entries.find((e) => e.unit === troop.unit)?.count ?? 0,
        onMinus: () => change(w, troop.unit, -1),
        onPlus: () => { if (used(troop.unit) < readyTroops(game, troop.unit)) change(w, troop.unit, 1); },
      })),
    }));
    const free = data.troops.troops.reduce((n, troop) => n + readyTroops(game, troop.unit) - used(troop.unit), 0);
    const total = data.troops.troops.reduce((n, troop) => n + used(troop.unit), 0);
    return {
      ...model,
      panel: {
        title: t('attack.title', { name: t(`target.${s.camp}`) }),
        lines: [...(game.hero.joined ? [t('attack.withHero', { name: heroName })] : []), total === 0 ? t('attack.empty') : t('attack.ready', { n: free })],
        rows,
        buttons: [
          { id: 'attack-go', label: t('attack.go'), disabled: total === 0, hint: hint?.type === 'button' && hint.button === 'attack', onClick: () => startAttack(s.camp, s.lineup) },
          { id: 'attack-close', label: t('attack.close'), quiet: true, onClick: () => { if (unlocked(game, 'world', data)) screen = { kind: 'world' }; else toCity(); } },
        ],
      },
    };
  }

  if (screen.kind === 'world') return { ...model, map: worldMap(hint) };

  // Stadt
  const buttonHint = (id: string): boolean => hint?.type === 'button' && hint.button === id && !game.roadChoicePending;
  const bottom: Btn[] = [];
  const second: Btn[] = [];
  if (unlocked(game, 'defend', data)) bottom.push({ id: 'defend', label: t('hud.defend'), hint: buttonHint('defend'), onClick: startDefense });
  if (unlocked(game, 'world', data)) {
    bottom.push({ id: 'world', label: t('hud.world'), hint: buttonHint('world'), onClick: () => { dispatch({ type: 'OpenWorldMap' }); sheet = null; screen = { kind: 'world' }; } });
  } else if (unlocked(game, 'attack', data)) {
    bottom.push({ id: 'attack', label: t('hud.attack'), hint: buttonHint('attack'), onClick: () => openAttack(data.camps.camps[0]!.id) });
  }
  if (unlocked(game, 'hero', data) && game.hero.joined) second.push({ id: 'hero', label: heroName, hint: buttonHint('hero'), onClick: () => { sheet = { kind: 'hero' }; } });
  if (unlocked(game, 'alliance', data)) second.push({ id: 'alliance', label: t('hud.alliance'), hint: buttonHint('alliance'), onClick: () => { sheet = { kind: 'alliance' }; } });
  if (unlocked(game, 'goals', data)) second.push({ id: 'goals', label: t('hud.goals'), hint: buttonHint('goals'), onClick: () => { sheet = { kind: 'goals' }; } });
  if (unlocked(game, 'replays', data)) second.push({ id: 'replays', label: t('hud.replays'), onClick: () => { screen = { kind: 'replays' }; } });
  const weakBanner = weak ? t('raid.weakBanner', { section: t(`section.${weak.section}`) }) : null;
  const panel = cityPanel();
  return { ...model, banner: model.banner ?? weakBanner, bottom, bottomSecondary: second, status: unlocked(game, 'world', data) ? shieldText() : null, sheet: panel ? null : citySheet(hint), panel };
}

function shieldText(): string | null {
  const left = game.shieldUntil - game.now;
  if (left <= 0) return null;
  const hours = Math.floor(left / 3_600_000);
  return t('hud.shield', { time: hours >= 1 ? `${hours} h` : `${Math.ceil(left / 60_000)} min` });
}

function openAttack(camp: string): void {
  sheet = null;
  screen = { kind: 'attackSetup', camp, lineup: defaultLineup(game, data) };
}

/** Meldungen, die sich in der Stadtansicht von selbst öffnen: Bericht zum Nachtangriff, Ankündigung. */
function cityPanel(): HudModel['panel'] {
  if (game.roadChoicePending) return null;
  const report = game.raidReport === null ? null : game.replays.find((r) => r.id === game.raidReport);
  if (report) {
    const lines = [report.result === 'held' && report.depth === 0 ? t('raid.held') : depthText(report.depth)];
    if (report.result === 'breached') lines.push(t('raid.shield', { hours: data.rules.defeatShieldHours }));
    const lost = report.loot.gold + report.loot.wood + report.loot.stone > 0;
    if (lost) lines.push(`${t('raid.lost')}: ${report.loot.gold} ${t('res.gold')}, ${report.loot.wood} ${t('res.wood')}, ${report.loot.stone} ${t('res.stone')}`);
    return {
      title: t('raid.title'), lines, rows: [],
      buttons: [
        { id: 'raid-replay', label: t('result.replay'), hint: true, onClick: () => { dispatch({ type: 'DismissRaidReport' }); startReplay(report); } },
        { id: 'raid-ok', label: t('result.ok'), quiet: true, onClick: () => void dispatch({ type: 'DismissRaidReport' }) },
      ],
    };
  }
  if (game.raidReport !== null) dispatch({ type: 'DismissRaidReport' });
  if (tutorialStep(game, data).announcesRaid && !game.raidAcknowledged) {
    return {
      title: t('raid.announce'), lines: [t('raid.announceSub')], rows: [],
      buttons: [{ id: 'raid-ack', label: t('raid.ok'), hint: true, onClick: () => { sheet = null; dispatch({ type: 'AcknowledgeRaid' }); } }],
    };
  }
  return null;
}

/** ATTRAPPE: Weltkarte mit festen Zielen aus `data/camps.json`. Keine echten Spieler, keine Bewegung. */
function worldMap(hint: ReturnType<typeof tutorialStep>['hint']): NonNullable<HudModel['map']> {
  const nodes: MapNode[] = data.camps.camps.map((c) => ({
    id: c.id, kind: c.kind, label: t(`target.${c.id}`), sub: c.shielded ? t('world.shielded') : t(`world.${c.kind}`), x: c.map.x, y: c.map.y,
    shielded: c.shielded, disabled: c.shielded || !unlocked(game, 'attack', data),
    hint: hint?.type === 'button' && hint.button === 'attack' && c.id === data.camps.camps[0]!.id,
    onClick: () => openAttack(c.id),
  }));
  const shield = shieldText();
  nodes.push({
    id: 'home', kind: 'home', label: t('world.home'), sub: shield ?? t('world.noShield'), x: 50, y: 46, shielded: shield !== null, disabled: false, hint: false, onClick: toCity,
  });
  return { title: t('world.title'), nodes, back: { id: 'world-back', label: t('world.back'), quiet: true, onClick: toCity } };
}

function towerSheet(): HudModel['sheet'] {
  if (sheet?.kind !== 'tower') return null;
  const slot = sheet.slot;
  const hint = tutorialStep(game, data).hint;
  const gold = screen.kind === 'battle' ? screen.battle.gold : game.resources.gold;
  return {
    title: t('sheet.tower'), closeLabel: t('sheet.close'), onClose: () => { sheet = null; },
    options: availableTowers().map((tw) => ({
      id: `tower-${tw.id}`, label: t(`tower.${tw.id}`), sub: t(`tower.${tw.id}.sub`), cost: { gold: tw.levels[0]!.cost, wood: 0, stone: 0 }, disabled: tw.levels[0]!.cost > gold,
      hint: hint?.type === 'slot' && hint.slot === slot && hint.tower === tw.id,
      onClick: () => buildTower({ type: 'BuildTower', slot, tower: tw.id }),
    })),
  };
}

function citySheet(hint: ReturnType<typeof tutorialStep>['hint']): HudModel['sheet'] {
  const close = { closeLabel: t('sheet.close'), onClose: () => { sheet = null; } };
  if (game.roadChoicePending) {
    const level = data.city.keepLevels.find((l) => l.level === game.keepLevel);
    return {
      title: t('sheet.road'), closeLabel: '', onClose: null,
      options: (level?.roads ?? []).map((id) => {
        const road = findById(data.roads.roads, id, 'Straße');
        return { id: `road-${id}`, label: t(`road.${id}`), sub: t('road.tiles', { n: roadLengthMilli(road) / MILLI }), road, onClick: () => void dispatch({ type: 'ChooseRoad', road: id }) };
      }),
    };
  }
  if (!sheet) return null;
  if (sheet.kind === 'tower') return towerSheet();
  if (sheet.kind === 'building') {
    const plot = sheet.plot;
    return {
      ...close, title: t('sheet.build'),
      options: buildableBuildings().map((b) => ({
        id: `building-${b.id}`, label: t(`building.${b.id}`), sub: formatSeconds(b.buildSeconds), cost: b.cost,
        disabled: !canAfford(game.resources, b.cost), hint: hint?.type === 'plot' && hint.building === b.id,
        onClick: () => { if (dispatch({ type: 'BuildBuilding', plot, building: b.id })) sheet = null; },
      })),
    };
  }
  if (sheet.kind === 'keep') {
    const next = data.city.keepLevels.find((l) => l.level === game.keepLevel + 1);
    if (!next) return null;
    return {
      ...close, title: t('sheet.keep'),
      options: [{
        id: 'keep-upgrade', label: t('sheet.keepGo', { n: next.level }), sub: t('build.seconds', { n: next.buildSeconds }), cost: next.cost,
        disabled: validateGameAction(game, { type: 'UpgradeKeep' }, data) !== null, hint: hint?.type === 'keep',
        onClick: () => { if (dispatch({ type: 'UpgradeKeep' })) sheet = null; },
      }],
    };
  }
  if (sheet.kind === 'hero') {
    return {
      ...close, title: t('sheet.hero', { name: heroName }), note: t('sheet.heroBonus', { p: data.hero.sectionBonusPermille / 10 }),
      options: data.city.sections.map((s) => ({
        id: `section-${s.id}`, label: t(`section.${s.id}`), active: game.hero.section === s.id,
        onClick: () => { if (dispatch({ type: 'AssignHero', section: s.id })) sheet = null; },
      })),
    };
  }
  if (sheet.kind === 'alliance') {
    // PLATZHALTER: Die Allianz besteht aus Bots mit festen Namen aus `data/alliance.json`.
    const names = data.alliance.members.map((m) => t(`member.${m}`)).join(', ');
    const name = t(`alliance.${data.alliance.id}`);
    if (game.allianceJoined) return { ...close, title: name, note: `${t('alliance.members', { names })} · ${t('alliance.helpHint')}`, options: [] };
    return {
      ...close, title: `${name} ${t('alliance.invite')}`, note: t('alliance.members', { names }),
      options: [{ id: 'alliance-join', label: t('alliance.join'), sub: t('alliance.reward'), cost: data.alliance.joinReward, hint: true, onClick: () => void dispatch({ type: 'JoinAlliance' }) }],
    };
  }
  if (sheet.kind === 'goals') {
    return {
      ...close, title: t('goals.title'),
      options: data.goals.goals.map((g) => {
        const have = Math.min(game.daily.counters[g.counter], g.count);
        const claimed = game.daily.claimed.includes(g.id);
        return {
          id: `goal-${g.id}`, label: t(`goal.${g.id}`, { n: g.count }), sub: claimed ? t('goal.claimed') : t('goal.progress', { have, n: g.count }), cost: g.reward,
          disabled: claimed || have < g.count, hint: !claimed && have >= g.count,
          onClick: () => void dispatch({ type: 'ClaimDailyGoal', goal: g.id }),
        };
      }),
    };
  }
  const training = game.army.training;
  const ready = data.troops.troops.map((troop) => `${readyTroops(game, troop.unit)} ${t(`unit.${troop.unit}`)}`).join(' · ');
  const inHospital = game.army.hospital.reduce((n, h) => n + h.count, 0);
  const status = training ? t('train.busy', { time: formatSeconds(Math.max(0, Math.ceil((training.doneAt - game.now) / 1000))) }) : t('train.status', { ready });
  return {
    ...close, title: t('sheet.train'), note: inHospital > 0 ? `${status} · ${t('train.hospitalCount', { n: inHospital })}` : status,
    options: data.troops.troops.map((troop) => {
      const cost: Resources = { gold: troop.cost.gold * troop.batch, wood: troop.cost.wood * troop.batch, stone: troop.cost.stone * troop.batch };
      const action: GameAction = { type: 'TrainTroops', unit: troop.unit, count: troop.batch };
      return {
        id: `train-${troop.unit}`, label: t('train.batch', { n: troop.batch, unit: t(`unit.${troop.unit}`) }), sub: `${troop.trainSeconds * troop.batch} s`, cost,
        disabled: validateGameAction(game, action, data) !== null, hint: hint?.type === 'plot' && hint.building === 'kaserne' && troop.unit === 'leicht',
        onClick: () => void dispatch(action),
      };
    }),
  };
}

// ---------- Bildschleife ----------

function stepScreen(nowMs: number): void {
  if (screen.kind === 'battle') {
    const s = screen;
    if (s.battle.result !== 'running') return; // schon abgerechnet, das Siegbanner läuft noch
    for (const action of s.queued) s.inputs.push({ tick: s.battle.tick, action });
    const prev = s.battle;
    s.battle = stepBattle(prev, s.queued, data);
    s.queued = [];
    addBattleEffects(prev, s.battle, nowMs);
    if (s.battle.result !== 'running') finishBattle(s);
  } else if (screen.kind === 'replay' && screen.verdict === null) {
    const s = screen;
    const inputs = s.saved.replay.inputs;
    const actions: BattleAction[] = [];
    while (s.next < inputs.length && inputs[s.next]!.tick <= s.battle.tick) actions.push(inputs[s.next++]!.action);
    const prev = s.battle;
    s.battle = stepBattle(prev, actions, data);
    addBattleEffects(prev, s.battle, nowMs);
    if (s.battle.result !== 'running' || s.battle.tick >= s.saved.replay.finalTick) {
      s.verdict = s.battle.tick === s.saved.replay.finalTick && hashBattle(s.battle) === s.saved.replay.finalHash ? 'ok' : 'mismatch';
    }
  }
}

let last = performance.now();
let restMs = 0;
function frame(nowMs: number): void {
  const budget = consumeTicks(restMs, nowMs - last, tickMs);
  last = nowMs;
  restMs = budget.restMs;
  const factor = speedFactor * (screen.kind === 'replay' ? screen.speed : 1);
  for (let i = 0; i < budget.ticks * factor; i++) {
    stepScreen(nowMs);
  }
  if (weak && nowMs > weak.until) weak = null;
  if (screen.kind !== 'battle') {
    tickClock();
    // Rückkehr nach Abwesenheit: Der angekündigte Nachtangriff wird jetzt berechnet und als Bericht gezeigt.
    if (screen.kind === 'city' && game.raidReport === null && validateGameAction(game, { type: 'ResolveNightRaid' }, data) === null) dispatch({ type: 'ResolveNightRaid' });
    if (nowMs - lastSaveMs > SAVE_EVERY_MS) save();
  }
  if (banner && nowMs >= banner.until) {
    const then = banner.then;
    banner = null;
    then?.();
  }
  effects = effects.filter((e) => nowMs - e.start < EFFECT_KEEP_MS);
  layout = drawStage(canvas, buildScene(nowMs), data);
  render(<Hud m={buildHud(nowMs)} />, uiRoot);
  requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  onTap(e.clientX, e.clientY);
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });

// Nur für Browsertests und die spätere Entwicklerseite: Zustand lesen, Orte finden, Zeitraffer. Ändert keine Regeln.
(window as unknown as { __mk: unknown }).__mk = {
  state: () => ({ game, screen: screen.kind, battle: screen.kind === 'battle' || screen.kind === 'replay' ? screen.battle : null, verdict: screen.kind === 'replay' ? screen.verdict : null, sheet: sheet?.kind ?? null, desync, step: tutorialStep(game, data).id }),
  pos: (kind: 'slot' | 'plot' | 'keep', id: string) => {
    if (!layout) return null;
    const rect = canvas.getBoundingClientRect();
    let x = 0;
    let y = 0;
    if (kind === 'keep') {
      const road = findById(data.roads.roads, currentRoadId(), 'Straße');
      const p = roadPointMilli(road, roadLengthMilli(road));
      x = p[0] / MILLI;
      y = p[1] / MILLI;
    } else {
      const place = kind === 'slot' ? findById(data.city.towerSlots, id, 'Bauplatz') : findById(data.city.plots, id, 'Bauplatz');
      x = place.x;
      y = place.y;
    }
    const c = tileCenter(layout, x, y);
    return { x: rect.left + c.x, y: rect.top + c.y };
  },
  skip: (seconds: number) => { clockOffsetMs += seconds * 1000; },
  speed: (factor: number) => { speedFactor = factor; },
};

tickClock();
toCity();
registerSW({ immediate: true });
requestAnimationFrame(frame);
