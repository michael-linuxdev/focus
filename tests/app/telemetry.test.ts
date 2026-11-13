import { describe, expect, it } from 'vitest';
import { Recorder, localDay, type EventStore, type GameEvent } from '../../src/telemetry/events.ts';
import { aggregate, summarize, type ExportFile } from '../../src/telemetry/metrics.ts';

function memory(): EventStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

const DAY = 86_400_000;
const T0 = new Date(2026, 10, 13, 10, 0, 0).getTime();

describe('Ereignisaufzeichnung', () => {
  it('jedes Ereignis trägt Zeitstempel, Tag, Sitzungsnummer und laufende Nummer; jeder Start ist eine neue Sitzung', () => {
    const store = memory();
    let now = T0;
    const first = new Recorder(store, () => now, () => false, () => 'abc123');
    first.record('app_open', { fresh: true });
    now += 5000;
    first.record('tower_built', { tower: 'bogenturm', slot: 's1' });
    const second = new Recorder(store, () => now + DAY, () => false, () => 'anders');
    second.record('app_open');
    const events = second.all();
    expect(events.map((e) => [e.seq, e.session, e.type])).toEqual([[1, 1, 'app_open'], [2, 1, 'tower_built'], [3, 2, 'app_open']]);
    expect(events[0]).toMatchObject({ t: T0, day: localDay(T0), lapse: false, data: { fresh: true } });
    expect(events[2]!.day).toBe(localDay(T0 + DAY));
    expect(second.install).toBe('abc123'); // die Kennung der Installation bleibt
  });

  it('erfasst nichts Personenbezogenes: nur die vorgesehenen Felder', () => {
    const store = memory();
    const r = new Recorder(store, () => T0, () => false, () => 'id');
    r.record('battle_end', { kind: 'defense', result: 'held', depth: 0, ticks: 300 });
    expect(Object.keys(r.all()[0]!).sort()).toEqual(['data', 'day', 'lapse', 'seq', 'session', 't', 'type']);
    expect([...store.map.keys()].every((k) => k.startsWith('mk.ev.'))).toBe(true);
  });

  it('übersteht viele Ereignisse über mehrere Speicherblöcke, Löschen und einen vollen Speicher', () => {
    const store = memory();
    const r = new Recorder(store, () => T0, () => false, () => 'id');
    for (let i = 0; i < 450; i++) r.record('tower_built', { n: i });
    const again = new Recorder(store, () => T0, () => false, () => 'id');
    expect(again.all().length).toBe(450);
    expect(again.all()[449]!.data['n']).toBe(449);
    again.record('app_open');
    expect(again.all().length).toBe(451);
    again.clear();
    expect(again.all()).toEqual([]);
    const full = new Recorder({ ...memory(), setItem: () => { throw new Error('voll'); } }, () => T0, () => false, () => 'id');
    expect(() => full.record('app_open')).not.toThrow();
    expect(full.truncated).toBe(true);
  });

  it('die Sendestelle bekommt jedes neue Ereignis', () => {
    const sent: GameEvent[] = [];
    const r = new Recorder(memory(), () => T0, () => true, () => 'id', { send: (e) => void sent.push(...e) });
    r.record('alliance_joined');
    expect(sent.map((e) => e.type)).toEqual(['alliance_joined']);
    expect(sent[0]!.lapse).toBe(true);
  });
});

describe('Kennzahlen', () => {
  function play(script: (r: Recorder, wait: (ms: number) => void, restart: () => Recorder) => void): GameEvent[] {
    const store = memory();
    let now = T0;
    let r = new Recorder(store, () => now, () => false, () => 'spieler');
    script(r, (ms) => { now += ms; }, () => { r = new Recorder(store, () => now, () => false, () => 'x'); return r; });
    return r.all();
  }

  it('Minute 10, Allianzbeitritt und Rückkehr am nächsten Tag lassen sich aus den Ereignissen ablesen', () => {
    const events = play((r, wait, restart) => {
      r.record('app_open', { fresh: true });
      r.record('tutorial_step', { step: 'erster_turm', index: 0 });
      wait(8000);
      r.record('tower_built', { tower: 'bogenturm' });
      r.record('battle_end', { kind: 'defense', result: 'held', depth: 0 });
      wait(500_000);
      r.record('tutorial_step', { step: 'kaserne', index: 14 });
      r.record('battle_end', { kind: 'attack', result: 'breached', depth: 3 });
      r.record('action_cancelled', { what: 'sheet_tower' });
      r.record('alliance_joined');
      r.record('app_close');
      wait(DAY);
      restart().record('app_open');
    });
    const s = summarize(events, 'kaserne');
    expect(s.reachedMinute10).toBe(true);
    expect(s.secondsToMinute10).toBe(508);
    expect(s.secondsToFirstTower).toBe(8);
    expect(s.joinedAlliance).toBe(true);
    expect(s.returnedNextDay).toBe(true);
    expect(s.sessions).toBe(2);
    expect(s.daysActive).toBe(2);
    expect(s.lastStep).toBe('kaserne');
    expect(s.defenses).toEqual({ held: 1, breached: 0 });
    expect(s.attacks).toEqual({ count: 1, byDepth: [0, 0, 0, 1] });
    expect(s.cancelled).toEqual({ sheet_tower: 1 });
    expect(s.usedTimeLapse).toBe(false);
  });

  it('wer früh aufhört und erst zwei Tage später wiederkommt, zählt nicht als Rückkehr am nächsten Tag', () => {
    const events = play((r, wait, restart) => {
      r.record('app_open', { fresh: true });
      r.record('tutorial_step', { step: 'erster_turm', index: 0 });
      wait(2 * DAY);
      restart().record('app_open');
    });
    const s = summarize(events, 'kaserne');
    expect(s.reachedMinute10).toBe(false);
    expect(s.joinedAlliance).toBe(false);
    expect(s.returnedNextDay).toBe(false);
    expect(s.returnedLater).toBe(true);
    expect(summarize([], 'kaserne')).toMatchObject({ events: 0, reachedMinute10: false, returnedNextDay: false, firstDay: null });
  });

  it('mehrere Exporte ergeben die Anteile über alle Spieler', () => {
    const file = (events: GameEvent[], install: string): ExportFile => ({
      format: 1, app: { title: 't', dataVersion: '1', stateVersion: 5 }, install, exportedAt: T0, minute10Step: 'kaserne', truncated: false,
      summary: summarize(events, 'kaserne'), events,
    });
    const a = play((r) => { r.record('app_open'); r.record('tutorial_step', { step: 'kaserne', index: 14 }); r.record('alliance_joined'); });
    const b = play((r) => { r.record('app_open'); r.record('tutorial_step', { step: 'kaserne', index: 14 }); });
    const c = play((r) => { r.record('app_open'); });
    const d = play((r, wait, restart) => { r.record('app_open'); wait(DAY); restart().record('app_open'); });
    expect(aggregate([file(a, 'a'), file(b, 'b'), file(c, 'c'), file(d, 'd')])).toEqual({ players: 4, minute10: 50, alliance: 25, nextDay: 25, withTimeLapse: 0 });
    expect(aggregate([])).toMatchObject({ players: 0, minute10: 0 });
  });
});
