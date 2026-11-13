import {
  buildingBusyUntil, defenseSetup, findById, keepRequirement, reduceGame, storageCapacity, validateGameAction,
  type GameAction, type GameData, type GameState,
} from '../../src/sim/index.ts';
import { activeDefense, playBattle } from './bot.ts';

/**
 * Spielt den ersten Spielmonat nach dem geführten Ablauf mit einem einfachen, sparsamen Spieler durch:
 * einige kurze Sitzungen am Tag, in jeder ein paar Verteidigungen, Vorräte gehen zuerst in den Burgfried,
 * dann in das, was ihm fehlt, dann in Erträge. Dient dazu, Kosten und Bauzeiten an Tagen zu messen statt zu schätzen.
 */
export interface MonthOptions {
  readonly days: number;
  /** Stunden des Tages, zu denen gespielt wird. */
  readonly sessionHours: readonly number[];
  readonly defensesPerSession: number;
  readonly sessionMinutes: number;
}

export const CASUAL: MonthOptions = { days: 30, sessionHours: [8, 13, 20], defensesPerSession: 3, sessionMinutes: 10 };
export const EAGER: MonthOptions = { days: 30, sessionHours: [7, 10, 13, 16, 19, 22], defensesPerSession: 5, sessionMinutes: 15 };

export interface MonthRun {
  readonly game: GameState;
  /** Tag (ab 1), an dem der Burgfried die Stufe erreicht hat; Index = Stufe. */
  readonly keepDay: readonly (number | null)[];
  /** Je Tag: Stufe des Burgfrieds und Vorräte am Abend. */
  readonly days: readonly { readonly day: number; readonly keep: number; readonly gold: number; readonly wood: number; readonly stone: number; readonly defenses: number; readonly lost: number }[];
  /** Sitzungen, in denen es außer Verteidigen nichts zu tun gab. */
  readonly idleSessions: number;
  readonly sessions: number;
}

const HOUR = 3_600_000;

