import type { GameEvent } from './events.ts';

/**
 * Kennzahlen aus den Ereignissen einer Installation. Reine Funktion ohne Browser-Zugriff,
 * damit die Entwicklerseite und `scripts/metrics.ts` dasselbe rechnen.
 */
export interface Summary {
  readonly events: number;
  readonly sessions: number;
  readonly firstDay: string | null;
  readonly daysActive: number;
  /** Kennzahl 1: Der Spieler hat das Ende des Abschnitts "Minute 6 bis 10" erreicht. */
  readonly reachedMinute10: boolean;
  /** Sekunden vom ersten Ereignis bis dahin (Wanduhr, inklusive Pausen). */
  readonly secondsToMinute10: number | null;
  /** Kennzahl 2: Beitritt zur Allianz. */
  readonly joinedAlliance: boolean;
  /** Kennzahl 3: Die App wurde am Kalendertag nach dem ersten Tag wieder geöffnet. */
  readonly returnedNextDay: boolean;
  /** Die App wurde an irgendeinem späteren Tag wieder geöffnet. */
  readonly returnedLater: boolean;
  /** Weitester erreichter Tutorial-Schritt. */
  readonly lastStep: string | null;
  readonly lastStepIndex: number;
  /** Sekunden vom ersten Start bis zum ersten gebauten Turm. */
  readonly secondsToFirstTower: number | null;
  readonly towersBuilt: number;
  readonly defenses: { readonly held: number; readonly breached: number };
  readonly attacks: { readonly count: number; readonly byDepth: readonly number[] };
  readonly cancelled: Readonly<Record<string, number>>;
  /** Ereignisse mit Zeitraffer sind enthalten: nicht für echte Auswertungen verwenden. */
  readonly usedTimeLapse: boolean;
}

function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

/** `minute10Step`: Kennung des Tutorial-Schritts, dessen Erreichen als "Minute 10 erreicht" zählt. */
export function summarize(events: readonly GameEvent[], minute10Step: string): Summary {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const first = sorted[0];
  const days = new Set(sorted.map((e) => e.day));
  const firstDay = first?.day ?? null;
  const opens = sorted.filter((e) => e.type === 'app_open' || e.type === 'app_reopen');
  const steps = sorted.filter((e) => e.type === 'tutorial_step');
  const minute10 = steps.find((e) => e.data['step'] === minute10Step);
  let lastStep: string | null = null;
  let lastStepIndex = -1;
  for (const e of steps) {
    const index = typeof e.data['index'] === 'number' ? e.data['index'] : -1;
    if (index > lastStepIndex) {
      lastStepIndex = index;
      lastStep = typeof e.data['step'] === 'string' ? e.data['step'] : null;
    }
  }
  const firstTower = sorted.find((e) => e.type === 'tower_built');
  const ends = sorted.filter((e) => e.type === 'battle_end');
  const byDepth = [0, 0, 0, 0];
  for (const e of ends) {
    if (e.data['kind'] !== 'attack') continue;
    const depth = typeof e.data['depth'] === 'number' ? e.data['depth'] : 0;
    byDepth[Math.max(0, Math.min(3, depth))]! += 1;
  }
  const cancelled: Record<string, number> = {};
  for (const e of sorted) {
    if (e.type !== 'action_cancelled') continue;
    const what = String(e.data['what'] ?? '?');
    cancelled[what] = (cancelled[what] ?? 0) + 1;
  }
  const firstNumber = firstDay === null ? 0 : dayNumber(firstDay);
  return {
    events: sorted.length,
    sessions: new Set(sorted.map((e) => e.session)).size,
    firstDay,
    daysActive: days.size,
    reachedMinute10: minute10 !== undefined,
    secondsToMinute10: minute10 && first ? Math.round((minute10.t - first.t) / 1000) : null,
    joinedAlliance: sorted.some((e) => e.type === 'alliance_joined'),
    returnedNextDay: opens.some((e) => dayNumber(e.day) === firstNumber + 1),
    returnedLater: opens.some((e) => dayNumber(e.day) > firstNumber),
    lastStep,
    lastStepIndex,
    secondsToFirstTower: firstTower && first ? Math.round((firstTower.t - first.t) / 1000) : null,
    towersBuilt: sorted.filter((e) => e.type === 'tower_built').length,
    defenses: {
      held: ends.filter((e) => e.data['kind'] !== 'attack' && e.data['result'] === 'held').length,
      breached: ends.filter((e) => e.data['kind'] !== 'attack' && e.data['result'] === 'breached').length,
    },
    attacks: { count: byDepth.reduce((a, b) => a + b, 0), byDepth },
    cancelled,
    usedTimeLapse: sorted.some((e) => e.lapse),
  };
}

/** Format der Exportdatei. */
export interface ExportFile {
  readonly format: 1;
  readonly app: { readonly title: string; readonly dataVersion: string; readonly stateVersion: number };
  /** Zufällige Kennung der Installation, kein Personenbezug. */
  readonly install: string;
  readonly exportedAt: number;
  readonly minute10Step: string;
  readonly truncated: boolean;
  readonly summary: Summary;
  readonly events: readonly GameEvent[];
}

/** Anteile über mehrere Installationen (ein Export je Spieler). */
export function aggregate(files: readonly ExportFile[]): { players: number; minute10: number; alliance: number; nextDay: number; withTimeLapse: number } {
  const fresh = files.map((f) => summarize(f.events, f.minute10Step));
  const share = (pick: (s: Summary) => boolean): number => (fresh.length === 0 ? 0 : Math.round((fresh.filter(pick).length * 1000) / fresh.length) / 10);
  return {
    players: fresh.length,
    minute10: share((s) => s.reachedMinute10),
    alliance: share((s) => s.joinedAlliance),
    nextDay: share((s) => s.returnedNextDay),
    withTimeLapse: fresh.filter((s) => s.usedTimeLapse).length,
  };
}
