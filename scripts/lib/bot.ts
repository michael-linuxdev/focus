import {
  attackSetup, createBattle, defaultLineup, defenseSetup, reduceGame, roadPointMilli, stepBattle, tutorialStep, validateBattleAction,
  type BattleAction, type BattleInput, type BattleSetup, type BattleState, type GameAction, type GameData, type GameState,
} from '../../src/sim/index.ts';

export type Policy = (battle: BattleState) => BattleAction | null;

/** Spielt eine Schlacht mit einer Strategie durch und liefert Eingaben und Endzustand. */
export function playBattle(setup: BattleSetup, seed: number, data: GameData, policy: Policy, maxTicks = 6000): { inputs: BattleInput[]; final: BattleState } {
  let battle = createBattle(setup, seed, data);
  const inputs: BattleInput[] = [];
  while (battle.result === 'running' && battle.tick < maxTicks) {
    const action = policy(battle);
    const actions = action && validateBattleAction(battle, action, data) === null ? [action] : [];
    for (const a of actions) inputs.push({ tick: battle.tick, action: a });
    battle = stepBattle(battle, actions, data);
  }
  return { inputs, final: battle };
}

/** Verteidigung: baut den ersten Turm, falls keiner steht (ohne den geht Welle 1 nicht weiter), sonst nichts. */
export const firstTowerOnly = (data: GameData): Policy => (battle) =>
  battle.towers.length === 0 ? { type: 'BuildTower', slot: data.city.towerSlots[0]!.id, tower: data.towers.towers[0]!.id } : null;

/** Angriff: Wellen im Abstand auslösen, Brandpfeile auf den ersten Turm, Schildwall kurz danach. */
export const simpleAttack = (gapTicks: number): Policy => (battle) => {
  if (battle.releasedWaves < battle.setup.waves.length && battle.tick >= battle.releasedWaves * gapTicks) return { type: 'ReleaseWave' };
  if (battle.tick === 30 && battle.towers[0]) return { type: 'UseAbility', ability: 'brandpfeile', slot: battle.towers[0].slot };
  if (battle.tick === 60) return { type: 'UseAbility', ability: 'schildwall', slot: null };
  return null;
};

/**
 * Angriff mit guter Spielweise: Wellen im Abstand auslösen, Brandpfeile sofort bei Bereitschaft auf den Turm,
 * der der vordersten Einheit am nächsten steht, Schildwall, sobald Truppen hinter dem Tor unter Beschuss stehen.
 */
export const skilledAttack = (gapTicks: number, data: GameData): Policy => (battle) => {
  if (battle.releasedWaves < battle.setup.waves.length && battle.tick >= battle.releasedWaves * gapTicks) return { type: 'ReleaseWave' };
  const ready = (id: string): boolean => {
    const i = battle.setup.abilities.indexOf(id);
    return i >= 0 && battle.tick >= (battle.abilityReadyAt[i] ?? 0);
  };
  if (battle.units.length === 0) return null;
  const road = data.roads.roads.find((r) => r.id === battle.setup.roadId)!;
  const front = battle.units.reduce((a, b) => (b.pos > a.pos ? b : a));
  if (ready('brandpfeile')) {
    const [fx, fy] = roadPointMilli(road, front.pos);
    let best: string | null = null;
    let bestDist = -1;
    for (const tower of battle.towers) {
      if (battle.tick < tower.disabledUntil) continue;
      const slot = data.city.towerSlots.find((sl) => sl.id === tower.slot)!;
      const dist = (slot.x * 1000 - fx) ** 2 + (slot.y * 1000 - fy) ** 2;
      if (bestDist < 0 || dist < bestDist) {
        best = tower.slot;
        bestDist = dist;
      }
    }
    if (best !== null && bestDist <= 3500 * 3500) return { type: 'UseAbility', ability: 'brandpfeile', slot: best };
  }
  const underFire = battle.towers.some((tw) => tw.lastShotTick >= battle.tick - 10);
  if (ready('schildwall') && underFire && battle.units.filter((u) => u.pos >= data.rules.gateMilli).length >= 2) return { type: 'UseAbility', ability: 'schildwall', slot: null };
  return null;
};

export interface TutorialRun {
  readonly game: GameState;
  /** Sekunden, die der Bot auf Rohstoffe oder Timer gewartet hat. */
  readonly waitedSeconds: number;
  /** Schlachtdauer in Ticks, in Reihenfolge. */
  readonly battleTicks: number[];
  readonly breached: number;
  readonly log: string[];
}