export function playMonth(start: GameState, data: GameData, options: MonthOptions = CASUAL): MonthRun {
  let game = start;
  const t0 = start.now;
  const keepDay: (number | null)[] = Array.from({ length: data.city.keepLevels.length + 1 }, () => null);
  const days: MonthRun['days'][number][] = [];
  let idleSessions = 0;
  let sessions = 0;
  let lost = 0;
  const act = (action: GameAction): boolean => {
    const r = reduceGame(game, action, data);
    if (r.error) return false;
    game = r.state;
    return true;
  };
  const can = (action: GameAction): boolean => validateGameAction(game, action, data) === null;
  const plotOf = (def: string): string | null => game.buildings.find((b) => b.def === def)?.plot ?? null;

  /** Alles tun, was jetzt sinnvoll geht. Liefert, ob etwas gebaut wurde. */
  const build = (): boolean => {
    let did = false;
    for (let guard = 0; guard < 50; guard++) {
      if (game.roadChoicePending) {
        const roads = data.city.keepLevels.find((l) => l.level === game.keepLevel)!.roads;
        act({ type: 'ChooseRoad', road: roads[roads.length - 1]! });
        continue;
      }
      for (const g of data.goals.goals) act({ type: 'ClaimDailyGoal', goal: g.id });
      for (const b of game.buildings) if (buildingBusyUntil(b, game.now) !== null) act({ type: 'RequestHelp', plot: b.plot });
      if (act({ type: 'UpgradeKeep' })) { did = true; continue; }
      // Fehlende Gebäude zuerst (der Ablauf lässt das Lazarett offen).
      const free = data.city.plots.find((p) => !game.buildings.some((b) => b.plot === p.id));
      const missing = data.buildings.buildings.find((b) => !game.buildings.some((x) => x.def === b.id));
      if (free && missing && act({ type: 'BuildBuilding', plot: free.id, building: missing.id })) { did = true; continue; }
      const need = keepRequirement(game, data);
      const nextKeep = data.city.keepLevels.find((l) => l.level === game.keepLevel + 1);
      const cap = storageCapacity(game, data);
      const order: string[] = [];
      if (need) order.push(need.building);
      if (nextKeep && (nextKeep.cost.wood > cap.wood || nextKeep.cost.stone > cap.stone)) order.push('speicher');
      // Erträge lohnen sich immer; alles Weitere nur, solange der Burgfried ohnehin wartet oder baut.
      order.push('holzfaeller', 'steinbruch', 'hof');
      const keepWaits = game.keepDoneAt !== null || need !== null || !nextKeep;
      if (keepWaits) order.push('speicher', 'lazarett');
      let upgraded = false;
      for (const def of order) {
        const plot = plotOf(def);
        if (plot === null || !can({ type: 'UpgradeBuilding', plot })) continue;
        // Nicht verbauen, was der Burgfried gleich braucht: Ertragsgebäude dürfen höchstens ein Drittel davon kosten.
        if (!keepWaits && def !== 'speicher' && nextKeep) {
          const b = game.buildings.find((x) => x.plot === plot)!;
          const cost = findById(data.buildings.buildings, def, 'Gebäude').levels[b.level]!.cost;
          if (cost.wood * 3 > nextKeep.cost.wood) continue;
        }
        if (act({ type: 'UpgradeBuilding', plot })) { upgraded = true; did = true; break; }
      }
      if (upgraded) continue;
      // Gold, das der Burgfried nicht braucht, geht in Türme: erst bauen, dann ausbauen.
      const reserve = nextKeep ? nextKeep.cost.gold : 0;
      const slot = data.city.towerSlots.find((s) => s.keepLevel <= game.keepLevel && !game.towers.some((t) => t.slot === s.id));
      const tower = data.towers.towers.filter((t) => t.keepLevel <= game.keepLevel)[game.towers.length % 2 === 0 ? 0 : 1] ?? data.towers.towers[0]!;
      if (slot && game.resources.gold - tower.levels[0]!.cost >= reserve && act({ type: 'BuildTower', slot: slot.id, tower: tower.id })) { did = true; continue; }
      const up = game.towers.find((t) => {
        const next = findById(data.towers.towers, t.def, 'Turm').levels[t.level];
        return next !== undefined && next.keepLevel <= game.keepLevel && game.resources.gold - next.cost >= reserve;
      });
      if (up && act({ type: 'UpgradeTower', slot: up.slot })) { did = true; continue; }
      break;
    }
    return did;
  };

  for (let day = 1; day <= options.days; day++) {
    let defenses = 0;
    for (const hour of options.sessionHours) {
      const at = t0 + (day - 1) * 24 * HOUR + hour * HOUR;
      if (at <= game.now) continue;
      sessions++;
      act({ type: 'AdvanceTime', now: at });
      const before = game.resources;
      if (act({ type: 'ResolveNightRaid' })) {
        lost += before.wood - game.resources.wood + before.stone - game.resources.stone + Math.max(0, before.gold - game.resources.gold);
        act({ type: 'DismissRaidReport' });
      }
      let did = build();
      for (let i = 0; i < options.defensesPerSession; i++) {
        const { inputs, final } = playBattle(defenseSetup(game, data), game.nextSeed, data, activeDefense(data));
        if (!act({ type: 'ResolveDefense', inputs })) throw new Error('ResolveDefense abgelehnt');
        act({ type: 'AdvanceTime', now: game.now + Math.ceil(final.tick / data.game.ticksPerSecond) * 1000 });
        defenses++;
      }
      act({ type: 'AdvanceTime', now: Math.max(game.now, at + options.sessionMinutes * 60_000) });
      did = build() || did;
      if (!did) idleSessions++;
      for (let l = 1; l <= game.keepLevel; l++) keepDay[l] ??= day;
    }
    days.push({ day, keep: game.keepLevel, gold: game.resources.gold, wood: game.resources.wood, stone: game.resources.stone, defenses, lost });
  }
  return { game, keepDay, days, idleSessions, sessions };
}
