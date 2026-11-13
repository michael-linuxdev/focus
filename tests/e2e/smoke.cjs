// Spielt den gebauten Stand im Browser in Handygröße durch (Minute 0 bis 15):
// Start ohne Menü, Verteidigung, Stadtbau mit Timern, Burgfried 2 mit Straßenwahl, Katapult, Heldin,
// Kaserne, erster Angriff mit Fähigkeiten, Wiederholung, Speicherstand, Installierbarkeit, Offline.
// Schlachten laufen beschleunigt, Bauzeiten per Zeitraffer (window.__mk); die Regeln bleiben dieselben.
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
    const tapAt = async (kind, id) => {
      const p = await page.evaluate(([k, i]) => window.__mk.pos(k, i), [kind, id]);
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForTimeout(80);
    };
    const click = async (id) => {
      const el = page.getByTestId(id);
      await el.waitFor();
      const box = await el.boundingBox();
      assert.ok(box && box.height >= 44 && box.width >= 44, `Tippfläche ${id} mindestens 44 px`);
      await el.tap({ force: true }); // Hinweis-Schaltflächen pulsieren und gelten sonst als "nicht stabil"
      await page.waitForTimeout(80);
    };
    const skip = async (seconds) => { await page.evaluate((s) => window.__mk.skip(s), seconds); await page.waitForTimeout(150); };
    const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
    const waitStep = (id) => page.waitForFunction((s) => { const st = window.__mk.state(); return st.step === s && st.screen === 'city'; }, id, { timeout: 60000 });
    const defend = async (next) => { await click('defend'); await waitStep(next); };

    // Minute 0-1: kein Menü, Räuber laufen sofort, ein Tipp baut den ersten Turm.
    const t0 = Date.now();
    await page.waitForFunction(() => window.__mk?.state().screen === 'battle');
    console.log(`Erste Welle läuft nach ${Date.now() - t0} ms`);
    assert.equal(await page.locator('button').count(), 0, 'kein Menü, keine Schaltfläche beim Start');
    assert.equal(await page.title(), 'Mittelalter-Königreich');
    await page.waitForTimeout(1500);
    await shot('01-start');
    await page.waitForTimeout(5000); // Wer zögert, verliert nichts: die Welle wartet am Haltepunkt.
    let s = await state();
    assert.equal(s.battle.leaked, 0);
    assert.equal(s.battle.result, 'running');
    await tapAt('slot', 's1');
    await page.waitForFunction(() => window.__mk.state().battle?.towers.length === 1);
    await page.waitForTimeout(2000);
    await shot('02-erster-turm');
    await page.evaluate(() => window.__mk.speed(4));
    await waitStep('zweiter_turm');

    // Minute 1-3: zweiter Turm, Welle, Ausbau, Welle.
    await shot('03-stadt');
    await tapAt('slot', 's2');
    await tapAt('slot', 's3'); // kein Gold mehr: wird abgelehnt
    assert.equal((await state()).game.towers.length, 2);
    await defend('erster_ausbau');
    await tapAt('slot', 's1');
    await defend('holzfaeller');

    // Minute 3-6: Holzfäller mit kostenlosem Überspringen, Steinbruch mit echter Bauzeit.
    await tapAt('plot', 'p1');
    await shot('04-bauen');
    await click('building-holzfaeller');
    assert.equal((await state()).step, 'timer_ueberspringen');
    await shot('05-timer');
    await tapAt('plot', 'p1');
    assert.equal((await state()).step, 'steinbruch');
    await tapAt('plot', 'p2');
    await click('building-steinbruch');
    await tapAt('plot', 'p2'); // zweiter Timer lässt sich nicht überspringen
    s = await state();
    assert.ok(s.game.buildings[1].doneAt > s.game.now, 'Steinbruch ist noch im Bau');
    await skip(10);
    await waitStep('welle_4');
    await defend('burgfried_2');

    // Minute 6-10: Burgfried 2, Straßenwahl, Katapult, Heldin.
    await skip(60);
    assert.ok((await state()).game.resources.wood >= 20, 'Holz wird produziert');
    await tapAt('keep', '');
    await click('keep-upgrade');
    await shot('06-burgfried-im-bau');
    await skip(20);
    await page.getByTestId('road-westschleife').waitFor();
    await shot('07-strassenwahl');
    await click('road-westschleife');
    await waitStep('katapult');
    assert.equal((await state()).game.roadId, 'westschleife');
    await tapAt('slot', 's3');
    await click('tower-katapult');
    await waitStep('heldin');
    await click('hero');
    await shot('08-heldin');
    await click('section-mitte');
    await waitStep('welle_5');
    await shot('09-stadt-stufe-2');
    await click('defend');
    await page.waitForTimeout(2500);
    await shot('10-welle-5');
    await waitStep('kaserne');

    // Minute 10-15: Kaserne, Truppen, erster Angriff.
    await skip(60);
    await tapAt('plot', 'p3');
    await click('building-kaserne');
    await skip(15);
    await waitStep('truppen');
    await tapAt('plot', 'p3');
    await shot('11-ausbildung');
    await click('train-leicht');
    await skip(12);
    await page.waitForFunction(() => window.__mk.state().step === 'erster_angriff');
    await click('sheet-close');
    await click('attack');
    await shot('12-aufstellung');
    const before = Number(await page.getByTestId('lineup-0-leicht-count').textContent());
    await click('lineup-0-leicht-minus');
    assert.equal(Number(await page.getByTestId('lineup-0-leicht-count').textContent()), before - 1);
    await click('lineup-2-leicht-plus');
    await click('lineup-2-leicht-plus'); // mehr als bereitstehen geht nicht
    const troopsBefore = (await state()).game.army.ready;
    await page.evaluate(() => window.__mk.speed(1));
    await click('attack-go');
    await page.waitForFunction(() => window.__mk.state().screen === 'battle');
    await click('release');
    await page.waitForTimeout(1500);
    await click('ability-brandpfeile');
    await shot('13-ziel-waehlen');
    await tapAt('slot', 's1');
    assert.ok((await state()).battle.towers.find((t) => t.slot === 's1').disabledUntil > 0, 'Brandpfeile treffen den Turm');
    await click('release');
    await page.waitForTimeout(1500);
    await click('ability-schildwall');
    await click('release');
    await shot('14-angriff');
    await page.evaluate(() => window.__mk.speed(4));
    await page.waitForFunction(() => window.__mk.state().screen === 'result', null, { timeout: 120000 });
    await shot('15-ergebnis');
    s = await state();
    assert.equal(s.desync, false, 'nachgerechnete Schlachten stimmen mit den gespielten überein');
    assert.ok(s.game.lastAttack.depth >= 1, 'mindestens das Tor genommen');
    assert.ok(s.game.lastAttack.loot.gold > 0);
    assert.ok(s.game.lastAttack.loot.gold <= 150, 'Beute innerhalb der Verlustgrenze');
    for (const unit of Object.keys(troopsBefore)) {
      const inHospital = s.game.army.hospital.filter((h) => h.unit === unit).reduce((n, h) => n + h.count, 0);
      assert.equal((s.game.army.ready[unit] ?? 0) + inHospital, troopsBefore[unit], `keine ${unit} verloren`);
    }
    assert.equal(s.step, 'freies_spiel');

    // Wiederholung: läuft identisch ab.
    await click('result-replay');
    await click('replay-speed');
    await click('replay-speed');
    await page.waitForFunction(() => window.__mk.state().verdict !== null, null, { timeout: 120000 });
    assert.equal((await state()).verdict, 'ok');
    await shot('16-wiederholung');
    await click('replay-back');
    await shot('17-wiederholungen');
    assert.ok((await page.getByTestId('panel').locator('button').count()) >= 7, 'gespeicherte Schlachten sind aufgelistet');
    await click('replays-back');

    // Installierbarkeit und Offline-Betrieb, Speicherstand überlebt Neuladen.
    const manifestHref = await page.locator('link[rel=manifest]').getAttribute('href');
    const manifest = await (await page.request.get(new URL(manifestHref, BASE).href)).json();
    assert.equal(manifest.display, 'standalone');
    for (const icon of manifest.icons) assert.equal((await page.request.get(new URL(icon.src, BASE).href)).status(), 200);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const saved = (await state()).game;
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.__mk?.state().screen === 'city');
    s = await state();
    assert.deepEqual(s.game.towers, saved.towers);
    assert.deepEqual(s.game.buildings.map((b) => b.def), ['holzfaeller', 'steinbruch', 'kaserne']);
    assert.equal(s.game.roadId, 'westschleife');
    assert.equal(s.game.replays.length, saved.replays.length);
    assert.equal(s.step, 'freies_spiel');

    // Update: ein Speicherstand aus M1 (Version 2) wird übernommen.
    // (Vor dem Start der App eingespielt, weil die App beim Verlassen der Seite selbst speichert.)
    await context.addInitScript(() => {
      if (sessionStorage.getItem('m1-eingespielt')) return;
      sessionStorage.setItem('m1-eingespielt', '1');
      localStorage.setItem('mk.save', JSON.stringify({
        version: 2, now: 1000, nextSeed: 5, gold: 120, wavesWon: 3, lastDefense: null,
        towers: [{ slot: 's1', def: 'bogenturm', level: 2 }, { slot: 's2', def: 'bogenturm', level: 1 }],
      }));
    });
    await page.reload();
    await page.waitForFunction(() => window.__mk?.state().screen === 'city');
    s = await state();
    assert.equal(s.step, 'holzfaeller');
    assert.equal(s.game.resources.gold, 120);
    assert.equal(s.game.towers.length, 2);
    assert.deepEqual(errors, []);
    console.log('E2E ok: Minute 0 bis 15, Wiederholung identisch, Speicherstand, Update von M1, Manifest, Offline');
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });
