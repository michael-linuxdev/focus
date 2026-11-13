import { MILLI, findById, roadPointMilli, type BattleState, type GameData } from '../sim/index.ts';

/** Platzhalter-Darstellung aus einfachen Formen. Liest den Zustand, ändert ihn nie. */
const COLORS = {
  ground: '#2c4030',
  grid: '#314836',
  road: '#b79a63',
  gate: '#7a5a3a',
  keep: '#d8d2c0',
  unit: '#b3372f',
} as const;

export function drawStage(canvas: HTMLCanvasElement, state: BattleState, data: GameData): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { cols, rows } = data.roads.grid;
  const top = 56;
  const bottom = 96;
  const tile = Math.min(w / cols, (h - top - bottom) / rows);
  const ox = (w - tile * cols) / 2;
  const oy = top + (h - top - bottom - tile * rows) / 2;
  const px = (milli: number): number => (milli / MILLI + 0.5) * tile;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1d2a1f';
  ctx.fillRect(0, 0, w, h);
  ctx.translate(ox, oy);
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, 0, tile * cols, tile * rows);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < cols; c++) { ctx.moveTo(c * tile, 0); ctx.lineTo(c * tile, rows * tile); }
  for (let r = 1; r < rows; r++) { ctx.moveTo(0, r * tile); ctx.lineTo(cols * tile, r * tile); }
  ctx.stroke();

  const road = findById(data.roads.roads, state.setup.roadId, 'Straße');
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
  ctx.fillRect(px(gx) - tile * 0.5, px(gy) - tile * 0.35, tile, tile * 0.3);
  const [kx, ky] = roadPointMilli(road, state.roadLength);
  ctx.fillStyle = COLORS.keep;
  ctx.fillRect(px(kx) - tile * 0.45, px(ky) - tile * 0.45, tile * 0.9, tile * 0.9);

  ctx.fillStyle = COLORS.unit;
  for (const u of state.units) {
    const [x, y] = roadPointMilli(road, u.pos);
    ctx.beginPath();
    ctx.arc(px(x), px(y), tile * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
