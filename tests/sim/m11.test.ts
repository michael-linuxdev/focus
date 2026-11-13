import { describe, expect, it } from 'vitest';
import { chapterProgress, createGame, currentChapter, reduceGame, scaledReward, type GameAction, type GameState } from '../../src/sim/index.ts';
import { loadGame, SAVE_KEY } from '../../src/app/save.ts';
import { t } from '../../src/app/texts.ts';
import { playTutorial } from './bot.ts';
import { data } from './testdata.ts';

const act = (g: GameState, ...actions: GameAction[]): GameState =>
  actions.reduce((s, a) => {
    const r = reduceGame(s, a, data);
    if (r.error) throw new Error(`${a.type}: ${r.error}`);
    return r.state;
  }, g);
const err = (g: GameState, a: GameAction) => reduceGame(g, a, data).error;
const end = playTutorial(createGame(7, 0, data), data, 'freies_spiel', 0, true).game;
const chapters = data.chronicle.chapters;

describe('M11: Chronik', () => {
  it('die Kapitel kommen der Reihe nach; abgeholt wird erst, wenn das Ziel erreicht ist', () => {
    expect(currentChapter(end, data)!.id).toBe(chapters[0]!.id);
    expect(chapterProgress(end, data)).toEqual({ have: 2, need: 3 });
    expect(err(end, { type: 'ClaimChapter' })).toBe('goal_not_reached');
    const grown = { ...end, keepLevel: 3 };
    const next = act(grown, { type: 'ClaimChapter' });
    expect(next.chapter).toBe(1);
    expect(next.resources.wood - grown.resources.wood).toBe(scaledReward(chapters[0]!.reward, grown, data).wood);
    expect(currentChapter(next, data)!.id).toBe(chapters[1]!.id);
    expect(next.crownedAt).toBeNull();
  });

  it('jede Art von Ziel misst ihren Fortschritt', () => {
    const at = (id: string, patch: Partial<GameState>) => chapterProgress({ ...end, chapter: chapters.findIndex((c) => c.id === id), ...patch }, data);
    expect(at('hauptmann', { wavesCleared: 4 })).toEqual({ have: 4, need: 6 });
    expect(at('hauptmann', { wavesCleared: 60 })).toEqual({ have: 6, need: 6 });
    // Nur Städte zählen, Räuberlager nicht.
    expect(at('eroberung', { campsTaken: ['raeuberlager_1'] })).toEqual({ have: 0, need: 1 });
    expect(at('eroberung', { campsTaken: ['raeuberlager_1', 'falkenried'] })).toEqual({ have: 1, need: 1 });
    expect(at('heer', {})).toEqual({ have: 1, need: 4 });
    expect(at('heer', { buildings: end.buildings.map((b) => (b.def === 'kaserne' ? { ...b, level: 5 } : b)) })).toEqual({ have: 4, need: 4 });
    expect(at('krone', { campsTaken: ['falkenried'] })).toEqual({ have: 0, need: 1 });
    expect(at('krone', { campsTaken: ['grauwacht'] })).toEqual({ have: 1, need: 1 });
  });

  it('mit dem letzten Kapitel ist der Spieler gekrönt; danach ist die Chronik vollendet', () => {
    const last: GameState = { ...end, chapter: chapters.length - 1, campsTaken: ['grauwacht'], now: end.now + 5000 };
    const crowned = act(last, { type: 'ClaimChapter' });
    expect(crowned.crownedAt).toBe(last.now);
    expect(currentChapter(crowned, data)).toBeNull();
    expect(chapterProgress(crowned, data)).toBeNull();
    expect(err(crowned, { type: 'ClaimChapter' })).toBe('chronicle_done');
  });

  it('eine Eroberung bis zum Burgfried wird gemerkt, jede Stadt nur einmal', () => {
    expect(end.campsTaken.every((id) => data.camps.camps.some((c) => c.id === id))).toBe(true);
    expect(new Set(end.campsTaken).size).toBe(end.campsTaken.length);
  });

  it('die Kapitel sind erreichbar und haben Texte', () => {
    const maxKeep = data.city.keepLevels.at(-1)!.level;
    for (const c of chapters) {
      expect(t(`chapter.${c.id}`)).not.toContain('⟦');
      const g = c.goal;
      if (g.type === 'keepLevel') expect(g.level).toBeLessThanOrEqual(maxKeep);
      if (g.type === 'wavesCleared') expect(g.count).toBeLessThanOrEqual((maxKeep - 1) * data.waves.scaling.wavesPerKeepLevel);
      if (g.type === 'citiesTaken') expect(g.count).toBeLessThanOrEqual(data.camps.camps.filter((x) => x.kind === 'city' && !x.shielded).length);
      if (g.type === 'buildingLevel') expect(data.buildings.buildings.find((b) => b.id === g.building)!.levels.length).toBeGreaterThanOrEqual(g.level);
      if (g.type === 'cityTaken') expect(data.camps.camps.find((x) => x.id === g.city)).toMatchObject({ kind: 'city', shielded: false });
    }
    expect(chapters.at(-1)!.id).toBe('krone');
  });

  it('ein Stand aus M10 (Version 10) beginnt die Chronik von vorn und kann erreichte Kapitel sofort abholen', () => {
    const { campsTaken: _c, chapter: _n, crownedAt: _k, ...rest } = end;
    const map = new Map([[SAVE_KEY, JSON.stringify({ ...rest, version: 10, keepLevel: 4 })]]);
    let g = loadGame({ getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) }, data)!;
    expect(g).toMatchObject({ chapter: 0, campsTaken: [], crownedAt: null });
    g = act(g, { type: 'ClaimChapter' });
    expect(g.chapter).toBe(1);
  });
});

describe('Feinschliff: Rückfrage vor teuren Turmausbauten', () => {
  it('die Stufen ab 3 kosten ein Vielfaches der ersten beiden, deshalb fragt die Oberfläche dort nach', () => {
    for (const tower of data.towers.towers) {
      expect(tower.levels[1]!.cost).toBeLessThan(500);
      expect(tower.levels[2]!.cost).toBeGreaterThanOrEqual(tower.levels[1]!.cost * 10);
    }
  });
});
