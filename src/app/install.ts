/**
 * Installationshinweis: erkennt Gerät und Browser und liefert die passenden Schritte, um die App
 * auf den Startbildschirm zu legen. Reine Funktionen ohne Browser-Zugriff; die Hülle reicht
 * Kennung und Speicher hinein. Die Texte liegen in `data/texts.de.json` unter `install.*`.
 */
export type Os = 'ios' | 'android' | 'desktop';
export type Browser = 'safari' | 'chrome' | 'firefox' | 'edge' | 'samsung' | 'opera' | 'inapp' | 'other';

export interface Platform {
  readonly os: Os;
  readonly browser: Browser;
  /** Läuft bereits als installierte App (ohne Adresszeile). */
  readonly standalone: boolean;
}

export interface PlatformInput {
  readonly userAgent: string;
  readonly platform: string;
  readonly maxTouchPoints: number;
  readonly standalone: boolean;
}

export function detectPlatform(input: PlatformInput): Platform {
  const ua = input.userAgent;
  // iPadOS meldet sich als Mac; die Berührungspunkte verraten das Tablet.
  const ios = /iPhone|iPad|iPod/.test(ua) || (input.platform === 'MacIntel' && input.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const inapp = /Instagram|FBAN|FBAV|Line\/|Telegram|WhatsApp|TikTok|; wv\)/i.test(ua);
  let browser: Browser = 'other';
  if (inapp) browser = 'inapp';
  else if (ios) browser = /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge' : /Safari/.test(ua) ? 'safari' : 'other';
  else if (android) browser = /SamsungBrowser/.test(ua) ? 'samsung' : /Firefox/.test(ua) ? 'firefox' : /EdgA/.test(ua) ? 'edge' : /OPR|Opera/.test(ua) ? 'opera' : /Chrome/.test(ua) ? 'chrome' : 'other';
  else browser = /Edg\//.test(ua) ? 'edge' : /Chrome/.test(ua) ? 'chrome' : /Firefox/.test(ua) ? 'firefox' : /Safari/.test(ua) ? 'safari' : 'other';
  return { os: ios ? 'ios' : android ? 'android' : 'desktop', browser, standalone: input.standalone };
}

/** Anzahl der Schritte je Anleitung; die Texte heißen `install.steps.<anleitung>.<n>`. */
const STEP_COUNT: Readonly<Record<string, number>> = {
  'ios_safari': 3, 'ios_chrome': 3, 'ios_firefox': 3, 'ios_edge': 3, 'ios_other': 2,
  'android_chrome': 3, 'android_samsung': 3, 'android_firefox': 3, 'android_edge': 3, 'android_opera': 3, 'android_other': 2,
  'inapp': 3,
  'desktop_chrome': 3, 'desktop_edge': 2, 'desktop_safari': 1, 'desktop_other': 1,
};

/** Kennung der passenden Anleitung, z. B. `ios_safari`. */
export function guideId(p: Pick<Platform, 'os' | 'browser'>): string {
  if (p.browser === 'inapp') return 'inapp';
  const exact = `${p.os}_${p.browser}`;
  return exact in STEP_COUNT ? exact : `${p.os}_other`;
}

/** Textschlüssel der Schritte in ihrer Reihenfolge. */
export function installStepKeys(p: Pick<Platform, 'os' | 'browser'>): string[] {
  const id = guideId(p);
  return Array.from({ length: STEP_COUNT[id] ?? 0 }, (_, i) => `install.steps.${id}.${i + 1}`);
}

export const GUIDE_IDS: readonly string[] = Object.keys(STEP_COUNT);

/** So lange gilt „ohne Installation weiter" auf Handy und Tablet; danach erscheint der Hinweis wieder. */
export const GATE_SKIP_HOURS = 6;
export const GATE_KEY = 'mk.gate';

export interface GateStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Soll der Vollbild-Hinweis jetzt erscheinen? Installiert: nie. Handy und Tablet: bei jedem Besuch,
 * außer in den Stunden nach „ohne Installation weiter". Computer: einmal.
 */
export function gateDue(p: Platform, store: GateStore, nowMs: number): boolean {
  if (p.standalone) return false;
  let skippedAt = 0;
  try {
    skippedAt = Number(store.getItem(GATE_KEY) ?? 0) || 0;
  } catch {
    return false;
  }
  if (skippedAt === 0) return true;
  if (p.os === 'desktop') return false;
  return nowMs - skippedAt >= GATE_SKIP_HOURS * 3_600_000;
}

export function skipGate(store: GateStore, nowMs: number): void {
  try {
    store.setItem(GATE_KEY, String(nowMs));
  } catch {
    // Speicher gesperrt: Der Hinweis erscheint beim nächsten Besuch wieder.
  }
}
