// Leistungsmessung im Browser in Handygröße mit gedrosselter CPU (Faktor 4, grobe Näherung an ein
// Android-Mittelklassegerät) und langsamem Netz. Misst:
//   1. Zeit vom Seitenaufruf bis zur ersten spielbaren Welle, ohne Zwischenspeicher
//   2. Bildzeiten in der ersten Welle und in einer großen Welle spät im Spiel
// Aufruf: npm run build && npm run perf
const { chromium, devices } = require('playwright');
const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');

const PORT = 4176;
const BASE = `http://localhost:${PORT}/`;

async function frames(page, ms) {
  return page.evaluate((duration) => new Promise((resolve) => {
    const deltas = [];
    let last = performance.now();
    const end = last + duration;
    const tick = (now) => {
      deltas.push(now - last);
      last = now;
      if (now < end) requestAnimationFrame(tick); else resolve(deltas);
    };
    requestAnimationFrame(tick);
  }), ms);
}

function report(name, deltas) {
  const sorted = [...deltas].sort((a, b) => a - b);
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const slow = deltas.filter((d) => d > 34).length;
  console.log(`${name}: Ø ${avg.toFixed(1)} ms (${(1000 / avg).toFixed(0)} Bilder/s), 95 % unter ${p95.toFixed(1)} ms, längstes ${sorted[sorted.length - 1].toFixed(0)} ms, ${slow} von ${deltas.length} Bildern über 34 ms`);
  return { avg, p95 };
}

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  const browser = await chromium.launch();
  let failed = false;
  try {
    const context = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
    const page = await context.newPage();
    for (let i = 0; ; i++) {
      try { await page.goto(BASE); break; } catch (e) { if (i > 40) throw e; await new Promise((r) => setTimeout(r, 250)); }
    }
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    // "Gute Verbindung" großzügig schlecht gerechnet: 1,6 Mbit/s herunter, 150 ms Laufzeit.
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

    // 1. Ladezeit bis zur ersten spielbaren Welle
    const loads = [];
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => localStorage.clear());
      await page.goto('about:blank');
      const t0 = Date.now();
      await page.goto(BASE, { waitUntil: 'commit' });
      await page.waitForFunction(() => window.__mk?.state().screen === 'battle' && window.__mk.pos('slot', 's1') !== null, null, { polling: 'raf' });
      loads.push(Date.now() - t0);
    }
    console.log(`Bis zur ersten spielbaren Welle (CPU ×4 gedrosselt, 1,6 Mbit/s, 150 ms, ohne Zwischenspeicher): ${loads.join(' / ')} ms`);
    if (Math.max(...loads) > 3000) failed = true;

    // 2a. Bildzeiten in der ersten Welle
    const p = await page.evaluate(() => window.__mk.pos('slot', 's1'));
    await page.touchscreen.tap(p.x, p.y);
    const first = report('Erste Welle', await frames(page, 6000));

    // 2b. Große Welle spät im Spiel: Stand vom Hinweis-Bot einspielen
    const save = execFileSync('node', [path.join(__dirname, '..', '..', 'scripts', 'make-save.ts')], { encoding: 'utf8' });
    await context.addInitScript((text) => {
      if (sessionStorage.getItem('perf')) return;
      sessionStorage.setItem('perf', '1');
      localStorage.setItem('mk.save', text);
    }, save);
    await page.reload();
    await page.waitForFunction(() => window.__mk?.state().screen === 'city');
    const st = await page.evaluate(() => window.__mk.state());
    if (st.sheet !== null || (await page.getByTestId('raid-ok').count()) > 0) await page.getByTestId('raid-ok').tap({ force: true }).catch(() => undefined);
    await page.getByTestId('defend').tap({ force: true });
    await page.waitForFunction(() => window.__mk.state().screen === 'battle');
    await page.waitForTimeout(3000);
    const units = await page.evaluate(() => window.__mk.state().battle.units.length);
    const towers = await page.evaluate(() => window.__mk.state().battle.towers.length);
    const late = report(`Große Welle (${towers} Türme, ${units} Einheiten zu Beginn der Messung)`, await frames(page, 12000));
    if (first.p95 > 34 || late.p95 > 34) failed = true;
    console.log(failed ? 'ZIEL VERFEHLT (Ladezeit über 3 s oder 95 % der Bilder langsamer als 30 Bilder/s)' : 'Ziel erreicht: unter 3 s bis zur ersten Welle, 95 % der Bilder schneller als 30 Bilder/s');
  } finally {
    await browser.close();
    server.kill();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
