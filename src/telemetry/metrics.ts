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
  /** Sekunden vom ersten Tutorial-Schritt bis dahin (Wanduhr, inklusive Pausen, ohne den Installationshinweis davor). */
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
  // ---- Spielmonat ----
  /** Letzter Tag mit geöffneter App, gezählt ab dem ersten Tag (0 = nur am ersten Tag gespielt). */
  readonly lastActiveDay: number;
  /** Die App wurde an Tag 7 bzw. Tag 30 nach dem ersten Tag oder später noch geöffnet. */
  readonly activeDay7: boolean;
  readonly activeDay30: boolean;
  readonly maxKeepLevel: number;
  /** Höchste geschlagene Welle (Nummer wie in der Anzeige), 0 wenn nicht erfasst. */
  readonly maxWave: number;
  readonly chaptersClaimed: number;
  /** Spieltag der Krönung (ab 1), sonst `null`. */
  readonly crownedOnDay: number | null;
  readonly reportsSent: number;
  readonly errors: number;
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
  // Die Spielzeit beginnt mit dem ersten Schritt: Davor kann der Installationshinweis stehen.
  const start = steps[0] ?? first;
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
  const lastActiveDay = Math.max(0, ...opens.map((e) => dayNumber(e.day) - firstNumber));
  const crowned = sorted.find((e) => e.type === 'crowned');
  const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
  return {
    events: sorted.length,
    sessions: new Set(sorted.map((e) => e.session)).size,
    firstDay,
    daysActive: days.size,
    reachedMinute10: minute10 !== undefined,
    secondsToMinute10: minute10 && start ? Math.max(0, Math.round((minute10.t - start.t) / 1000)) : null,
    joinedAlliance: sorted.some((e) => e.type === 'alliance_joined'),
    returnedNextDay: opens.some((e) => dayNumber(e.day) === firstNumber + 1),
    returnedLater: opens.some((e) => dayNumber(e.day) > firstNumber),
    lastStep,
    lastStepIndex,
    secondsToFirstTower: firstTower && start ? Math.max(0, Math.round((firstTower.t - start.t) / 1000)) : null,
    towersBuilt: sorted.filter((e) => e.type === 'tower_built').length,
    defenses: {
      held: ends.filter((e) => e.data['kind'] !== 'attack' && e.data['result'] === 'held').length,
      breached: ends.filter((e) => e.data['kind'] !== 'attack' && e.data['result'] === 'breached').length,
    },
    attacks: { count: byDepth.reduce((a, b) => a + b, 0), byDepth },
    cancelled,
    usedTimeLapse: sorted.some((e) => e.lapse),
    lastActiveDay,
    activeDay7: lastActiveDay >= 7,
    activeDay30: lastActiveDay >= 30,
    maxKeepLevel: Math.max(1, ...sorted.filter((e) => e.type === 'keep_level').map((e) => num(e.data['level']))),
    maxWave: Math.max(0, ...ends.filter((e) => e.data['kind'] === 'defense' && e.data['result'] === 'held').map((e) => num(e.data['wave']))),
    chaptersClaimed: sorted.filter((e) => e.type === 'chapter_claimed').length,
    crownedOnDay: crowned ? dayNumber(crowned.day) - firstNumber + 1 : null,
    reportsSent: sorted.filter((e) => e.type === 'report_sent').length,
    errors: sorted.filter((e) => e.type === 'error').length,
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
  /** Freiwillige Anmerkungen des Testers aus dem Testbericht. */
  readonly notes?: readonly { readonly t: number; readonly text: string }[];
  readonly events: readonly GameEvent[];
}

/** Anteile über mehrere Installationen (ein Export je Spieler). */
export interface Aggregate {
  players: number; minute10: number; alliance: number; nextDay: number; withTimeLapse: number;
  /** Anteil der Spieler, die an Tag 7 bzw. 30 oder später noch gespielt haben, unter denen, deren Export alt genug dafür ist. */
  day7: number | null; day30: number | null;
  /** So viele Exporte sind alt genug für die jeweilige Quote. */
  oldEnough7: number; oldEnough30: number;
  crowned: number;
  /** Mittlere (Median) höchste Burgfried-Stufe. */
  medianKeepLevel: number;
}

export function aggregate(files: readonly ExportFile[]): Aggregate {
  const fresh = files.map((f) => summarize(f.events, f.minute10Step));
  // Alt genug für Tag n: Der Export entstand mindestens n Tage nach dem ersten Ereignis.
  const age = (f: ExportFile): number => (f.events[0] ? Math.floor((f.exportedAt - f.events[0].t) / 86_400_000) : 0);
  const old = (n: number): Summary[] => fresh.filter((_, i) => age(files[i]!) >= n);
  const retention = (n: number): number | null => {
    const group = old(n);
    return group.length === 0 ? null : Math.round((group.filter((s) => s.lastActiveDay >= n).length * 1000) / group.length) / 10;
  };
  const keeps = fresh.map((s) => s.maxKeepLevel).sort((a, b) => a - b);
  const share = (pick: (s: Summary) => boolean): number => (fresh.length === 0 ? 0 : Math.round((fresh.filter(pick).length * 1000) / fresh.length) / 10);
  return {
    players: fresh.length,
    minute10: share((s) => s.reachedMinute10),
    alliance: share((s) => s.joinedAlliance),
    nextDay: share((s) => s.returnedNextDay),
    withTimeLapse: fresh.filter((s) => s.usedTimeLapse).length,
    day7: retention(7),
    day30: retention(30),
    oldEnough7: old(7).length,
    oldEnough30: old(30).length,
    crowned: share((s) => s.crownedOnDay !== null),
    medianKeepLevel: keeps.length === 0 ? 0 : keeps[Math.floor((keeps.length - 1) / 2)]!,
  };
}
