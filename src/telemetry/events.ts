/**
 * Ereignisaufzeichnung: lokal auf dem Gerät, ohne personenbezogene Daten und ohne fremde Dienste.
 * Ein Ereignis trägt Zeitstempel, Sitzungsnummer und wenige Spielwerte, sonst nichts
 * (kein Gerät, kein Browser, kein Ort, kein Name).
 */
export type EventValue = string | number | boolean | null;

export interface GameEvent {
  /** Zeitstempel in ms seit Epoche. */
  readonly t: number;
  /** Kalendertag des Geräts (JJJJ-MM-TT), für die Rückkehr am nächsten Tag. */
  readonly day: string;
  /** Sitzungsnummer: 1 beim ersten Start, bei jedem Start der App eins mehr. */
  readonly session: number;
  /** Laufende Nummer innerhalb der Installation. */
  readonly seq: number;
  readonly type: EventType;
  readonly data: Readonly<Record<string, EventValue>>;
  /** Mit Zeitraffer der Entwicklerseite entstanden: für echte Auswertungen ausschließen. */
  readonly lapse: boolean;
}

export type EventType =
  | 'app_open' | 'app_close' | 'app_reopen'
  | 'tutorial_step' | 'tower_built' | 'building_started'
  | 'battle_start' | 'battle_end'
  | 'action_cancelled'
  | 'alliance_joined' | 'help_requested' | 'goal_claimed' | 'raid_report';

/**
 * Sendestelle. Der Prototyp sendet nichts (`noSink`). Später kann hier ein eigener Empfänger
 * angeschlossen werden; die Aufzeichnung ruft `send` nach jedem Ereignis mit den neuen Ereignissen auf.
 */
export interface EventSink {
  send(events: readonly GameEvent[]): void;
}

export const noSink: EventSink = { send: () => undefined };

export interface EventStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const META_KEY = 'mk.ev.meta';
const CHUNK_KEY = 'mk.ev.';
const CHUNK_SIZE = 200;
/** Obergrenze, damit der Gerätespeicher nicht vollläuft (20 000 Ereignisse). */
const MAX_CHUNKS = 100;

interface Meta {
  /** Zufällige Kennung der Installation, damit sich mehrere Exporte auseinanderhalten lassen. Kein Personenbezug. */
  install: string;
  session: number;
  count: number;
  truncated: boolean;
}

export function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class Recorder {
  private meta: Meta;
  private last: GameEvent[] = [];

  constructor(
    private readonly store: EventStore,
    private readonly clock: () => number,
    private readonly isLapse: () => boolean,
    randomId: () => string,
    private readonly sink: EventSink = noSink,
  ) {
    let meta: Meta | null = null;
    try {
      meta = JSON.parse(store.getItem(META_KEY) ?? 'null') as Meta | null;
    } catch {
      meta = null;
    }
    this.meta = meta ?? { install: randomId(), session: 0, count: 0, truncated: false };
    this.meta.session += 1;
    this.last = this.readChunk(this.lastChunkIndex());
    this.writeMeta();
  }

  get install(): string { return this.meta.install; }
  get session(): number { return this.meta.session; }
  get truncated(): boolean { return this.meta.truncated; }

  record(type: EventType, data: Readonly<Record<string, EventValue>> = {}): void {
    if (this.meta.count >= CHUNK_SIZE * MAX_CHUNKS) {
      if (!this.meta.truncated) {
        this.meta.truncated = true;
        this.writeMeta();
      }
      return;
    }
    const t = this.clock();
    const event: GameEvent = { t, day: localDay(t), session: this.meta.session, seq: this.meta.count + 1, type, data, lapse: this.isLapse() };
    if (this.last.length >= CHUNK_SIZE) this.last = [];
    this.last.push(event);
    this.meta.count += 1;
    try {
      this.store.setItem(CHUNK_KEY + this.lastChunkIndex(), JSON.stringify(this.last));
      this.writeMeta();
    } catch {
      // Speicher voll oder gesperrt: Das Spiel läuft weiter, die Messung setzt aus.
      this.meta.truncated = true;
    }
    this.sink.send([event]);
  }

  all(): GameEvent[] {
    const out: GameEvent[] = [];
    for (let i = 0; i <= this.lastChunkIndex(); i++) out.push(...this.readChunk(i));
    return out;
  }

  clear(): void {
    for (let i = 0; i <= this.lastChunkIndex(); i++) this.store.removeItem(CHUNK_KEY + i);
    this.meta = { ...this.meta, count: 0, truncated: false };
    this.last = [];
    this.writeMeta();
  }

  private lastChunkIndex(): number {
    return this.meta.count === 0 ? 0 : Math.floor((this.meta.count - 1) / CHUNK_SIZE);
  }

  private readChunk(index: number): GameEvent[] {
    try {
      const parsed = JSON.parse(this.store.getItem(CHUNK_KEY + index) ?? '[]') as unknown;
      return Array.isArray(parsed) ? (parsed as GameEvent[]) : [];
    } catch {
      return [];
    }
  }

  private writeMeta(): void {
    try {
      this.store.setItem(META_KEY, JSON.stringify(this.meta));
    } catch {
      // siehe record()
    }
  }
}
