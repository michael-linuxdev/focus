import { describe, expect, it } from 'vitest';
import { GATE_KEY, GATE_SKIP_HOURS, GUIDE_IDS, detectPlatform, gateDue, guideId, installStepKeys, skipGate, type GateStore, type Platform } from '../../src/app/install.ts';
import { t } from '../../src/app/texts.ts';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  whatsapp: 'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 WhatsApp/2.24',
  desktopEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  desktopFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
};
const detect = (userAgent: string, platform = '', maxTouchPoints = 0): Platform => detectPlatform({ userAgent, platform, maxTouchPoints, standalone: false });

function memory(initial: Record<string, string> = {}): GateStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

describe('Installationshinweis', () => {
  it('erkennt Gerät und Browser und wählt die passende Anleitung', () => {
    expect(guideId(detect(UA.iphoneSafari))).toBe('ios_safari');
    expect(guideId(detect(UA.iphoneChrome))).toBe('ios_chrome');
    expect(guideId(detect(UA.ipad, 'MacIntel', 5))).toBe('ios_safari'); // iPadOS meldet sich als Mac
    expect(guideId(detect(UA.ipad, 'MacIntel', 0))).toBe('desktop_safari');
    expect(guideId(detect(UA.androidChrome))).toBe('android_chrome');
    expect(guideId(detect(UA.samsung))).toBe('android_samsung');
    expect(guideId(detect(UA.androidFirefox))).toBe('android_firefox');
    expect(guideId(detect(UA.whatsapp))).toBe('inapp'); // aus einem Messenger heraus lässt sich nichts installieren
    expect(guideId(detect(UA.desktopEdge))).toBe('desktop_edge');
    expect(guideId(detect(UA.desktopFirefox))).toBe('desktop_other');
  });

  it('jede Anleitung hat ihre Schritte als Text', () => {
    for (const id of GUIDE_IDS) {
      const [os, browser] = id === 'inapp' ? ['android', 'inapp'] : id.split('_');
      const keys = installStepKeys({ os, browser } as Platform);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) expect(t(key), key).not.toContain('⟦');
      expect(t(`${keys[0]!.slice(0, -1)}${keys.length + 1}`)).toContain('⟦'); // kein vergessener weiterer Schritt
    }
    for (const os of ['ios', 'android', 'desktop']) expect(t(`install.os.${os}`)).not.toContain('⟦');
    for (const b of ['safari', 'chrome', 'firefox', 'edge', 'samsung', 'opera', 'inapp', 'other']) expect(t(`install.browser.${b}`)).not.toContain('⟦');
  });

  it('erscheint im Handy-Browser bei jedem Besuch, nach „ohne Installation weiter" erst wieder nach einigen Stunden', () => {
    const phone = detect(UA.androidChrome);
    const store = memory();
    const now = 1_700_000_000_000;
    expect(gateDue(phone, store, now)).toBe(true);
    skipGate(store, now);
    expect(store.map.has(GATE_KEY)).toBe(true);
    expect(gateDue(phone, store, now + 60_000)).toBe(false);
    expect(gateDue(phone, store, now + GATE_SKIP_HOURS * 3_600_000 - 1)).toBe(false);
    expect(gateDue(phone, store, now + GATE_SKIP_HOURS * 3_600_000)).toBe(true);
  });

  it('erscheint nie in der installierten App und am Computer nur einmal', () => {
    const now = 1_700_000_000_000;
    expect(gateDue({ ...detect(UA.iphoneSafari), standalone: true }, memory(), now)).toBe(false);
    const desk = detect(UA.desktopEdge);
    const store = memory();
    expect(gateDue(desk, store, now)).toBe(true);
    skipGate(store, now);
    expect(gateDue(desk, store, now + 365 * 86_400_000)).toBe(false);
  });

  it('ein gesperrter Speicher hält das Spiel nicht auf', () => {
    const locked: GateStore = { getItem: () => { throw new Error('gesperrt'); }, setItem: () => { throw new Error('gesperrt'); } };
    expect(gateDue(detect(UA.androidChrome), locked, 1)).toBe(false);
    expect(() => skipGate(locked, 1)).not.toThrow();
  });
});
