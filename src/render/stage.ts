import { MILLI, findById, roadPointMilli, towerLevel, type BattleState, type GameData, type RoadDef } from '../sim/index.ts';

/** Platzhalter-Darstellung aus einfachen Formen. Liest den Zustand, ändert ihn nie. */
const COLORS = {
  back: '#1d2a1f',
  ground: '#2c4030',
  grid: '#314836',
  road: '#b79a63',
  gate: '#7a5a3a',
  keep: '#d8d2c0',
  keepHurt: '#c2553f',
  unit: '#b3372f',
  hpBack: '#3a1512',
  hp: '#e9c46a',
  slot: '#8fa58f',
  tower: '#cfc8b4',
  towerRoof: '#4b6a8a',
  shot: '#f4e3a1',
  gold: '#e9b949',
  deny: '#e2574c',
  hint: '#ffffff',
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

/** Der Bauplatz unter einem Tipp. Die Tippfläche ist die ganze Kachel plus Rand, mindestens 44 px. */
export function slotAt(layout: Layout, road: RoadDef, px: number, py: number): string | null {
  const reach = Math.max(layout.tile * 0.7, 26);
  let best: string | null = null;
  let bestDist = reach * reach;
  for (const slot of road.towerSlots) {
    const c = tileCenter(layout, slot.x, slot.y);
    const d = (c.x - px) ** 2 + (c.y - py) ** 2;
    if (d <= bestDist) {
      best = slot.id;
      bestDist = d;
    }
  }
  return best;
}

/** Kurzlebige Effekte, die nur die Darstellung kennt (Zeit in ms, Ort in Kacheln). */
export interface Effect {
  readonly kind: 'gold' | 'deny' | 'built';
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly start: number;
}
const EFFECT_MS = 900;

export interface Scene {
  readonly battle: BattleState;
  /** Bauplatz, auf den der Tutorial-Hinweis zeigt. */
  readonly hintSlot: string | null;
  readonly effects: readonly Effect[];
  readonly timeMs: number;
}

export function drawStage(canvas: HTMLCanvasElement, scene: Scene, data: GameData): Layout {
  const { battle, timeMs } = scene;
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

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = COLORS.back;
  ctx.fillRect(0, 0, w, h);
  ctx.translate(layout.ox, layout.oy);
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, 0, tile * cols, tile * rows);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < cols; c++) { ctx.moveTo(c * tile, 0); ctx.lineTo(c * tile, rows * tile); }
  for (let r = 1; r < rows; r++) { ctx.moveTo(0, r * tile); ctx.lineTo(cols * tile, r * tile); }
  ctx.stroke();

  // Straße, Torhaus, Burgfried
  const road = findById(data.roads.roads, battle.setup.roadId, 'Straße');
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
  const [gx, gy] = roadPointMilli(road, 0);
  ctx.fillStyle = COLORS.gate;
  ctx.fillRect(px(gx) - tile * 0.5, px(gy) - tile * 0.4, tile, tile * 0.3);
  const [kx, ky] = roadPointMilli(road, battle.roadLength);
  ctx.fillStyle = COLORS.keep;
  ctx.fillRect(px(kx) - tile * 0.45, px(ky) - tile * 0.45, tile * 0.9, tile * 0.9);
  if (!battle.setup.unlosable) {
    ctx.fillStyle = COLORS.hpBack;
    ctx.fillRect(px(kx) - tile * 0.45, px(ky) + tile * 0.32, tile * 0.9, tile * 0.1);
    ctx.fillStyle = COLORS.keepHurt;
    ctx.fillRect(px(kx) - tile * 0.45, px(ky) + tile * 0.32, (tile * 0.9 * battle.keepHp) / battle.setup.keepHp, tile * 0.1);
  }

  // Bauplätze und Türme
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const slot of road.towerSlots) {
    const cx = (slot.x + 0.5) * tile;
    const cy = (slot.y + 0.5) * tile;
    const tower = battle.towers.find((t) => t.slot === slot.id);
    const hinted = scene.hintSlot === slot.id;
    if (!tower) {
      const cost = data.towers.towers[0]?.levels[0]?.cost ?? 0;
      const affordable = battle.gold >= cost;
      // Solange ein Hinweis auf einen Bauplatz zeigt, treten die anderen zurück.
      ctx.globalAlpha = !affordable || (scene.hintSlot !== null && !hinted) ? 0.35 : 1;
      ctx.setLineDash([tile * 0.14, tile * 0.1]);
      ctx.strokeStyle = COLORS.slot;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - tile * 0.38, cy - tile * 0.38, tile * 0.76, tile * 0.76);
      ctx.setLineDash([]);
      drawCost(ctx, cx, cy, tile, cost);
      ctx.globalAlpha = 1;
    } else {
      const level = towerLevel(tower, data);
      if (hinted) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, (level.rangeMilli / MILLI) * tile, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = COLORS.tower;
      ctx.fillRect(cx - tile * 0.32, cy - tile * 0.32, tile * 0.64, tile * 0.64);
      ctx.fillStyle = COLORS.towerRoof;
      ctx.beginPath();
      ctx.moveTo(cx, cy - tile * 0.22);
      ctx.lineTo(cx + tile * 0.2, cy + tile * 0.12);
      ctx.lineTo(cx - tile * 0.2, cy + tile * 0.12);
      ctx.fill();
      for (let i = 0; i < tower.level; i++) {
        ctx.fillStyle = COLORS.gold;
        ctx.fillRect(cx - tile * 0.28 + i * tile * 0.16, cy + tile * 0.2, tile * 0.1, tile * 0.08);
      }
      const next = findById(data.towers.towers, tower.def, 'Turm').levels[tower.level];
      if (next && battle.gold >= next.cost && battle.result === 'running') {
        // Ausbau möglich: Pfeil nach oben mit Preis
        ctx.fillStyle = COLORS.gold;
        ctx.beginPath();
        ctx.moveTo(cx + tile * 0.3, cy - tile * 0.5);
        ctx.lineTo(cx + tile * 0.46, cy - tile * 0.3);
        ctx.lineTo(cx + tile * 0.14, cy - tile * 0.3);
        ctx.fill();
        if (hinted) drawCost(ctx, cx - tile * 0.25, cy - tile * 0.62, tile, next.cost);
      }
      if (tower.lastShotTick >= 0 && battle.tick - tower.lastShotTick <= 3) {
        ctx.strokeStyle = COLORS.shot;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1 - (battle.tick - tower.lastShotTick) / 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px(tower.targetX), px(tower.targetY));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // Einheiten
  for (const u of battle.units) {
    const [x, y] = roadPointMilli(road, u.pos);
    const maxHp = findById(data.units.units, u.def, 'Einheit').hp;
    ctx.fillStyle = COLORS.unit;
    ctx.beginPath();
    ctx.arc(px(x), px(y), tile * 0.2, 0, Math.PI * 2);
    ctx.fill();
    if (u.hp < maxHp) {
      ctx.fillStyle = COLORS.hpBack;
      ctx.fillRect(px(x) - tile * 0.25, px(y) - tile * 0.38, tile * 0.5, tile * 0.08);
      ctx.fillStyle = COLORS.hp;
      ctx.fillRect(px(x) - tile * 0.25, px(y) - tile * 0.38, (tile * 0.5 * u.hp) / maxHp, tile * 0.08);
    }
  }

  // Effekte
  ctx.font = `600 ${Math.round(tile * 0.36)}px system-ui, sans-serif`;
  for (const e of scene.effects) {
    const age = (timeMs - e.start) / EFFECT_MS;
    if (age < 0 || age >= 1) continue;
    const cx = (e.x + 0.5) * tile;
    const cy = (e.y + 0.5) * tile;
    ctx.globalAlpha = 1 - age;
    if (e.kind === 'gold') {
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(e.text, cx, cy - tile * (0.3 + age * 0.7));
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

  // Hinweis: pulsierender Ring und tippender Finger
  if (scene.hintSlot !== null) {
    const slot = road.towerSlots.find((s) => s.id === scene.hintSlot);
    if (slot) drawPointer(ctx, (slot.x + 0.5) * tile, (slot.y + 0.5) * tile, tile, timeMs);
  }
  return layout;
}

function drawCost(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, cost: number): void {
  ctx.font = `600 ${Math.round(tile * 0.3)}px system-ui, sans-serif`;
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.arc(cx - tile * 0.2, cy, tile * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText(String(cost), cx + tile * 0.1, cy + 1);
}

function drawPointer(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number, timeMs: number): void {
  const phase = (timeMs % 1000) / 1000;
  const press = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  ctx.strokeStyle = COLORS.hint;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 1 - phase;
  ctx.beginPath();
  ctx.arc(cx, cy, tile * (0.35 + phase * 0.45), 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Finger: kommt von unten rechts und tippt auf die Mitte.
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
