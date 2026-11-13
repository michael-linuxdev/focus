// Spielt den gebauten Stand im Browser in Handygröße durch (Minute 0 bis 3):
// Start ohne Menü, erster Turm per Tipp, drei Wellen, Ausbau, Speicherstand, Installierbarkeit, Offline.
// Aufruf: npm run build && npm run test:e2e   (Bildschirmfotos nach $SHOTS, Vorgabe test-results/)
const { chromium, devices } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');

const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS ?? 'test-results';

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
    const state = () => page.evaluate(() => window.__mk.state());
    const tapSlot = async (id) => {
      const p = await page.evaluate((slot) => window.__mk.slotPos(slot), id);
      await page.touchscreen.tap(p.x, p.y);
    };
    const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
    const waitWon = (n) => page.waitForFunction((k) => window.__mk.state().game.wavesWon === k, n, { timeout: 90000 });
    const waitFresh = () => page.waitForFunction(() => { const b = window.__mk.state().battle; return b.result === 'running' && !b.released; });

    // Minute 0-1: kein Menü, Räuber laufen sofort, ein Tipp baut den ersten Turm.
    const t0 = Date.now();
    await page.waitForFunction(() => window.__mk?.state().battle.released === true);
    console.log(`Erste Welle läuft nach ${Date.now() - t0} ms`);
    assert.equal(await page.locator('button').count(), 0, 'kein Menü, keine Schaltfläche beim Start');
    assert.equal(await page.title(), 'Mittelalter-Königreich');
    await page.waitForTimeout(1500);
    await shot('m1-1-start');

    // Wer zögert, verliert nichts: die Räuber warten am Haltepunkt.
    await page.waitForTimeout(6000);
    let s = await state();
    assert.equal(s.battle.result, 'running');
    assert.equal(s.battle.leaked, 0);
    assert.equal(s.battle.towers.length, 0);

    await tapSlot('s1');
    await page.waitForFunction(() => window.__mk.state().battle.towers.length === 1);
    await page.waitForTimeout(2500);
    await shot('m1-2-erster-turm');
    await waitWon(1);
    await page.getByTestId('banner').waitFor();
    await shot('m1-3-sieg');

    // Minute 1-3: zweiter Turm, Welle selbst auslösen.
    await waitFresh();
    s = await state();
    assert.equal(s.game.gold, 50);
    await shot('m1-4-vor-welle-2');
    await tapSlot('s2');
    await page.waitForFunction(() => window.__mk.state().battle.towers.length === 2);
    await tapSlot('s3'); // kein Gold mehr: wird abgelehnt
    await page.waitForTimeout(200);
    assert.equal((await state()).battle.towers.length, 2);
    const release = page.getByTestId('release');
    const box = await release.boundingBox();
    assert.ok(box && box.height >= 44, 'Tippfläche mindestens 44 px');
    await release.tap({ force: true }); // der Knopf pulsiert als Hinweis
    await waitWon(2);

    // Erster Ausbau, dritte Welle.
    await waitFresh();
    await shot('m1-5-ausbau-hinweis');
    await tapSlot('s1');
    await page.waitForFunction(() => window.__mk.state().battle.towers.some((t) => t.level === 2));
    await page.getByTestId('release').tap({ force: true });
    await page.waitForTimeout(8000);
    await shot('m1-6-welle-3');
    await waitWon(3);
    s = await state();
    assert.equal(s.desync, false, 'nachgerechnete Schlacht stimmt mit der gespielten überein');
    assert.equal(s.battle.leaked, 0);

    // Installierbarkeit und Offline-Betrieb, Speicherstand überlebt Neuladen.
    const manifestHref = await page.locator('link[rel=manifest]').getAttribute('href');
    const manifest = await (await page.request.get(new URL(manifestHref, BASE).href)).json();
    assert.equal(manifest.display, 'standalone');
    for (const icon of manifest.icons) assert.equal((await page.request.get(new URL(icon.src, BASE).href)).status(), 200);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.__mk?.state().game.wavesWon === 3);
    s = await state();
    assert.deepEqual(s.game.towers, [{ slot: 's1', def: 'bogenturm', level: 2 }, { slot: 's2', def: 'bogenturm', level: 1 }]);
    assert.equal(await page.getByTestId('wave').textContent(), 'Welle 4');
    assert.deepEqual(errors, []);
    console.log('E2E ok: Start ohne Menü, Haltepunkt, drei Wellen, Ausbau, Speicherstand, Manifest, Offline');
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });
