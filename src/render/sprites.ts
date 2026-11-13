import atlasInfo from './atlas.json';

/**
 * Bilder des Spiels: ein Atlas mit allen Motiven (erzeugt von `scripts/sprites.py`) und drei Bodenkacheln.
 * Solange sie nicht geladen sind, zeichnet die Darstellung die einfachen Formen; das Spiel wartet nie auf Bilder.
 */
type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
const atlasRects: Readonly<Record<string, Rect>> = atlasInfo.sprites;

/** Lage eines Motivs im Atlas und Größe des Atlas, für Symbole in der Oberfläche (CSS-Hintergrund). */
export function atlasSprite(name: string): { rect: Rect; size: readonly number[]; url: string } | null {
  const rect = atlasRects[name];
  return rect ? { rect, size: atlasInfo.size, url: `${import.meta.env.BASE_URL}sprites/atlas.webp` } : null;
}

/**
 * Name des Motivs für eine Stufe: `<name>_<n>` mit der höchsten vorhandenen Stufe bis `level`, sonst `fallback`.
 * So greift ein neues Bild (etwa `bogenturm_4` oder `burgfried_5`), sobald es im Atlas liegt, und ohne es bleibt das bisherige.
 */
export function levelSprite(name: string, level: number, fallback: string): string {
  for (let n = level; n >= 1; n--) if (atlasRects[`${name}_${n}`]) return `${name}_${n}`;
  return fallback;
}

/** Einheiten ohne eigenes Bild leihen sich eines und unterscheiden sich in der Größe. PLATZHALTER, bis es Bilder gibt. */
const UNIT_ALIAS: Readonly<Record<string, { sprite: string; scale: number }>> = {
  laeufer: { sprite: 'raeuber', scale: 0.8 }, ritter: { sprite: 'schildtraeger', scale: 1.25 }, hauptmann: { sprite: 'schildtraeger', scale: 1.8 },
};
/** Größe gegenüber einer gewöhnlichen Figur, wenn die Einheit ihr eigenes Bild hat. */
const UNIT_SCALE: Readonly<Record<string, number>> = { laeufer: 0.85, ritter: 1.15, hauptmann: 1.6 };

/** Bild und Größe einer Einheit: das eigene, wenn es im Atlas liegt, sonst das geliehene. */
export function unitSprite(unit: string): { readonly sprite: string; readonly scale: number } {
  if (atlasRects[unit]) return { sprite: unit, scale: UNIT_SCALE[unit] ?? 1 };
  return UNIT_ALIAS[unit] ?? { sprite: unit, scale: 1 };
}

/** Bilder, die fertig dekodiert sind. Erst dann lassen sie sich in jedem Browser sicher in eine Zeichenfläche kopieren. */
const decoded = new Set<HTMLImageElement>();

function load(file: string): HTMLImageElement {
  const img = new Image();
  img.src = `${import.meta.env.BASE_URL}sprites/${file}`;
  // Safari meldet ein Bild als geladen, bevor es dekodiert ist; ein Kopieren in diesem Moment bleibt leer.
  const done = (): void => void decoded.add(img);
  if (typeof img.decode === 'function') img.decode().then(done, () => img.addEventListener('load', done, { once: true }));
  else img.addEventListener('load', done, { once: true });
  return img;
}

const atlas = load('atlas.webp');
const grounds = { wiese: load('boden-wiese.jpg'), strasse: load('boden-strasse.jpg'), lager: load('boden-lager.jpg') } as const;
export type GroundName = keyof typeof grounds;

const loaded = (img: HTMLImageElement): boolean => decoded.has(img) && img.complete && img.naturalWidth > 0;

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
    if (scaled.size > 240) {
      // Safari gibt den Speicher einer Zeichenfläche erst frei, wenn sie auf Größe 0 gesetzt wird.
      for (const old of scaled.values()) old.width = old.height = 0;
      scaled.clear();
    }
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
      // Sicherung: Blieb die Kopie leer (Bild im Browser noch nicht bereit), wird sie nicht vorgehalten,
      // sondern beim nächsten Bild neu versucht. Sonst bliebe das Motiv dauerhaft unsichtbar.
      const mid = c.getImageData(0, Math.floor(canvas.height / 2), w, 1).data;
      let filled = false;
      for (let i = 3; i < mid.length; i += 4) {
        if (mid[i] !== 0) {
          filled = true;
          break;
        }
      }
      if (!filled) return canvas;
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
