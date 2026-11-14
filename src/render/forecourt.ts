import { MILLI, roadPointMilli, type GameData, type RoadDef } from '../sim/index.ts';

/**
 * Vorfeld: so viele Kachelreihen zeigt die Darstellung oberhalb des Spielfelds, vor der Stadt. Dort läuft die Straße
 * sichtbar herein, und wer vor dem Tor wartet, steht dort in Reihen. Die Spiellogik kennt das Vorfeld nicht.
 */
export const FORECOURT = 2;


/** Aufstellung vor dem Tor: Figuren je Reihe, Abstand in Kacheln, Abstand der ersten Reihe vom Tor. */
const CROWD = { perRow: 6, gap: 0.36, front: 0.95 } as const;

/**
 * Wo eine Einheit gezeichnet wird (Milli-Kacheln). Hinter dem Tor ist das ihr Ort auf der Straße. Davor wird die erste
 * Kachel der Straße auf das Vorfeld gestreckt: Wer anrückt, kommt von oben herein; wer vor dem geschlossenen Tor
 * wartet, steht in Reihen davor statt auf einem Punkt hinter dem Torhaus.
 */
export function unitPlaces(units: readonly { readonly id: number; readonly pos: number }[], road: RoadDef, gateUp: boolean, data: GameData): Map<number, readonly [number, number]> {
  const out = new Map<number, readonly [number, number]>();
  const gate = data.rules.gateMilli;
  const [gx, gy] = roadPointMilli(road, gate);
  const [sx, sy] = roadPointMilli(road, 0);
  // Nur wenn die Straße gerade von oben hereinkommt (bei allen Straßen des Spiels der Fall).
  const straight = gx === sx && gy > sy;
  const top = -(FORECOURT + 0.3) * MILLI;
  const waiting = straight && gateUp ? units.filter((u) => u.pos <= gate && u.pos >= gate - 150).sort((a, b) => a.id - b.id) : [];
  const rows = Math.max(1, Math.floor((gy / MILLI - CROWD.front + FORECOURT) / CROWD.gap));
  waiting.forEach((u, k) => {
    const row = Math.min(rows - 1, Math.floor(k / CROWD.perRow));
    const col = k % CROWD.perRow;
    const shift = row % 2 === 1 ? CROWD.gap / 2 : 0;
    out.set(u.id, [gx + Math.round((col - (CROWD.perRow - 1) / 2 + shift) * CROWD.gap * MILLI), gy - Math.round((CROWD.front + row * CROWD.gap) * MILLI)]);
  });
  for (const u of units) {
    if (out.has(u.id)) continue;
    if (!straight || u.pos > gate) {
      const [x, y] = roadPointMilli(road, u.pos);
      out.set(u.id, [x, y]);
    } else {
      // Anrücken: vom oberen Rand des Vorfelds bis vor das Tor (oder bis zum Tor, wenn es offen ist).
      const end = gateUp ? gy - CROWD.front * MILLI : gy;
      out.set(u.id, [gx, Math.round(top + ((end - top) * u.pos) / gate)]);
    }
  }
  return out;
}

/**
 * Umkehrung für Tipps und Treffer: ein Punkt der Darstellung im Vorfeld (Milli-Kacheln) als Ort auf der Straße.
 * Steht das Tor, ist das der Punkt davor, an dem alle Wartenden tatsächlich stehen. Außerhalb des Vorfelds: `null`.
 */
export function forecourtToRoad(x: number, y: number, road: RoadDef, gateUp: boolean, data: GameData): readonly [number, number] | null {
  const gate = data.rules.gateMilli;
  const [gx, gy] = roadPointMilli(road, gate);
  const [sx, sy] = roadPointMilli(road, 0);
  if (gx !== sx || gy <= sy) return null;
  const limit = gateUp ? gy - MILLI / 2 : gy;
  if (y >= limit || Math.abs(x - gx) > 2 * MILLI) return null;
  if (gateUp) return [gx, gy];
  const top = -(FORECOURT + 0.3) * MILLI;
  const pos = Math.max(0, Math.min(gate, Math.round(((y - top) * gate) / (gy - top))));
  const [rx, ry] = roadPointMilli(road, pos);
  return [rx, ry];
}

/** Wo ein Treffer gezeichnet wird, der einem Wartenden vor dem Tor gilt: in der Mitte der Aufstellung. */
export function shownPoint(x: number, y: number, road: RoadDef, gateUp: boolean, data: GameData): readonly [number, number] {
  const [gx, gy] = roadPointMilli(road, data.rules.gateMilli);
  if (!gateUp || x !== gx || y > gy || roadPointMilli(road, 0)[0] !== gx) return [x, y];
  return [gx, gy - Math.round((CROWD.front + CROWD.gap) * MILLI)];
}
