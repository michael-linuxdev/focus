// Prüft den gebauten Stand im Browser in Handygröße: Start ohne Menü, Welle läuft,
// Speicherstand überlebt Neuladen, App ist installierbar (Manifest + Service Worker) und läuft offline.
// Aufruf: npm run build && npm run test:e2e
const { chromium, devices } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');

const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    for (let i = 0; ; i++) {
      try { await page.goto(BASE); break; } catch (e) { if (i > 40) throw e; await new Promise((r) => setTimeout(r, 250)); }
    }

    const t0 = Date.now();
    const button = page.getByTestId('primary');
    await button.waitFor();
    console.log(`Spielbar nach ${Date.now() - t0} ms`);
    const box = await button.boundingBox();
    assert.ok(box && box.height >= 44, 'Tippfläche mindestens 44 px');
    assert.equal(await page.getByTestId('title').textContent(), 'Mittelalter-Königreich');
    assert.equal(await page.title(), 'Mittelalter-Königreich');

    await button.tap();
    await page.waitForFunction(() => /Tick [1-9]\d/.test(document.querySelector('[data-testid=debug]')?.textContent ?? ''));
    await page.screenshot({ path: process.env.SHOT ?? 'test-results/m0.png' });
    await page.waitForFunction(() => document.querySelector('[data-testid=status]')?.textContent?.includes('Durchläufe: 1'), null, { timeout: 60000 });
    assert.match(await page.getByTestId('debug').textContent(), /angekommen: 6/);

    const manifestHref = await page.locator('link[rel=manifest]').getAttribute('href');
    const manifest = await (await page.request.get(new URL(manifestHref, BASE).href)).json();
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.orientation, 'portrait');
    for (const icon of manifest.icons) assert.equal((await page.request.get(new URL(icon.src, BASE).href)).status(), 200);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await context.setOffline(true);
    await page.reload();
    await page.getByTestId('primary').waitFor();
    assert.match(await page.getByTestId('status').textContent(), /Durchläufe: 1/, 'Speicherstand überlebt Neuladen');
    assert.match(await page.getByTestId('status').textContent(), /Offline bereit/);
    assert.deepEqual(errors, []);
    console.log('E2E ok: Start, Welle, Speicherstand, Manifest, Service Worker, Offline');
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });
