import rects from './atlas.json';

/**
 * Bilder des Spiels: ein Atlas mit allen Motiven (erzeugt von `scripts/sprites.py`) und drei Bodenkacheln.
 * Solange sie nicht geladen sind, zeichnet die Darstellung die einfachen Formen; das Spiel wartet nie auf Bilder.
 */
type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
const atlasRects: Readonly<Record<string, Rect>> = rects;

function load(file: string): HTMLImageElement {
  const img = new Image();
  img.decoding = 'async';
  img.src = `${import.meta.env.BASE_URL}sprites/${file}`;
  return img;
}

const atlas = load('atlas.webp');
const grounds = { wiese: load('boden-wiese.jpg'), strasse: load('boden-strasse.jpg'), lager: load('boden-lager.jpg') } as const;
export type GroundName = keyof typeof grounds;

const loaded = (img: HTMLImageElement): boolean => img.complete && img.naturalWidth > 0;

export function spritesReady(): boolean {
  return loaded(atlas) && loaded(grounds.wiese) && loaded(grounds.strasse) && loaded(grounds.lager);
}

export function spriteAspect(name: string): number {
  const r = atlasRects[name];
  return r ? r.h / r.w : 1;
}

/** Gerätepixel je CSS-Pixel der Zeichenfläche; die Darstellung setzt den Wert vor jedem Bild. */
let pixelRatio = 1;
export function setPixelRatio(ratio: number): void {
  pixelRatio = ratio;
}

/** Motive in ihrer Zielgröße, damit nicht in jedem Bild neu aus dem Atlas skaliert wird. */
const scaled = new Map<string, HTMLCanvasElement>();

function scaledSprite(name: string, r: Rect, width: number, flip: boolean): HTMLCanvasElement {
  const w = Math.max(1, Math.round(width * pixelRatio));
  const key = `${name}:${w}:${flip ? 1 : 0}`;
  let canvas = scaled.get(key);
  if (!canvas) {
    if (scaled.size > 240) scaled.clear();
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = Math.max(1, Math.round((w * r.h) / r.w));
    const c = canvas.getContext('2d');
    if (c) {
      c.imageSmoothingQuality = 'high';
      if (flip) {
        c.translate(w, 0);
        c.scale(-1, 1);
      }
      c.drawImage(atlas, r.x, r.y, r.w, r.h, 0, 0, w, canvas.height);
    }
    scaled.set(key, canvas);
  }
  return canvas;
}

/**
 * Zeichnet ein Motiv mit der Unterkante auf `baseY`, waagerecht mittig auf `cx`, in der Breite `width`.
 * Liefert die gezeichnete Höhe (0, wenn es das Motiv nicht gibt).
 */
export function drawSprite(ctx: CanvasRenderingContext2D, name: string, cx: number, baseY: number, width: number, flip = false): number {
  const r = atlasRects[name];
  if (!r) return 0;
  const height = (width * r.h) / r.w;
  ctx.drawImage(scaledSprite(name, r, width, flip), cx - width / 2, baseY - height, width, height);
  return height;
}

const patterns = new Map<string, CanvasPattern>();

/** Füllmuster einer Bodenkachel; eine Kachel des Bildes bedeckt `sizePx` Pixel. */
export function groundPattern(ctx: CanvasRenderingContext2D, name: GroundName, sizePx: number): CanvasPattern | null {
  const key = `${name}:${Math.round(sizePx)}`;
  let pattern = patterns.get(key) ?? null;
  if (!pattern) {
    pattern = ctx.createPattern(grounds[name], 'repeat');
    if (!pattern) return null;
    pattern.setTransform(new DOMMatrix().scale(sizePx / grounds[name].naturalWidth));
    if (patterns.size > 12) patterns.clear();
    patterns.set(key, pattern);
  }
  return pattern;
}
