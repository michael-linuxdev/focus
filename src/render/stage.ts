import {
  MILLI, findById, marketMilli, militiaPosition, roadLengthMilli, roadPointMilli, towerLevel,
  type BattleTower, type Building, type CityTower, type GameData, type RoadDef, type Unit,
} from '../sim/index.ts';

import { drawSprite, groundPattern, setPixelRatio, spriteAspect, spritesReady } from './sprites.ts';

/**
 * Darstellung des Spielfelds. Liest den Zustand, ändert ihn nie.
 * Sind die Bilder geladen, zeichnet `drawWithSprites`; bis dahin (und als Rückfall) die einfachen Formen.
 */
const COLORS = {
  back: '#1d2a1f', ground: '#2c4030', grid: '#314836', road: '#b79a63',
  gate: '#7a5a3a', gateBroken: '#4a3a2a', keep: '#d8d2c0', market: '#d9a441',
  robber: '#b3372f', troop: '#4f8fd6', ram: '#8a6a45',
  hpBack: '#3a1512', hp: '#e9c46a', bar: '#c2553f',
  slot: '#8fa58f', plot: '#7f93a8', tower: '#cfc8b4', roof: '#4b6a8a', roofEnemy: '#9a3d36', catapult: '#6b4f2e',
  pitch: '#2a2420', militia: '#7fbf7f', weak: '#ff6b5e', help: '#7fd1ff',
  shot: '#f4e3a1', gold: '#e9b949', deny: '#e2574c', hint: '#ffffff', hero: '#c084fc', building: '#a7b8c9', disabled: '#ff8a3d',
} as const;

/** Platz für die Leiste oben (CSS-Pixel). Der Platz unten hängt von der Ansicht ab und kommt mit der Szene. */
const TOP = 56;

export interface Layout {
  readonly tile: number;
  readonly ox: number;
  readonly oy: number;
}

export function computeLayout(width: number, height: number, bottom: number, data: GameData): Layout {
  const { cols, rows } = data.roads.grid;
  const tile = Math.min(width / cols, (height - TOP - bottom) / rows);
  return { tile, ox: (width - tile * cols) / 2, oy: TOP + (height - TOP - bottom - tile * rows) / 2 };
}

/** Mitte einer Kachel in CSS-Pixeln relativ zum Canvas. */
export function tileCenter(layout: Layout, x: number, y: number): { x: number; y: number } {
  return { x: layout.ox + (x + 0.5) * layout.tile, y: layout.oy + (y + 0.5) * layout.tile };
}

export type TapTarget = { readonly kind: 'slot' | 'plot'; readonly id: string } | { readonly kind: 'keep' } | null;

/** Was unter einem Tipp liegt. Die Tippfläche ist die Kachel plus Rand, mindestens 44 px. */
export function targetAt(layout: Layout, road: RoadDef, px: number, py: number, data: GameData): TapTarget {
  const reach = Math.max(layout.tile * 0.7, 26);
  let best: TapTarget = null;
  let bestDist = reach * reach;
  const consider = (target: NonNullable<TapTarget>, x: number, y: number): void => {
    const c = tileCenter(layout, x, y);
    const d = (c.x - px) ** 2 + (c.y - py) ** 2;
    if (d <= bestDist) {
      best = target;
      bestDist = d;
    }
  };
  for (const s of data.city.towerSlots) consider({ kind: 'slot', id: s.id }, s.x, s.y);
  for (const p of data.city.plots) consider({ kind: 'plot', id: p.id }, p.x, p.y);
  const [kx, ky] = roadPointMilli(road, roadLengthMilli(road));
  consider({ kind: 'keep' }, kx / MILLI, ky / MILLI);
  return best;
}

/** Kurzlebige Effekte, die nur die Darstellung kennt (Zeit in ms, Ort in Kacheln). */
export interface Effect {
  readonly kind: 'text' | 'deny' | 'ring';
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly start: number;
}
const EFFECT_MS = 900;

export interface Scene {
  readonly roadId: string;
  readonly keepLevel: number;
  readonly towers: readonly (CityTower & Partial<BattleTower>)[];
  readonly units: readonly Unit[];
  /** Schlacht-Tick für Schussanimationen; -1 außerhalb von Schlachten. */
  readonly tick: number;
  /** Gold des Bauenden; `null` blendet leere Bauplätze aus (Angriff, Wiederholung). */
  readonly buildGold: number | null;
  /** Preis des günstigsten baubaren Turms, für die Beschriftung leerer Plätze. */
  readonly cheapestTower: number;
  /** Gebäude und Uhrzeit im Stadtbau; `null` blendet die Bauplätze abseits der Straße aus. */
  readonly buildings: {
    readonly list: readonly Building[]; readonly now: number; readonly showEmpty: boolean; readonly labels: Readonly<Record<string, string>>;
    /** Beschriftung für Baustellen, bei denen der Spieler um Hilfe bitten kann. */
    readonly helpLabel: string | null;
  } | null;
  readonly gate: { readonly hp: number; readonly max: number } | null;
  readonly showMarket: boolean;
  readonly keep: { readonly hp: number; readonly max: number } | null;
  /** Restsekunden des Burgfried-Ausbaus. */
  readonly keepBusySeconds: number | null;
  readonly heroSection: string | null;
  /** Abschnitt, der als Schwachstelle hervorgehoben wird. */
  readonly weakSection: string | null;
  readonly enemyCity: boolean;
  /** Der Spieler wählt gerade einen Turm als Ziel. */
  readonly targeting: boolean;
  readonly shielded: boolean;
  /** Letzter Pfeilhagel: Ort in Milli-Kacheln und Alter in Ticks; `null`, wenn keiner zu zeigen ist. */
  readonly volley: { readonly x: number; readonly y: number; readonly age: number } | null;
  /** Kampfruf aktiv: Türme schießen doppelt so schnell. */
  readonly haste: boolean;
  /** Kachel, auf die der Tutorial-Hinweis zeigt. */
  readonly hint: { readonly x: number; readonly y: number; readonly cost: string | null } | null;
  readonly effects: readonly Effect[];
  readonly timeMs: number;
  /** Höhe der Schaltflächen am unteren Rand in CSS-Pixeln; das Spielfeld nutzt den Rest. */
  readonly bottomInset: number;
}

