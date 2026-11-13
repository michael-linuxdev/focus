import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { findById, roadLengthMilli, roadPointMilli } from '../../src/sim/index.ts';
import { data } from './testdata.ts';

const dir = join(import.meta.dirname, '..', '..', 'data');
const read = (p: string): unknown => JSON.parse(readFileSync(join(dir, p), 'utf8'));
const schemaFor = (file: string): string => `${file.replace(/\.[a-z]{2}\.json$/, '.json').replace('.json', '')}.schema.json`;

describe('Datendateien', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  it.each(files)('%s entspricht ihrem Schema', (file) => {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(read(join('schemas', schemaFor(file))) as object);
    validate(read(file));
    expect(validate.errors ?? []).toEqual([]);
  });

  it('Verweise zwischen den Dateien stimmen', () => {
    const { cols, rows } = data.roads.grid;
    const blocked = new Set([...data.city.towerSlots, ...data.city.plots].map((p) => `${p.x},${p.y}`));
    expect(blocked.size).toBe(data.city.towerSlots.length + data.city.plots.length);
    for (const road of data.roads.roads) {
      expect(roadLengthMilli(road)).toBeGreaterThan(0);
      // Keine Straße läuft über einen Bauplatz: jede Kachel der Straße ist frei.
      for (let pos = 0; pos <= roadLengthMilli(road); pos += 1000) {
        const [x, y] = roadPointMilli(road, pos);
        expect(x / 1000).toBeLessThan(cols);
        expect(y / 1000).toBeLessThan(rows);
        expect(blocked.has(`${x / 1000},${y / 1000}`), `${road.id} läuft über Bauplatz ${x / 1000},${y / 1000}`).toBe(false);
      }
    }
    const first = roadLengthMilli(findById(data.roads.roads, data.city.keepLevels[0]!.roads[0]!, 'Straße'));
    for (const level of data.city.keepLevels) {
      for (const id of level.roads) {
        const road = findById(data.roads.roads, id, 'Straße');
        // Gleiches Torhaus, gleicher Burgfried; höhere Stufen sind länger.
        expect(road.waypoints[0]).toEqual([4, 0]);
        expect(road.waypoints[road.waypoints.length - 1]).toEqual([4, 13]);
        if (level.level > 1) expect(roadLengthMilli(road)).toBeGreaterThan(first);
      }
    }
    for (const slot of data.city.towerSlots) expect(data.city.sections.some((s) => s.id === slot.section)).toBe(true);
    for (const wave of data.waves.waves) for (const g of wave.groups) findById(data.units.units, g.unit, 'Einheit');
    for (const t of data.troops.troops) findById(data.units.units, t.unit, 'Einheit');
    for (const r of data.hero.retinue) expect(data.troops.troops.some((t) => t.unit === r.unit)).toBe(true);
    for (const d of [...data.tutorial.defenses, data.tutorial.afterDefenses]) findById(data.waves.waves, d.wave, 'Welle');
    for (const camp of data.camps.camps) {
      findById(data.roads.roads, camp.roadId, 'Straße');
      for (const t of camp.towers) {
        findById(data.towers.towers, t.def, 'Turm');
        expect(data.city.towerSlots.some((s) => s.id === t.slot)).toBe(true);
      }
    }
    for (const step of data.tutorial.steps) {
      const h = step.hint;
      if (h?.type === 'slot') { findById(data.city.towerSlots, h.slot, 'Bauplatz'); findById(data.towers.towers, h.tower, 'Turm'); }
      if (h?.type === 'plot') { findById(data.city.plots, h.plot, 'Bauplatz'); findById(data.buildings.buildings, h.building, 'Gebäude'); }
    }
  });

  it('jeder Textschlüssel für Daten ist vorhanden', () => {
    const texts = (read('texts.de.json') as { texts: Record<string, string> }).texts;
    const need = [
      ...data.towers.towers.map((t) => `tower.${t.id}`), ...data.buildings.buildings.map((b) => `building.${b.id}`),
      ...data.troops.troops.map((t) => `unit.${t.unit}`), ...data.city.sections.map((s) => `section.${s.id}`),
      ...data.hero.abilities.map((a) => `ability.${a.id}`), `hero.${data.hero.id}`,
      ...data.city.keepLevels.flatMap((l) => (l.level > 1 ? l.roads.map((r) => `road.${r}`) : [])),
    ];
    for (const key of need) expect(texts[key], key).toBeTypeOf('string');
  });
});
