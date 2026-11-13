import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { findById, roadLengthMilli } from '../../src/sim/index.ts';
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
    for (const road of data.roads.roads) {
      expect(roadLengthMilli(road)).toBeGreaterThan(0);
      for (const p of road.waypoints) {
        expect(p[0]).toBeLessThan(data.roads.grid.cols);
        expect(p[1]).toBeLessThan(data.roads.grid.rows);
      }
    }
    for (const wave of data.waves.waves) {
      for (const g of wave.groups) expect(findById(data.units.units, g.unit, 'Einheit').id).toBe(g.unit);
    }
  });
});
