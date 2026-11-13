import { MILLI } from './fixed.ts';
import type { RoadDef } from './data.ts';

/** Länge einer Straße in Milli-Kacheln. Wirft bei schrägen oder leeren Abschnitten. */
export function roadLengthMilli(road: RoadDef): number {
  let len = 0;
  for (let i = 1; i < road.waypoints.length; i++) {
    const [ax, ay] = point(road, i - 1);
    const [bx, by] = point(road, i);
    const dx = Math.abs(bx - ax);
    const dy = Math.abs(by - ay);
    if ((dx === 0) === (dy === 0)) throw new Error(`Straße ${road.id}: Abschnitt ${i} ist nicht achsenparallel`);
    len += (dx + dy) * MILLI;
  }
  return len;
}

/**
 * Ort auf der Straße in Milli-Kacheln [x, y] zu einer Wegstrecke `pos` (Milli).
 * Reine Ganzzahlrechnung; die Darstellung nutzt dieselbe Funktion.
 */
export function roadPointMilli(road: RoadDef, pos: number): [number, number] {
  let rest = Math.max(0, pos);
  for (let i = 1; i < road.waypoints.length; i++) {
    const [ax, ay] = point(road, i - 1);
    const [bx, by] = point(road, i);
    const segLen = (Math.abs(bx - ax) + Math.abs(by - ay)) * MILLI;
    if (rest <= segLen) {
      return [ax * MILLI + Math.sign(bx - ax) * rest, ay * MILLI + Math.sign(by - ay) * rest];
    }
    rest -= segLen;
  }
  const [lx, ly] = point(road, road.waypoints.length - 1);
  return [lx * MILLI, ly * MILLI];
}

function point(road: RoadDef, i: number): [number, number] {
  const p = road.waypoints[i];
  const x = p?.[0];
  const y = p?.[1];
  if (x === undefined || y === undefined) throw new Error(`Straße ${road.id}: Wegpunkt ${i} fehlt`);
  return [x, y];
}
