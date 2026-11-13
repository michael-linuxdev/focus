import { describe, expect, it } from 'vitest';
import { FORECOURT, forecourtToRoad, shownPoint, unitPlaces } from '../../src/render/forecourt.ts';
import { findById, roadPointMilli } from '../../src/sim/index.ts';
import { gameData as data } from '../../src/app/data.ts';

const gate = data.rules.gateMilli;

describe('Vorfeld: Angreifer vor dem Tor sind sichtbar', () => {
  it('wer vor dem geschlossenen Tor wartet, steht in Reihen davor, niemand auf demselben Fleck', () => {
    for (const road of data.roads.roads) {
      const [gx, gy] = roadPointMilli(road, gate);
      const units = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, pos: gate }));
      const places = unitPlaces(units, road, true, data);
      const seen = new Set<string>();
      for (const u of units) {
        const [x, y] = places.get(u.id)!;
        expect(y, road.id).toBeLessThan(gy - 500); // oberhalb des Torhauses
        expect(y).toBeGreaterThanOrEqual(-(FORECOURT + 0.3) * 1000);
        expect(Math.abs(x - gx)).toBeLessThanOrEqual(1500);
        seen.add(`${x},${y}`);
      }
      expect(seen.size).toBe(30);
    }
  });

  it('wer anrückt, kommt vom oberen Rand herein; hinter dem Tor steht jeder an seinem Ort auf der Straße', () => {
    const road = findById(data.roads.roads, 'ostbogen', 'Straße');
    const places = unitPlaces([{ id: 1, pos: 0 }, { id: 2, pos: gate / 2 }, { id: 3, pos: gate + 2000 }, { id: 4, pos: 9000 }], road, true, data);
    expect(places.get(1)![1]).toBeLessThan(-FORECOURT * 1000);
    expect(places.get(2)![1]).toBeGreaterThan(places.get(1)![1]);
    expect(places.get(3)).toEqual(roadPointMilli(road, gate + 2000));
    expect(places.get(4)).toEqual(roadPointMilli(road, 9000));
    // Ohne Tor (geführter Ablauf, gebrochenes Tor) läuft der Weg ohne Halt bis zum Ort des Tors durch.
    const open = unitPlaces([{ id: 1, pos: gate }], road, false, data);
    expect(open.get(1)).toEqual(roadPointMilli(road, gate));
  });

  it('ein Tipp in die Menge trifft den Ort, an dem sie nach den Regeln steht; Tipps ins Feld bleiben, wo sie sind', () => {
    const road = findById(data.roads.roads, 'dorf_1', 'Straße');
    const [gx, gy] = roadPointMilli(road, gate);
    const places = unitPlaces(Array.from({ length: 12 }, (_, i) => ({ id: i, pos: gate })), road, true, data);
    for (const [x, y] of places.values()) expect(forecourtToRoad(x, y, road, true, data)).toEqual([gx, gy]);
    expect(forecourtToRoad(gx, gy + 3000, road, true, data)).toBeNull();
    expect(forecourtToRoad(gx + 3000, -500, road, true, data)).toBeNull();
    // Offenes Tor: Der Tipp im Vorfeld wird auf das erste Stück Straße zurückgerechnet.
    const shown = unitPlaces([{ id: 1, pos: 400 }], road, false, data).get(1)!;
    const back = forecourtToRoad(shown[0], shown[1], road, false, data)!;
    expect(Math.abs(back[1] - roadPointMilli(road, 400)[1])).toBeLessThanOrEqual(2);
  });

  it('Treffer auf Wartende werden in der Menge gezeichnet, alle anderen an ihrem Ort', () => {
    const road = findById(data.roads.roads, 'dorf_1', 'Straße');
    const [gx, gy] = roadPointMilli(road, gate);
    expect(shownPoint(gx, gy, road, true, data)[1]).toBeLessThan(gy - 500);
    expect(shownPoint(gx, gy, road, false, data)).toEqual([gx, gy]);
    expect(shownPoint(1000, 5000, road, true, data)).toEqual([1000, 5000]);
  });
});
