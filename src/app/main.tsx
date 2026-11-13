import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import {
  createBattle, createGame, hashBattle, reduceGame, stepBattle,
  type BattleAction, type BattleSetup, type BattleState, type GameAction, type GameState,
} from '../sim/index.ts';
import { drawStage } from '../render/stage.ts';
import { Hud } from '../ui/Hud.tsx';
import { gameData } from './data.ts';
import { consumeTicks } from './loop.ts';
import { loadGame, saveGame } from './save.ts';

/**
 * Hülle um die Spiellogik: Uhr, Zufalls-Startwert, Speicher und Bildschleife leben hier,
 * nie in `src/sim/`. Stand M0: eine Demo-Welle läuft über die Straße.
 */
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;
const tickMs = 1000 / gameData.game.ticksPerSecond;
const setup: BattleSetup = { roadId: 'dorf_1', waveId: 'demo_1' };

let game: GameState = loadGame(localStorage) ?? createGame(crypto.getRandomValues(new Uint32Array(1))[0] ?? 1, Date.now());
let battle: BattleState = createBattle(setup, game.nextSeed, gameData);
let queued: BattleAction[] = [];
let offlineReady = false;

function dispatch(action: GameAction): void {
  const result = reduceGame(game, action);
  if (result.error) return;
  game = result.state;
  saveGame(localStorage, game);
}

function onPrimary(): void {
  if (battle.done) battle = createBattle(setup, game.nextSeed, gameData);
  else queued.push({ type: 'ReleaseWave' });
}

function draw(): void {
  drawStage(canvas, battle, gameData);
  render(
    <Hud
      title={gameData.game.title}
      phase={battle.done ? 'done' : battle.released ? 'running' : 'ready'}
      arrived={battle.arrived}
      tick={battle.tick}
      hash={hashBattle(battle).toString(16).padStart(8, '0')}
      battles={game.battlesFinished}
      offlineReady={offlineReady}
      onPrimary={onPrimary}
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
  for (let i = 0; i < budget.ticks && !battle.done; i++) {
    battle = stepBattle(battle, queued, gameData);
    queued = [];
    if (battle.done) dispatch({ type: 'FinishBattle', arrived: battle.arrived });
  }
  draw();
  requestAnimationFrame(frame);
}

dispatch({ type: 'AdvanceTime', now: Date.now() });
registerSW({ immediate: true, onOfflineReady: () => { offlineReady = true; } });
navigator.serviceWorker?.ready.then(() => { offlineReady = true; }).catch(() => undefined);
requestAnimationFrame(frame);
