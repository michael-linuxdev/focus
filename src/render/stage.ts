import {
  MILLI, findById, marketMilli, roadLengthMilli, roadPointMilli, towerLevel,
  type BattleTower, type Building, type CityTower, type GameData, type RoadDef, type Unit,
} from '../sim/index.ts';

/** Platzhalter-Darstellung aus einfachen Formen. Liest den Zustand, ändert ihn nie. */
const COLORS = {
  back: '#1d2a1f', ground: '#2c4030', grid: '#314836', road: '#b79a63',
  gate: '#7a5a3a', gateBroken: '#4a3a2a', keep: '#d8d2c0', market: '#d9a441',
  robber: '#b3372f', troop: '#4f8fd6', ram: '#8a6a45',
  hpBack: '#3a1512', hp: '#e9c46a', bar: '#c2553f',
  slot: '#8fa58f', plot: '#7f93a8', tower: '#cfc8b4', roof: '#4b6a8a', roofEnemy: '#9a3d36', catapult: '#6b4f2e',
  shot: '#f4e3a1', gold: '#e9b949', deny: '#e2574c', hint: '#ffffff', hero: '#c084fc', building: '#a7b8c9', disabled: '#ff8a3d',
} as const;

/** Platz für die Leisten oben und unten (CSS-Pixel). */
const TOP = 56;
const BOTTOM = 104;

export interface Layout {
  readonly tile: number;
  readonly ox: number;
  readonly oy: number;
}

export function computeLayout(width: number, height: number, data: GameData): Layout {
  const { cols, rows } = data.roads.grid;
  const tile = Math.min(width / cols, (height - TOP - BOTTOM) / rows);
  return { tile, ox: (width - tile * cols) / 2, oy: TOP + (height - TOP - BOTTOM - tile * rows) / 2 };
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
  /** Gebäude und Uhrzeit im Stadtbau; `null` blendet die Bauplätze abseits der Straße aus. */
  readonly buildings: { readonly list: readonly Building[]; readonly now: number; readonly showEmpty: boolean; readonly labels: Readonly<Record<string, string>> } | null;
  readonly gate: { readonly hp: number; readonly max: number } | null;
  readonly showMarket: boolean;
  readonly keep: { readonly hp: number; readonly max: number } | null;
  /** Restsekunden des Burgfried-Ausbaus. */
  readonly keepBusySeconds: number | null;
  readonly heroSection: string | null;
  readonly enemyCity: boolean;
  /** Der Spieler wählt gerade einen Turm als Ziel. */
  readonly targeting: boolean;
  readonly shielded: boolean;
  /** Kachel, auf die der Tutorial-Hinweis zeigt. */
  readonly hint: { readonly x: number; readonly y: number; readonly cost: string | null } | null;
  readonly effects: readonly Effect[];
  readonly timeMs: number;
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
  const layout = computeLayout(w, h, data);
  const ctx = canvas.getContext('2d');
  if (!ctx) return layout;
  const { cols, rows } = data.roads.grid;
  const { tile } = layout;
  const px = (milli: number): number => (milli / MILLI + 0.5) * tile;
  const road = findById(data.roads.roads, scene.roadId, 'Straße');
  const length = roadLengthMilli(road);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  if (scene.keepBusySeconds !== null) label(ctx, px(kx), px(ky) - tile * 0.75, tile, `${scene.keepBusySeconds}s`, COLORS.hint);

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
      if (remaining > 0) label(ctx, cx, cy - tile * 0.62, tile, `${remaining}s`, COLORS.hint);
    }
  }

  // Turm-Bauplätze und Türme
  const cheapest = Math.min(...data.towers.towers.filter((t) => t.keepLevel <= scene.keepLevel).map((t) => t.levels[0]!.cost));
  for (const slot of data.city.towerSlots) {
    const cx = (slot.x + 0.5) * tile;
    const cy = (slot.y + 0.5) * tile;
    const tower = scene.towers.find((t) => t.slot === slot.id);
    const hinted = scene.hint !== null && scene.hint.x === slot.x && scene.hint.y === slot.y;
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
    if (def.splashMilli > 0) {
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
    if (scene.buildGold !== null && next && scene.buildGold >= next.cost) {
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
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px(tower.targetX), px(tower.targetY));
      ctx.stroke();
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
      label(ctx, cx, cy - tile * (0.3 + age * 0.7), tile * 1.2, e.text, COLORS.gold);
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

function bar(ctx: CanvasRenderingContext2D, cx: number, y: number, width: number, share: number, color: string): void {
  ctx.fillStyle = COLORS.hpBack;
  ctx.fillRect(cx - width / 2, y, width, 4);
  ctx.fillStyle = color;
  ctx.fillRect(cx - width / 2, y, width * Math.max(0, Math.min(1, share)), 4);
}

function label(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, text: string, color: string): void {
  ctx.font = `600 ${Math.round(tile * 0.32)}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(text, cx, cy);
}

function cost(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, text: string): void {
  ctx.font = `600 ${Math.round(tile * 0.3)}px system-ui, sans-serif`;
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.arc(cx - tile * 0.2, cy, tile * 0.1, 0, Math.PI * 2);
  ctx.fill();
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