export function drawStage(canvas: HTMLCanvasElement, scene: Scene, data: GameData): Layout {
  const { timeMs } = scene;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const layout = computeLayout(w, h, scene.bottomInset, data);
  const ctx = canvas.getContext('2d');
  if (!ctx) return layout;
  const { cols, rows } = data.roads.grid;
  const { tile } = layout;
  const px = (milli: number): number => (milli / MILLI + 0.5) * tile;
  const road = findById(data.roads.roads, scene.roadId, 'Straße');
  const length = roadLengthMilli(road);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const groundEl = document.getElementById('ground') as HTMLCanvasElement | null;
  if (spritesReady() && groundEl) {
    // Boden und Straße liegen als eigene, ruhende Fläche unter dem Spielfeld; hier wird nur das Bewegte gezeichnet.
    ctx.clearRect(0, 0, w, h);
    ctx.translate(layout.ox, layout.oy);
    setPixelRatio(dpr);
    drawWithSprites(ctx, scene, data, layout, dpr, groundEl);
    return layout;
  }
  if (groundEl) groundEl.style.display = 'none';
  ctx.fillStyle = COLORS.back;
  ctx.fillRect(0, 0, w, h);
  ctx.translate(layout.ox, layout.oy);
  ctx.fillStyle = scene.enemyCity ? '#3a3528' : COLORS.ground;
  ctx.fillRect(0, 0, tile * cols, tile * rows);
  ctx.strokeStyle = scene.enemyCity ? '#443e2f' : COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < cols; c++) { ctx.moveTo(c * tile, 0); ctx.lineTo(c * tile, rows * tile); }
  for (let r = 1; r < rows; r++) { ctx.moveTo(0, r * tile); ctx.lineTo(cols * tile, r * tile); }
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Straße
  ctx.strokeStyle = COLORS.road;
  ctx.lineWidth = tile * 0.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  road.waypoints.forEach((p, i) => {
    const x = ((p[0] ?? 0) + 0.5) * tile;
    const y = ((p[1] ?? 0) + 0.5) * tile;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Marktplatz, Torhaus, Burgfried
  if (scene.showMarket) {
    const [mx, my] = roadPointMilli(road, marketMilli(length, data));
    ctx.fillStyle = COLORS.market;
    ctx.beginPath();
    ctx.moveTo(px(mx), px(my) - tile * 0.3);
    ctx.lineTo(px(mx) + tile * 0.3, px(my));
    ctx.lineTo(px(mx), px(my) + tile * 0.3);
    ctx.lineTo(px(mx) - tile * 0.3, px(my));
    ctx.fill();
  }
  const [gx, gy] = roadPointMilli(road, scene.gate ? data.rules.gateMilli : 0);
  const gateUp = !scene.gate || scene.gate.hp > 0;
  ctx.fillStyle = gateUp ? COLORS.gate : COLORS.gateBroken;
  ctx.fillRect(px(gx) - tile * 0.5, px(gy) - (scene.gate ? tile * 0.1 : tile * 0.4), tile, tile * (gateUp ? 0.3 : 0.12));
  if (scene.gate && scene.gate.hp > 0) bar(ctx, px(gx), px(gy) - tile * 0.28, tile, scene.gate.hp / scene.gate.max, COLORS.bar);
  const [kx, ky] = roadPointMilli(road, length);
  ctx.fillStyle = COLORS.keep;
  const keepSize = tile * (0.8 + 0.1 * Math.min(scene.keepLevel, 3));
  ctx.fillRect(px(kx) - keepSize / 2, px(ky) - keepSize / 2, keepSize, keepSize);
  ctx.fillStyle = COLORS.back;
  for (let i = 0; i < scene.keepLevel; i++) ctx.fillRect(px(kx) - keepSize * 0.3 + i * keepSize * 0.25, px(ky) - keepSize * 0.1, keepSize * 0.15, keepSize * 0.3);
  if (scene.keep && scene.keep.hp < scene.keep.max) bar(ctx, px(kx), px(ky) + tile * 0.5, tile, scene.keep.hp / scene.keep.max, COLORS.bar);
  if (scene.keepBusySeconds !== null) label(ctx, px(kx), px(ky) - tile * 0.75, tile, formatSeconds(scene.keepBusySeconds), COLORS.hint);

  // Bauplätze abseits der Straße
  if (scene.buildings) {
    for (const plot of data.city.plots) {
      const cx = (plot.x + 0.5) * tile;
      const cy = (plot.y + 0.5) * tile;
      const b = scene.buildings.list.find((x) => x.plot === plot.id);
      if (!b) {
        if (!scene.buildings.showEmpty) continue;
        ctx.setLineDash([tile * 0.08, tile * 0.1]);
        ctx.strokeStyle = COLORS.plot;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, tile * 0.36, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      const remaining = Math.ceil((b.doneAt - scene.buildings.now) / 1000);
      ctx.globalAlpha = remaining > 0 ? 0.5 : 1;
      ctx.fillStyle = COLORS.building;
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      label(ctx, cx, cy + 1, tile, (scene.buildings.labels[b.def] ?? '?').slice(0, 1), COLORS.back);
      if (remaining > 0) {
        label(ctx, cx, cy - tile * 0.62, tile, formatSeconds(remaining), COLORS.hint);
        if (scene.buildings.helpLabel !== null && b.helpRequestedAt === null) label(ctx, cx, cy + tile * 0.62, tile, scene.buildings.helpLabel, COLORS.help);
      }
    }
  }

  // Turm-Bauplätze und Türme
  const cheapest = scene.cheapestTower;
  for (const slot of data.city.towerSlots) {
    const cx = (slot.x + 0.5) * tile;
    const cy = (slot.y + 0.5) * tile;
    const tower = scene.towers.find((t) => t.slot === slot.id);
    const hinted = scene.hint !== null && scene.hint.x === slot.x && scene.hint.y === slot.y;
    if (slot.section === scene.weakSection && slot.keepLevel <= scene.keepLevel) {
      ctx.strokeStyle = COLORS.weak;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(timeMs / 150);
      ctx.strokeRect(cx - tile * 0.46, cy - tile * 0.46, tile * 0.92, tile * 0.92);
      ctx.globalAlpha = 1;
    }
    if (!tower) {
      if (scene.buildGold === null || slot.keepLevel > scene.keepLevel) continue;
      // Solange ein Hinweis auf einen Platz zeigt, treten die anderen zurück.
      ctx.globalAlpha = scene.buildGold < cheapest || (scene.hint !== null && !hinted) ? 0.35 : 1;
      ctx.setLineDash([tile * 0.14, tile * 0.1]);
      ctx.strokeStyle = COLORS.slot;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - tile * 0.38, cy - tile * 0.38, tile * 0.76, tile * 0.76);
      ctx.setLineDash([]);
      cost(ctx, cx, cy, tile, String(hinted && scene.hint?.cost ? scene.hint.cost : cheapest));
      ctx.globalAlpha = 1;
      continue;
    }
    const def = findById(data.towers.towers, tower.def, 'Turm');
    const level = towerLevel(tower, data);
    const disabled = tower.disabledUntil !== undefined && scene.tick >= 0 && scene.tick < tower.disabledUntil;
    if (hinted || scene.targeting) {
      ctx.strokeStyle = scene.targeting ? COLORS.disabled : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = scene.targeting ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, scene.targeting ? tile * 0.55 : (level.rangeMilli / MILLI) * tile, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (slot.section === scene.heroSection) {
      ctx.strokeStyle = COLORS.hero;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - tile * 0.4, cy - tile * 0.4, tile * 0.8, tile * 0.8);
    }
    ctx.globalAlpha = disabled ? 0.45 : 1;
    ctx.fillStyle = COLORS.tower;
    ctx.fillRect(cx - tile * 0.32, cy - tile * 0.32, tile * 0.64, tile * 0.64);
    if (def.kind === 'slow') {
      // Pechnase: dunkler Kessel, schwacher Ring zeigt den Umkreis
      ctx.fillStyle = COLORS.pitch;
      ctx.beginPath();
      ctx.arc(cx, cy - tile * 0.02, tile * 0.2, 0, Math.PI);
      ctx.fill();
      ctx.fillRect(cx - tile * 0.24, cy - tile * 0.08, tile * 0.48, tile * 0.07);
      ctx.strokeStyle = 'rgba(42,36,32,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, (level.rangeMilli / MILLI) * tile, 0, Math.PI * 2);
      ctx.stroke();
    } else if (def.kind === 'militia') {
      // Wachstube: Schild
      ctx.fillStyle = COLORS.militia;
      ctx.beginPath();
      ctx.moveTo(cx - tile * 0.18, cy - tile * 0.2);
      ctx.lineTo(cx + tile * 0.18, cy - tile * 0.2);
      ctx.lineTo(cx + tile * 0.18, cy + tile * 0.02);
      ctx.lineTo(cx, cy + tile * 0.2);
      ctx.lineTo(cx - tile * 0.18, cy + tile * 0.02);
      ctx.fill();
    } else if (def.splashMilli > 0) {
      // Katapult: Wurfarm
      ctx.strokeStyle = COLORS.catapult;
      ctx.lineWidth = tile * 0.1;
      ctx.beginPath();
      ctx.moveTo(cx - tile * 0.2, cy + tile * 0.15);
      ctx.lineTo(cx + tile * 0.18, cy - tile * 0.18);
      ctx.stroke();
      ctx.fillStyle = COLORS.catapult;
      ctx.beginPath();
      ctx.arc(cx + tile * 0.18, cy - tile * 0.18, tile * 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = scene.enemyCity ? COLORS.roofEnemy : COLORS.roof;
      ctx.beginPath();
      ctx.moveTo(cx, cy - tile * 0.22);
      ctx.lineTo(cx + tile * 0.2, cy + tile * 0.12);
      ctx.lineTo(cx - tile * 0.2, cy + tile * 0.12);
      ctx.fill();
    }
    if (def.kind === 'militia') {
      // Miliz auf der Straße: drei Posten, mit Lebensbalken in der Schlacht
      const mPos = tower.militiaPos !== undefined ? tower.militiaPos : militiaPosition(road, slot.x, slot.y, data);
      const alive = tower.militiaHp === undefined || tower.militiaHp > 0;
      const [mx, my] = roadPointMilli(road, mPos);
      ctx.globalAlpha = alive ? 1 : 0.25;
      ctx.fillStyle = COLORS.militia;
      for (const off of [-0.2, 0, 0.2]) ctx.fillRect(px(mx) + off * tile - tile * 0.07, px(my) - tile * 0.07 + Math.abs(off) * tile * 0.3, tile * 0.14, tile * 0.14);
      ctx.globalAlpha = 1;
      if (tower.militiaHp !== undefined && tower.militiaHp > 0 && tower.militiaHp < level.militiaHp) bar(ctx, px(mx), px(my) - tile * 0.3, tile * 0.6, tower.militiaHp / level.militiaHp, COLORS.militia);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < tower.level; i++) {
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(cx - tile * 0.28 + i * tile * 0.16, cy + tile * 0.2, tile * 0.1, tile * 0.08);
    }
    if (disabled) {
      ctx.fillStyle = COLORS.disabled;
      ctx.beginPath();
      ctx.arc(cx, cy - tile * 0.05, tile * 0.14 + Math.sin(timeMs / 80) * tile * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
    const next = def.levels[tower.level];
    if (scene.buildGold !== null && next && next.keepLevel <= scene.keepLevel && scene.buildGold >= next.cost) {
      // Ausbau möglich: Pfeil nach oben, mit Preis, wenn der Hinweis darauf zeigt
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.moveTo(cx + tile * 0.3, cy - tile * 0.5);
      ctx.lineTo(cx + tile * 0.46, cy - tile * 0.3);
      ctx.lineTo(cx + tile * 0.14, cy - tile * 0.3);
      ctx.fill();
      if (hinted) cost(ctx, cx - tile * 0.25, cy - tile * 0.62, tile, String(next.cost));
    }
    if (tower.lastShotTick !== undefined && tower.lastShotTick >= 0 && scene.tick - tower.lastShotTick <= 3 && tower.targetX !== undefined && tower.targetY !== undefined) {
      const age = (scene.tick - tower.lastShotTick) / 4;
      ctx.strokeStyle = COLORS.shot;
      ctx.lineWidth = def.splashMilli > 0 ? 4 : 2;
      ctx.globalAlpha = 1 - age;
      if (def.kind === 'shot') {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px(tower.targetX), px(tower.targetY));
        ctx.stroke();
      } else if (def.kind === 'slow') {
        ctx.strokeStyle = COLORS.pitch;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(cx, cy, (level.rangeMilli / MILLI) * tile * (0.3 + age * 0.7), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(px(tower.targetX), px(tower.targetY), tile * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (def.splashMilli > 0) {
        ctx.beginPath();
        ctx.arc(px(tower.targetX), px(tower.targetY), (def.splashMilli / MILLI) * tile * (0.5 + age * 0.5), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Einheiten
  for (const u of scene.units) {
    const [ux, uy] = roadPointMilli(road, u.pos);
    const x = px(ux);
    const y = px(uy);
    const def = findById(data.units.units, u.def, 'Einheit');
    const isTroop = data.troops.troops.some((t) => t.unit === u.def);
    if (!isTroop) {
      ctx.fillStyle = COLORS.robber;
      ctx.beginPath();
      ctx.arc(x, y, tile * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.siege > def.armor + 2) {
      ctx.fillStyle = COLORS.ram;
      ctx.fillRect(x - tile * 0.26, y - tile * 0.16, tile * 0.52, tile * 0.32);
    } else if (def.armor > 0) {
      ctx.fillStyle = COLORS.troop;
      ctx.fillRect(x - tile * 0.2, y - tile * 0.2, tile * 0.4, tile * 0.4);
    } else {
      ctx.fillStyle = COLORS.troop;
      ctx.beginPath();
      ctx.arc(x, y, tile * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isTroop && scene.shielded) {
      ctx.strokeStyle = COLORS.hint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, tile * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (u.hp < def.hp) bar(ctx, x, y - tile * 0.36, tile * 0.5, u.hp / def.hp, COLORS.hp);
  }

  // Effekte
  for (const e of scene.effects) {
    const age = (timeMs - e.start) / EFFECT_MS;
    if (age < 0 || age >= 1) continue;
    const cx = (e.x + 0.5) * tile;
    const cy = (e.y + 0.5) * tile;
    ctx.globalAlpha = 1 - age;
    if (e.kind === 'text') {
      // Text bleibt im Spielfeld, auch wenn seine Quelle am Rand liegt.
      ctx.font = `600 ${Math.round(tile * 1.2 * 0.32)}px system-ui, sans-serif`;
      const half = ctx.measureText(e.text).width / 2 + 4;
      label(ctx, Math.max(half, Math.min(cols * tile - half, cx)), cy - tile * (0.3 + age * 0.7), tile * 1.2, e.text, COLORS.gold);
    } else if (e.kind === 'deny') {
      ctx.strokeStyle = COLORS.deny;
      ctx.lineWidth = 3;
      const shake = Math.sin(age * 40) * tile * 0.08 * (1 - age);
      ctx.strokeRect(cx - tile * 0.4 + shake, cy - tile * 0.4, tile * 0.8, tile * 0.8);
    } else {
      ctx.strokeStyle = COLORS.hint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, tile * (0.4 + age * 2), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (scene.hint) pointer(ctx, (scene.hint.x + 0.5) * tile, (scene.hint.y + 0.5) * tile, tile, timeMs);
  return layout;
}

/** Restzeit: unter zwei Minuten in Sekunden, sonst Minuten:Sekunden. */
export function formatSeconds(seconds: number): string {
  if (seconds < 120) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  // Lange Bauzeiten in Stunden und Minuten.
  const minutes = Math.floor(seconds / 60);
  return minutes % 60 === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function bar(ctx: CanvasRenderingContext2D, cx: number, y: number, width: number, share: number, color: string): void {
  ctx.fillStyle = COLORS.hpBack;
  ctx.fillRect(cx - width / 2, y, width, 4);
  ctx.fillStyle = color;
  ctx.fillRect(cx - width / 2, y, width * Math.max(0, Math.min(1, share)), 4);
}

function label(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, text: string, color: string): void {
  ctx.font = `700 ${Math.round(tile * 0.32)}px system-ui, sans-serif`;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(20,16,12,0.8)';
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = color;
  ctx.fillText(text, cx, cy);
}

function cost(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, text: string): void {
  ctx.font = `700 ${Math.round(tile * 0.3)}px system-ui, sans-serif`;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(20,16,12,0.8)';
  ctx.strokeText(text, cx + tile * 0.1, cy + 1);
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.arc(cx - tile * 0.2, cy, tile * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillText(text, cx + tile * 0.1, cy + 1);
}

/** Pfeilhagel: Kreis des Wirkungsbereichs und schräg einschlagende Pfeile, wenige Ticks lang. */
function drawVolley(ctx: CanvasRenderingContext2D, scene: Scene, data: GameData, tile: number): void {
  const v = scene.volley;
  if (!v || v.age > 8) return;
  const cx = (v.x / MILLI + 0.5) * tile;
  const cy = (v.y / MILLI + 0.5) * tile;
  const radius = (data.rules.volley.radiusMilli / MILLI) * tile;
  const t = v.age / 8;
  ctx.globalAlpha = 1 - t;
  ctx.fillStyle = 'rgba(244, 227, 161, 0.18)';
  ctx.strokeStyle = COLORS.shot;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 9; i++) {
    // Feste Streuung je Pfeil, damit das Bild nicht flackert.
    const angle = i * 2.4;
    const dist = radius * (0.2 + ((i * 37) % 70) / 100);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist * 0.7;
    const fall = (1 - Math.min(1, t * 2.5)) * tile * 1.6;
    ctx.beginPath();
    ctx.moveTo(x + fall * 0.5, y - fall - tile * 0.35);
    ctx.lineTo(x + fall * 0.5 - tile * 0.1, y - fall);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Preis auf einem dunklen Schild mit Münze; rot gedämpft, wenn das Gold nicht reicht. */
function priceTag(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, text: string, affordable: boolean): void {
  ctx.font = `700 ${Math.round(tile * 0.3)}px system-ui, sans-serif`;
  const textW = ctx.measureText(text).width;
  const w = textW + tile * 0.42;
  const h = tile * 0.38;
  ctx.fillStyle = 'rgba(20, 16, 12, 0.82)';
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.arc(cx - w / 2 + tile * 0.17, cy, tile * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = affordable ? '#fff4c8' : '#c98a80';
  ctx.fillText(text, cx + tile * 0.1, cy + 1);
}

/** Hinweis: pulsierender Ring und tippender Finger. */
function pointer(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, timeMs: number): void {
  const phase = (timeMs % 1000) / 1000;
  const press = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  ctx.strokeStyle = COLORS.hint;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 1 - phase;
  ctx.beginPath();
  ctx.arc(cx, cy, tile * (0.35 + phase * 0.45), 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const lift = (1 - press) * tile * 0.18;
  ctx.save();
  ctx.translate(cx + tile * 0.12 + lift, cy + tile * 0.12 + lift);
  ctx.rotate(-0.5);
  ctx.fillStyle = COLORS.hint;
  ctx.strokeStyle = COLORS.back;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-tile * 0.15, 0, tile * 0.3, tile * 0.95, tile * 0.15);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---------- Darstellung mit Bildern ----------

/** Breite eines Turms in Kacheln, je Art (die Bilder sind unterschiedlich schlank). */
const TOWER_WIDTH: Readonly<Record<string, number>> = { bogenturm: 0.72, katapult: 0.95, pechnase: 0.82, wachstube: 0.86 };
/** Einheiten ohne eigenes Bild leihen sich eines und werden in anderer Größe gezeichnet. */
const UNIT_SPRITE: Readonly<Record<string, { sprite: string; scale: number }>> = { laeufer: { sprite: 'raeuber', scale: 0.8 } };
/** Fahrzeuge werden breiter gezeichnet als Fußtruppen und rütteln statt zu hüpfen. */
const VEHICLES = new Set(['ramme', 'sturmbock']);

/** Merkt sich je Einheit Leben und Blickrichtung, um Treffer aufblitzen zu lassen und Figuren zu spiegeln. Nur Darstellung. */
const unitLook = new Map<number, { hp: number; flashUntil: number; flip: boolean }>();
let lastTick = -1;

/** Schlüssel des zuletzt gezeichneten Bodens (Straße, Größe, Lage); nur bei Änderung wird neu gezeichnet. */
let groundKey = '';

function drawWithSprites(ctx: CanvasRenderingContext2D, scene: Scene, data: GameData, layout: Layout, dpr: number, canvas: HTMLCanvasElement): void {
  const tile = layout.tile;
  const { timeMs } = scene;
  const { cols, rows } = data.roads.grid;
  const px = (milli: number): number => (milli / MILLI + 0.5) * tile;
  const road = findById(data.roads.roads, scene.roadId, 'Straße');
  const length = roadLengthMilli(road);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (scene.tick < lastTick) unitLook.clear();
  lastTick = scene.tick;

  // Boden, Straße, Marktplatz: aus dem Zwischenspeicher, neu gezeichnet nur bei anderer Straße oder Größe.
  const fieldW = tile * cols;
  const fieldH = tile * rows;
  const key = `${scene.roadId}|${scene.enemyCity}|${scene.showMarket}|${Math.round(tile * 100)}|${dpr}|${Math.round(layout.ox)}|${Math.round(layout.oy)}`;
  if (groundKey !== key) {
    canvas.width = Math.round(fieldW * dpr);
    canvas.height = Math.round(fieldH * dpr);
    canvas.style.left = `${layout.ox}px`;
    canvas.style.top = `${layout.oy}px`;
    canvas.style.width = `${fieldW}px`;
    canvas.style.height = `${fieldH}px`;
    canvas.style.display = 'block';
    const g = canvas.getContext('2d');
    if (g) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = groundPattern(g, scene.enemyCity ? 'lager' : 'wiese', tile * 3) ?? COLORS.ground;
      g.fillRect(0, 0, fieldW, fieldH);
      const path = (): void => {
        g.beginPath();
        road.waypoints.forEach((p, i) => {
          const x = ((p[0] ?? 0) + 0.5) * tile;
          const y = ((p[1] ?? 0) + 0.5) * tile;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        });
      };
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(40, 30, 18, 0.55)';
      g.lineWidth = tile * 0.74;
      path();
      g.stroke();
      g.strokeStyle = groundPattern(g, 'strasse', tile * 2.5) ?? COLORS.road;
      g.lineWidth = tile * 0.62;
      path();
      g.stroke();
      if (scene.showMarket) {
        const [mx, my] = roadPointMilli(road, marketMilli(length, data));
        const width = tile * 1.7;
        drawSprite(g, 'marktplatz', px(mx), px(my) + (width * spriteAspect('marktplatz')) / 2, width);
      }
    }
    groundKey = key;
  }

  // Alles Aufrechte wird nach seiner Standlinie sortiert, damit Vorderes Hinteres verdeckt.
  const things: { y: number; draw: () => void }[] = [];
  const overlays: (() => void)[] = [];

  // Torhaus
  {
    const [gx, gy] = roadPointMilli(road, scene.gate ? data.rules.gateMilli : 0);
    const broken = scene.gate !== null && scene.gate.hp <= 0;
    // Das Torhaus steht in der obersten Kachelreihe und darf nicht in die Leiste darüber ragen.
    const width = tile * 1.3;
    things.push({ y: px(gy) + tile * 0.1, draw: () => void drawSprite(ctx, broken ? 'torhaus_kaputt' : 'torhaus', px(gx), px(gy) + tile * 0.58, width) });
    if (scene.gate && scene.gate.hp > 0) {
      const gate = scene.gate;
      overlays.push(() => bar(ctx, px(gx), px(gy) + tile * 0.56, tile, gate.hp / gate.max, COLORS.bar));
    }
  }

  // Burgfried
  {
    const [kx, ky] = roadPointMilli(road, length);
    const width = tile * (scene.keepLevel >= 2 ? 1.45 : 1.25);
    const name = scene.keepLevel >= 2 ? 'burgfried_2' : 'burgfried_1';
    things.push({ y: px(ky) + tile * 0.2, draw: () => void drawSprite(ctx, name, px(kx), px(ky) + tile * 0.5, width) });
    const top = px(ky) + tile * 0.5 - width * spriteAspect(name);
    if (scene.keep && scene.keep.hp < scene.keep.max) {
      const keep = scene.keep;
      overlays.push(() => bar(ctx, px(kx), top - 8, tile, keep.hp / keep.max, COLORS.bar));
    }
    if (scene.keepBusySeconds !== null) {
      const seconds = scene.keepBusySeconds;
      overlays.push(() => label(ctx, px(kx), top - 10, tile, formatSeconds(seconds), COLORS.hint));
    }
  }

  // Bauplätze abseits der Straße
  if (scene.buildings) {
    const info = scene.buildings;
    for (const plot of data.city.plots) {
      const cx = (plot.x + 0.5) * tile;
      const cy = (plot.y + 0.5) * tile;
      const b = info.list.find((x) => x.plot === plot.id);
      if (!b) {
        if (info.showEmpty) things.push({ y: cy - tile, draw: () => { ctx.globalAlpha = 0.85; drawSprite(ctx, 'bauplatz', cx, cy + tile * 0.3, tile * 0.95); ctx.globalAlpha = 1; } });
        continue;
      }
      const remaining = Math.ceil((b.doneAt - info.now) / 1000);
      const name = remaining > 0 ? 'baustelle' : b.def;
      const width = tile * 0.96;
      things.push({ y: cy, draw: () => void drawSprite(ctx, name, cx, cy + tile * 0.42, width) });
      if (remaining > 0) {
        const top = cy + tile * 0.42 - width * spriteAspect(name);
        overlays.push(() => {
          label(ctx, cx, top - 6, tile, formatSeconds(remaining), COLORS.hint);
          if (info.helpLabel !== null && b.helpRequestedAt === null) label(ctx, cx, cy + tile * 0.62, tile, info.helpLabel, COLORS.help);
        });
      } else if (b.level > 1) {
        // Ausbaustufe als kleine Zahl am Gebäude
        overlays.push(() => label(ctx, cx + tile * 0.36, cy + tile * 0.4, tile * 0.85, String(b.level), COLORS.gold));
      }
    }
  }

  // Turm-Bauplätze und Türme
  for (const slot of data.city.towerSlots) {
    const cx = (slot.x + 0.5) * tile;
    const cy = (slot.y + 0.5) * tile;
    const tower = scene.towers.find((t) => t.slot === slot.id);
    const hinted = scene.hint !== null && scene.hint.x === slot.x && scene.hint.y === slot.y;
    const marked = slot.keepLevel <= scene.keepLevel && (slot.section === scene.weakSection || (tower !== undefined && slot.section === scene.heroSection));
    if (marked) {
      // Markierung auf dem Boden: rot pulsierend für die Schwachstelle, violett für den Abschnitt der Heldin.
      const weak = slot.section === scene.weakSection;
      things.push({ y: cy - tile * 2, draw: () => {
        ctx.strokeStyle = weak ? COLORS.weak : COLORS.hero;
        ctx.lineWidth = 3;
        ctx.globalAlpha = weak ? 0.6 + 0.4 * Math.sin(timeMs / 150) : 0.9;
        ctx.beginPath();
        ctx.ellipse(cx, cy + tile * 0.12, tile * 0.5, tile * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } });
    }
    if (!tower) {
      if (scene.buildGold === null || slot.keepLevel > scene.keepLevel) continue;
      const dim = scene.buildGold < scene.cheapestTower || (scene.hint !== null && !hinted);
      const price = String(hinted && scene.hint?.cost ? scene.hint.cost : scene.cheapestTower);
      const affordable = scene.buildGold >= scene.cheapestTower;
      things.push({ y: cy - tile, draw: () => {
        // Leerer Turmplatz: heller Schein und gestrichelte Raute, damit er sich vom Boden abhebt;
        // bezahlbare Plätze pulsieren leicht, der Preis steht auf einem dunklen Schild.
        const pulse = affordable && !dim ? 0.5 + 0.5 * Math.sin(timeMs / 350 + slot.x) : 0;
        ctx.globalAlpha = dim ? 0.75 : 1;
        ctx.fillStyle = `rgba(255, 244, 200, ${0.1 + pulse * 0.12})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy + tile * 0.08, tile * 0.56, tile * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        drawSprite(ctx, 'turmplatz', cx, cy + tile * 0.4, tile * 1.08);
        ctx.setLineDash([tile * 0.1, tile * 0.07]);
        ctx.strokeStyle = affordable ? `rgba(255, 244, 200, ${0.65 + pulse * 0.35})` : 'rgba(255, 244, 200, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - tile * 0.28);
        ctx.lineTo(cx + tile * 0.6, cy + tile * 0.08);
        ctx.lineTo(cx, cy + tile * 0.44);
        ctx.lineTo(cx - tile * 0.6, cy + tile * 0.08);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        priceTag(ctx, cx, cy + tile * 0.06, tile, price, affordable);
        ctx.globalAlpha = 1;
      } });
      continue;
    }
    const def = findById(data.towers.towers, tower.def, 'Turm');
    const level = towerLevel(tower, data);
    const name = `${tower.def}_${Math.min(tower.level, 2)}`;
    const width = tile * (TOWER_WIDTH[tower.def] ?? 0.8) * (tower.level >= 2 ? 1.08 : 1);
    const base = cy + tile * 0.4;
    const height = width * spriteAspect(name);
    const disabled = tower.disabledUntil !== undefined && scene.tick >= 0 && scene.tick < tower.disabledUntil;
    if (hinted || scene.targeting || def.kind === 'slow') {
      things.push({ y: cy - tile * 3, draw: () => {
        ctx.strokeStyle = scene.targeting ? COLORS.disabled : def.kind === 'slow' && !hinted ? 'rgba(20,16,12,0.45)' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = scene.targeting ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, scene.targeting ? tile * 0.6 : (level.rangeMilli / MILLI) * tile, 0, Math.PI * 2);
        ctx.stroke();
      } });
    }
    things.push({ y: cy, draw: () => {
      ctx.globalAlpha = disabled ? 0.5 : 1;
      drawSprite(ctx, name, cx, base, width);
      ctx.globalAlpha = 1;
    } });
    if (def.kind === 'militia') {
      // Miliz steht auf der Straße: zwei Posten, in der Schlacht mit Lebensbalken.
      const mPos = tower.militiaPos !== undefined ? tower.militiaPos : militiaPosition(road, slot.x, slot.y, data);
      const alive = tower.militiaHp === undefined || tower.militiaHp > 0;
      const [mx, my] = roadPointMilli(road, mPos);
      for (const off of [-0.2, 0.2]) {
        things.push({ y: px(my) + 1, draw: () => {
          ctx.globalAlpha = alive ? 1 : 0.25;
          drawSprite(ctx, 'miliz', px(mx) + off * tile, px(my) + tile * 0.28, tile * 0.42, off < 0);
          ctx.globalAlpha = 1;
        } });
      }
      if (tower.militiaHp !== undefined && tower.militiaHp > 0 && tower.militiaHp < level.militiaHp) {
        const share = tower.militiaHp / level.militiaHp;
        overlays.push(() => bar(ctx, px(mx), px(my) - tile * 0.55, tile * 0.6, share, COLORS.militia));
      }
    }
    overlays.push(() => {
      if (scene.haste && !disabled) {
        ctx.strokeStyle = COLORS.gold;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(timeMs / 70);
        ctx.beginPath();
        ctx.ellipse(cx, cy + tile * 0.12, tile * 0.46, tile * 0.27, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (disabled) {
        ctx.fillStyle = COLORS.disabled;
        ctx.beginPath();
        ctx.arc(cx, base - height * 0.75, tile * 0.16 + Math.sin(timeMs / 80) * tile * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
      const next = def.levels[tower.level];
      if (scene.buildGold !== null && next && next.keepLevel <= scene.keepLevel && scene.buildGold >= next.cost) {
        // Ausbau möglich: Pfeil nach oben, mit Preis, wenn der Hinweis darauf zeigt
        const ax = cx + tile * 0.34;
        const ay = base - height + tile * 0.1;
        ctx.fillStyle = COLORS.gold;
        ctx.strokeStyle = COLORS.back;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay - tile * 0.2);
        ctx.lineTo(ax + tile * 0.17, ay);
        ctx.lineTo(ax - tile * 0.17, ay);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (hinted) cost(ctx, cx - tile * 0.1, base - height - tile * 0.2, tile, String(next.cost));
      }
      if (tower.lastShotTick !== undefined && tower.lastShotTick >= 0 && scene.tick - tower.lastShotTick <= 3 && tower.targetX !== undefined && tower.targetY !== undefined) {
        const age = (scene.tick - tower.lastShotTick) / 4;
        ctx.globalAlpha = 1 - age;
        ctx.strokeStyle = COLORS.shot;
        ctx.lineWidth = def.splashMilli > 0 ? 4 : 2;
        if (def.kind === 'shot') {
          ctx.beginPath();
          ctx.moveTo(cx, base - height * 0.7);
          ctx.lineTo(px(tower.targetX), px(tower.targetY));
          ctx.stroke();
          if (def.splashMilli > 0) {
            ctx.beginPath();
            ctx.arc(px(tower.targetX), px(tower.targetY), (def.splashMilli / MILLI) * tile * (0.5 + age * 0.5), 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (def.kind === 'slow') {
          ctx.strokeStyle = COLORS.pitch;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(cx, cy, (level.rangeMilli / MILLI) * tile * (0.3 + age * 0.7), 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(px(tower.targetX), px(tower.targetY), tile * 0.3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    });
  }

  // Einheiten: ein Bild je Figur, die Bewegung kommt aus dem Code (Hüpfen im Laufschritt, Spiegeln, Aufblitzen bei Treffern).
  const seen = new Set<number>();
  for (const u of scene.units) {
    seen.add(u.id);
    const [ux, uy] = roadPointMilli(road, u.pos);
    const [ax] = roadPointMilli(road, u.pos + 300);
    const def = findById(data.units.units, u.def, 'Einheit');
    const vehicle = VEHICLES.has(u.def);
    let look = unitLook.get(u.id);
    if (!look) {
      look = { hp: u.hp, flashUntil: 0, flip: false };
      unitLook.set(u.id, look);
    }
    if (u.hp < look.hp) look.flashUntil = timeMs + 120;
    look.hp = u.hp;
    // Alle Figuren und Fahrzeuge blicken im Bild nach links; beim Lauf nach rechts werden sie gespiegelt,
    // beim Lauf nach oben oder unten bleibt die letzte Richtung.
    if (ax !== ux) look.flip = ax > ux;
    const state = look;
    const x = px(ux);
    const y = px(uy);
    const step = timeMs / (vehicle ? 70 : def.speedMilliPerTick > 60 ? 70 : 110) + u.id * 1.7;
    const hop = vehicle ? Math.sin(step * 2) * tile * 0.012 : Math.abs(Math.sin(step)) * tile * 0.07;
    const sprite = UNIT_SPRITE[u.def]?.sprite ?? u.def;
    const scale = UNIT_SPRITE[u.def]?.scale ?? 1;
    const width = (vehicle ? tile * 0.78 : (tile * 0.62) / spriteAspect(sprite)) * scale;
    const height = width * spriteAspect(sprite);
    things.push({ y: y + 2, draw: () => {
      // Schatten am Boden, damit das Hüpfen lesbar ist.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y + tile * 0.24, width * 0.36, tile * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y + tile * 0.26 - hop);
      if (!vehicle) ctx.rotate(Math.sin(step) * 0.06);
      drawSprite(ctx, sprite, 0, 0, width, state.flip);
      if (timeMs < state.flashUntil) {
        // Treffer: dasselbe Bild noch einmal aufhellend darüber (billiger als ein Filter).
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.7;
        drawSprite(ctx, sprite, 0, 0, width, state.flip);
      }
      ctx.restore();
    } });
    overlays.push(() => {
      if (scene.shielded && data.troops.troops.some((t) => t.unit === u.def)) {
        ctx.strokeStyle = COLORS.hint;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - height * 0.2, tile * 0.36, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (u.hp < def.hp) bar(ctx, x, y + tile * 0.26 - height - 7, tile * 0.5, u.hp / def.hp, COLORS.hp);
    });
  }
  for (const id of unitLook.keys()) if (!seen.has(id)) unitLook.delete(id);

  things.sort((a, b) => a.y - b.y);
  for (const thing of things) thing.draw();
  for (const overlay of overlays) overlay();

  drawVolley(ctx, scene, data, tile);

  // Effekte
  for (const e of scene.effects) {
    const age = (timeMs - e.start) / EFFECT_MS;
    if (age < 0 || age >= 1) continue;
    const cx = (e.x + 0.5) * tile;
    const cy = (e.y + 0.5) * tile;
    ctx.globalAlpha = 1 - age;
    if (e.kind === 'text') {
      ctx.font = `700 ${Math.round(tile * 1.2 * 0.32)}px system-ui, sans-serif`;
      const half = ctx.measureText(e.text).width / 2 + 4;
      const tx = Math.max(half, Math.min(cols * tile - half, cx));
      const ty = cy - tile * (0.5 + age * 0.8);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20,16,12,0.8)';
      ctx.strokeText(e.text, tx, ty);
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(e.text, tx, ty);
    } else if (e.kind === 'deny') {
      ctx.strokeStyle = COLORS.deny;
      ctx.lineWidth = 3;
      const shake = Math.sin(age * 40) * tile * 0.08 * (1 - age);
      ctx.strokeRect(cx - tile * 0.4 + shake, cy - tile * 0.4, tile * 0.8, tile * 0.8);
    } else {
      ctx.strokeStyle = COLORS.hint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, tile * (0.4 + age * 2), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (scene.hint) pointer(ctx, (scene.hint.x + 0.5) * tile, (scene.hint.y + 0.5) * tile, tile, timeMs);
}