/**
 * Spielt den geführten Ablauf, indem er genau den Hinweisen folgt.
 * `untilStep`: Kennung des Schritts, bei dessen Erreichen er aufhört.
 */
export function playTutorial(start: GameState, data: GameData, untilStep: string, roadVariant = 0): TutorialRun {
  let game = start;
  let waitedSeconds = 0;
  let breached = 0;
  const battleTicks: number[] = [];
  const log: string[] = [];
  const act = (action: GameAction): boolean => {
    const r = reduceGame(game, action, data);
    if (r.error) return false;
    game = r.state;
    return true;
  };
  const wait = (seconds: number): void => {
    waitedSeconds += seconds;
    act({ type: 'AdvanceTime', now: game.now + seconds * 1000 });
  };
  const defend = (): void => {
    const { inputs, final } = playBattle(defenseSetup(game, data), game.nextSeed, data, firstTowerOnly(data));
    battleTicks.push(final.tick);
    if (final.result === 'breached') breached++;
    if (!act({ type: 'ResolveDefense', inputs })) throw new Error('ResolveDefense abgelehnt');
    act({ type: 'AdvanceTime', now: game.now + Math.ceil(final.tick / data.game.ticksPerSecond) * 1000 });
  };

  const attack = (): void => {
    const lineup = defaultLineup(game, data);
    const camp = data.camps.camps[0]!.id;
    const { inputs, final } = playBattle(attackSetup(game, camp, lineup, data), game.nextSeed, data, simpleAttack(120));
    battleTicks.push(final.tick);
    if (!act({ type: 'ResolveAttack', camp, lineup, inputs })) throw new Error('ResolveAttack abgelehnt');
  };

  for (let guard = 0; guard < 2000; guard++) {
    const step = tutorialStep(game, data);
    if (step.id === untilStep) return { game, waitedSeconds, battleTicks, breached, log };
    const before = game.tutorialStep;
    const hint = step.hint;
    if (step.autoDefense) defend();
    else if (!hint) {
      if (game.roadChoicePending) {
        const roads = data.city.keepLevels.find((l) => l.level === game.keepLevel)!.roads;
        act({ type: 'ChooseRoad', road: roads[roadVariant % roads.length]! });
      } else if (!act({ type: 'AcknowledgeRaid' })) wait(1);
    } else if (hint.type === 'button') {
      if (hint.button === 'defend') defend();
      else if (hint.button === 'hero') act({ type: 'AssignHero', section: data.city.sections[0]!.id });
      else if (hint.button === 'attack') attack();
      else if (hint.button === 'world') act({ type: 'OpenWorldMap' });
      else if (hint.button === 'alliance') act({ type: 'JoinAlliance' });
      else if (!data.goals.goals.some((g) => act({ type: 'ClaimDailyGoal', goal: g.id }))) defend();
    } else if (hint.type === 'slot') {
      const occupied = game.towers.some((t) => t.slot === hint.slot);
      // Fehlt das Gold für den Turm, verdient der Bot es mit einer Verteidigung.
      if (!act(occupied ? { type: 'UpgradeTower', slot: hint.slot } : { type: 'BuildTower', slot: hint.slot, tower: hint.tower })) {
        if (game.defensesWon >= data.tutorial.defenses.length - 1) defend();
        else wait(1);
      }
    } else if (hint.type === 'keep') {
      if (!act({ type: 'UpgradeKeep' })) wait(1);
    } else if (hint.type === 'plot') {
      const building = game.buildings.find((b) => b.plot === hint.plot);
      if (!building) {
        if (!act({ type: 'BuildBuilding', plot: hint.plot, building: hint.building })) wait(1);
      } else if (building.doneAt > game.now) {
        if (!act({ type: 'SkipTimerFree', plot: hint.plot }) && !act({ type: 'RequestHelp', plot: hint.plot })) wait(1);
      } else if (!act({ type: 'TrainTroops', unit: 'leicht', count: 6 })) wait(1);
    }
    if (game.tutorialStep !== before) log.push(`${step.id} -> ${tutorialStep(game, data).id} (Gold ${game.resources.gold}, Holz ${game.resources.wood}, Stein ${game.resources.stone}, gewartet ${waitedSeconds}s)`);
  }
  throw new Error(`Tutorial hängt bei ${tutorialStep(game, data).id}: ${JSON.stringify(game.resources)}`);
}
