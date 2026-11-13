import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import {
  createBattle, createGame, currentHint, defenseSetup, defenseStep, findById, hashBattle, reduceGame, roadPointMilli, stepBattle, validateBattleAction, MILLI,
  type BattleAction, type BattleInput, type BattleState, type DefenseStepDef, type GameAction, type GameState,
} from '../sim/index.ts';
import { drawStage, slotAt, tileCenter, type Effect, type Layout } from '../render/stage.ts';
import { Hud } from '../ui/Hud.tsx';
import { gameData as data } from './data.ts';
import { consumeTicks } from './loop.ts';
import { loadGame, saveGame } from './save.ts';
import { t } from './texts.ts';

/**
 * Hülle um die Spiellogik: Uhr, Zufalls-Startwert, Speicher und Bildschleife leben hier,
 * nie in `src/sim/`. Stand M1: Verteidigung des Dorfs, Minute 0 bis 3.
 */
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;
const tickMs = 1000 / data.game.ticksPerSecond;
const BANNER_MS = 1800;
const EFFECT_KEEP_MS = 1000;

let game: GameState = loadGame(localStorage, data) ?? createGame(crypto.getRandomValues(new Uint32Array(1))[0] ?? 1, Date.now(), data);
let step: DefenseStepDef;
let battle: BattleState;
let inputs: BattleInput[] = [];
let queued: BattleAction[] = [];
let effects: Effect[] = [];
let banner: { text: string; until: number } | null = null;
let goldDeniedUntil = 0;
let layout: Layout | null = null;
let desync = false;

function dispatch(action: GameAction): boolean {
  const result = reduceGame(game, action, data);
  if (result.error) return false;
  game = result.state;
  saveGame(localStorage, game);
  return true;
}

function startBattle(): void {
  step = defenseStep(game, data);
  battle = createBattle(defenseSetup(game, data), game.nextSeed, data);
  inputs = [];
  queued = [];
  banner = null;
}

function road() {
  return findById(data.roads.roads, battle.setup.roadId, 'Straße');
}

/** Einzige Stelle, an der die Oberfläche in die Schlacht eingreift: eine geprüfte Aktion einreihen. */
function act(action: BattleAction): void {
  const error = validateBattleAction(battle, action, data);
  if (error === null) {
    queued.push(action);
    return;
  }
  if (error === 'not_enough_gold' && 'slot' in action) {
    const slot = road().towerSlots.find((s) => s.id === action.slot);
    if (slot) effects.push({ kind: 'deny', x: slot.x, y: slot.y, text: '', start: performance.now() });
    goldDeniedUntil = performance.now() + 500;
  }
}

function onTap(clientX: number, clientY: number): void {
  if (!layout || battle.result !== 'running') return;
  const rect = canvas.getBoundingClientRect();
  const slot = slotAt(layout, road(), clientX - rect.left, clientY - rect.top);
  if (slot === null) return;
  const defaultTower = data.towers.towers[0];
  if (battle.towers.some((tw) => tw.slot === slot)) act({ type: 'UpgradeTower', slot });
  else if (defaultTower) act({ type: 'BuildTower', slot, tower: defaultTower.id });
}

/** Leitet aus zwei aufeinanderfolgenden Zuständen die sichtbaren Effekte ab. */
function addEffects(prev: BattleState, next: BattleState, nowMs: number): void {
  if (next.killed > prev.killed) {
    for (const u of prev.units) {
      if (next.units.some((n) => n.id === u.id)) continue;
      const def = findById(data.units.units, u.def, 'Einheit');
      if (u.pos + def.speedMilliPerTick >= prev.roadLength) continue;
      const [x, y] = roadPointMilli(road(), u.pos);
      effects.push({ kind: 'gold', x: x / MILLI, y: y / MILLI, text: `+${def.bounty}`, start: nowMs });
    }
  }
  for (const tw of next.towers) {
    const before = prev.towers.find((p) => p.slot === tw.slot);
    if (before && before.level === tw.level) continue;
    const slot = road().towerSlots.find((s) => s.id === tw.slot);
    if (slot) effects.push({ kind: 'built', x: slot.x, y: slot.y, text: '', start: nowMs });
  }
}

function finishBattle(nowMs: number): void {
  const won = battle.result === 'won';
  const expected = hashBattle(battle);
  dispatch({ type: 'AdvanceTime', now: Date.now() });
  if (!dispatch({ type: 'ResolveDefense', inputs }) || game.lastDefense?.finalHash !== expected) desync = true;
  banner = { text: won ? t('banner.victory', { gold: step.victoryGold }) : t('banner.defeat'), until: nowMs + BANNER_MS };
}

function draw(nowMs: number): void {
  const hint = battle.result === 'running' ? currentHint(step, battle, data) : null;
  layout = drawStage(canvas, { battle, hintSlot: hint && hint.type !== 'releaseWave' ? hint.slot : null, effects, timeMs: nowMs }, data);
  render(
    <Hud
      gold={battle.result === 'running' ? battle.gold : game.gold}
      wave={game.wavesWon + (battle.result === 'won' ? 0 : 1)}
      goldDenied={nowMs < goldDeniedUntil}
      canRelease={battle.result === 'running' && !battle.released}
      hintRelease={hint?.type === 'releaseWave'}
      banner={banner?.text ?? null}
      onRelease={() => act({ type: 'ReleaseWave' })}
    />,
    uiRoot,
  );
}

let last = performance.now();
let restMs = 0;
function frame(nowMs: number): void {
  const budget = consumeTicks(restMs, nowMs - last, tickMs);
  last = nowMs;
  restMs = budget.restMs;
  for (let i = 0; i < budget.ticks && battle.result === 'running'; i++) {
    // Vor dem Auslösen der Welle steht die Zeit: ein Tick vergeht nur mit einer Eingabe.
    if (!battle.released && queued.length === 0) break;
    for (const action of queued) inputs.push({ tick: battle.tick, action });
    const prev = battle;
    battle = stepBattle(battle, queued, data);
    queued = [];
    addEffects(prev, battle, nowMs);
    if (battle.result !== 'running') finishBattle(nowMs);
  }
  if (banner && nowMs >= banner.until) startBattle();
  effects = effects.filter((e) => nowMs - e.start < EFFECT_KEEP_MS);
  draw(nowMs);
  requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  onTap(e.clientX, e.clientY);
});

// Nur für Browsertests: Zustand lesen und Bauplätze auf dem Bildschirm finden. Ändert nichts.
(window as unknown as { __mk: unknown }).__mk = {
  state: () => ({ game, battle, desync }),
  slotPos: (id: string) => {
    const slot = road().towerSlots.find((s) => s.id === id);
    if (!slot || !layout) return null;
    const rect = canvas.getBoundingClientRect();
    const c = tileCenter(layout, slot.x, slot.y);
    return { x: rect.left + c.x, y: rect.top + c.y };
  },
};

dispatch({ type: 'AdvanceTime', now: Date.now() });
startBattle();
registerSW({ immediate: true });
requestAnimationFrame(frame);
