// Spielt den gebauten Stand im Browser in Handygröße durch (Minute 0 bis 30 und die Rückkehr):
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
    // Installationshinweis: Im Handy-Browser steht er vor dem Spiel, das Spiel ruht solange.
    {
      const ctx = await browser.newContext({ ...devices['iPhone 13'] });
      const p = await ctx.newPage();
      const gateErrors = [];
      p.on('pageerror', (e) => gateErrors.push(String(e)));
      for (let i = 0; ; i++) {
        try { await p.goto(BASE); break; } catch (e) { if (i > 40) throw e; await new Promise((r) => setTimeout(r, 250)); }
      }
      await p.getByTestId('gate').waitFor();
      await p.screenshot({ path: path.join(SHOTS, '00-installationshinweis.png') });
      assert.equal(await p.getByTestId('gate-title').textContent(), 'Zuerst die App installieren');
      assert.equal(await p.getByTestId('gate-detected').textContent(), 'Erkannt: iPhone / iPad · Safari');
      assert.equal(await p.getByTestId('gate-steps').locator('li').count(), 3);
      assert.match(await p.getByTestId('gate-steps').textContent(), /Zum Home-Bildschirm/);
      assert.equal(await p.getByTestId('gate-steps').locator('svg').count(), 1, 'Teilen-Symbol im ersten Schritt');
      assert.equal(await p.getByTestId('gate-warning').count(), 1, 'Hinweis: Browser-Spielstand wandert auf dem iPhone nicht in die App');
      assert.doesNotMatch(await p.getByTestId('gate').textContent(), /⟦/, 'kein fehlender Text');
      const tick = () => p.evaluate(() => window.__mk.state().battle?.tick ?? -1);
      const before = await tick();
      await p.waitForTimeout(600);
      assert.equal(await tick(), before, 'das Spiel ruht hinter dem Hinweis');
      const skipBox = await p.getByTestId('gate-skip').boundingBox();
      assert.ok(skipBox && skipBox.height >= 44, 'Tippfläche „ohne Installation weiter" mindestens 44 px');
      await p.getByTestId('gate-skip').tap();
      await p.waitForFunction((b) => (window.__mk.state().battle?.tick ?? -1) > b, before);
      assert.equal(await p.getByTestId('gate').count(), 0);
      let ev = await p.evaluate(() => window.__mk.exportData().events.map((e) => [e.type, e.data.action ?? e.data.index ?? null]));
      const at = (type, value) => ev.findIndex((e) => e[0] === type && e[1] === value);
      assert.ok(at('install_hint', 'shown') >= 0 && at('install_hint', 'shown') < at('install_hint', 'skipped'));
      assert.ok(at('install_hint', 'skipped') < at('tutorial_step', 0), 'die Spielzeit beginnt erst nach dem Hinweis');
      await p.reload();
      await p.waitForFunction(() => window.__mk?.state().screen === 'battle');
      await p.waitForTimeout(300);
      assert.equal(await p.getByTestId('gate').count(), 0, 'nach „ohne Installation weiter" bleibt der Hinweis einige Stunden weg');
      // Sechs Stunden später steht er wieder da.
      await p.evaluate(() => localStorage.setItem('mk.gate', String(Date.now() - 6 * 3600 * 1000 - 1000)));
      await p.reload();
      await p.getByTestId('gate').waitFor();
      ev = await p.evaluate(() => window.__mk.exportData().events.filter((e) => e.type === 'tutorial_step').length);
      assert.equal(ev, 1, 'der erste Schritt wird nur einmal gezählt');
      assert.deepEqual(gateErrors, []);
      await ctx.close();
    }

    const context = await browser.newContext({ ...devices['Pixel 7'] });
    // Der Ablauf selbst läuft ohne den Hinweis (als hätte der Spieler „ohne Installation weiter" getippt).
    await context.addInitScript(() => localStorage.setItem('mk.gate', String(Date.now())));
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
    await page.waitForTimeout(1500);
    await shot('02-erster-turm');
    // Eingreifen: ein Tipp auf die vorderste Gruppe ruft den Pfeilhagel dorthin.
    const volley = async () => {
      const p = await page.evaluate(() => {
        const b = window.__mk.state().battle;
        if (!b || b.units.length === 0) return null;
        return window.__mk.roadPos(Math.max(...b.units.map((u) => u.pos)));
      });
      if (p) await page.touchscreen.tap(p.x, p.y);
      return p !== null;
    };
    await page.waitForFunction(() => window.__mk.state().battle?.units.length > 0);
    const hpBefore = (await state()).battle.units.reduce((n, u) => n + u.hp, 0);
    assert.equal(await volley(), true);
    await page.waitForFunction(() => window.__mk.state().battle.lastVolleyTick >= 0);
    await page.waitForTimeout(150);
    await shot('02b-pfeilhagel');
    s = await state();
    assert.ok(s.battle.units.reduce((n, u) => n + u.hp, 0) < hpBefore || s.battle.fallen.length > 0, 'Pfeilhagel trifft');
    assert.ok(s.battle.volleyReadyAt > s.battle.tick, 'Abklingzeit läuft');
    assert.equal(await page.getByTestId('ability-pfeilhagel').isDisabled(), true);
    await page.evaluate(() => window.__mk.speed(4));
    await waitStep('zweiter_turm');

    // Minute 1-3: zweiter Turm, Welle, Ausbau, Welle.
    await shot('03-stadt');
    await tapAt('slot', 's2');
    await tapAt('slot', 's3'); // kein Gold mehr: wird abgelehnt
    assert.equal((await state()).game.towers.length, 2);
    assert.match(await page.getByTestId('preview').textContent(), /Nächste Welle/);
    await shot('03b-vorschau');
    await click('defend');
    await click('speed');
    assert.match(await page.getByTestId('speed').textContent(), /×2/);
    await click('speed');
    // Die Welle wird mit Pfeilhagel gespielt, sonst kommen Läufer durch.
    for (let i = 0; i < 40 && (await state()).screen === 'battle'; i++) { await volley(); await page.waitForTimeout(400); }
    await waitStep('erster_ausbau');
    assert.match(String((await state()).game.replays.at(-1).stars), /[123]/);
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
    assert.match(await page.getByTestId('banner').textContent(), /Burgfried Stufe 2/, 'der Ausbau hat seine eigene Meldung');
    await shot('07-strassenwahl');
    await click('road-westschleife');
    await waitStep('katapult');
    await page.waitForFunction(() => /Alruna/.test(document.querySelector('[data-testid=banner]')?.textContent ?? ''), null, { timeout: 5000 });
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
    assert.equal(s.step, 'weltkarte');

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

    // Minute 15-20: Weltkarte, Schild, Pechnase und Wachstube, erste verlierbare Welle.
    await waitStep('weltkarte');
    await click('world');
    await page.getByTestId('map').waitFor();
    await shot('18-weltkarte');
    assert.equal(await page.getByTestId('node-eschenfurt').isDisabled(), true, 'Nachbar unter Schild ist nicht angreifbar');
    assert.equal(await page.getByTestId('node-falkenried').isDisabled(), false);
    assert.match(await page.getByTestId('node-home').textContent(), /Schild/);
    await click('world-back');
    await waitStep('pechnase');
    assert.match(await page.getByTestId('status').textContent(), /Schild 7\d h/);
    await tapAt('slot', 's4');
    await shot('19-turmwahl');
    await click('tower-pechnase');
    await waitStep('wachstube');
    await tapAt('slot', 's7');
    await click('tower-wachstube');
    await waitStep('welle_6');
    await shot('20-stadt-vier-turmtypen');
    await click('defend');
    await page.evaluate(() => window.__mk.speed(2));
    await page.waitForTimeout(3500);
    await shot('21-welle-6');
    await page.evaluate(() => window.__mk.speed(4));
    await waitStep('speicher');

    // Minute 20-25: längere Timer, Allianz mit Belohnung, Hilfe beim Bauen.
    await tapAt('plot', 'p4');
    await click('building-speicher');
    await waitStep('allianz');
    const goldBefore = (await state()).game.resources.gold;
    await click('alliance');
    await shot('22-allianz');
    await click('alliance-join');
    assert.equal((await state()).game.resources.gold, goldBefore + 100);
    await click('sheet-close');
    await waitStep('hof');
    await tapAt('plot', 'p5');
    await click('building-hof');
    await waitStep('hilfe');
    const hofBefore = (await state()).game.buildings.find((b) => b.def === 'hof').doneAt;
    await shot('23-hilfe-bitten');
    await tapAt('plot', 'p5');
    await waitStep('tagesziele');
    await page.waitForTimeout(4500); // die erste Hilfe kommt nach vier Sekunden echter Zeit
    await shot('24-hilfe-kommt');
    await skip(20);
    s = await state();
    assert.equal(s.game.buildings.find((b) => b.def === 'hof').helpsReceived, 5);
    assert.equal(s.game.buildings.find((b) => b.def === 'hof').doneAt, hofBefore - 150000, 'fünf Hilfen verkürzen um 150 s');

    // Minute 25-30: Tagesziele und Ankündigung des Nachtangriffs.
    await click('goals');
    await shot('25-tagesziele');
    await click('goal-verteidigen'); // die Ankündigung erscheint danach von selbst
    await page.getByTestId('raid-ack').waitFor();
    await shot('26-ankuendigung');
    await click('raid-ack');
    await waitStep('freies_spiel');

    // Rückkehr nach Abwesenheit: Nachtangriff wird berechnet, als Wiederholung gezeigt, Tipp führt zur Schwachstelle.
    await skip(4 * 3600 + 60);
    await page.getByTestId('raid-replay').waitFor();
    await shot('27-nachtangriff-bericht');
    s = await state();
    const raid = s.game.replays[s.game.replays.length - 1];
    assert.equal(raid.kind, 'raid');
    assert.equal(raid.replay.inputs.length, 0);
    await click('raid-replay');
    await click('replay-speed');
    await click('replay-speed');
    await page.waitForTimeout(1500);
    await shot('28-nachtangriff-wiederholung');
    await page.waitForFunction(() => window.__mk.state().verdict !== null, null, { timeout: 120000 });
    assert.equal((await state()).verdict, 'ok');
    await click('replay-weak');
    await page.waitForFunction(() => window.__mk.state().screen === 'city');
    await page.waitForTimeout(400);
    await shot('29-schwachstelle');
    assert.match(await page.getByTestId('banner').textContent(), /Schwachstelle/);

    // Messung: versteckte Entwicklerseite, Kennzahlen, Export als Datei, Rückkehr am nächsten Tag.
    const openDev = async () => {
      for (let i = 0; i < 5; i++) await page.getByTestId('top-right').tap({ force: true });
      await page.getByTestId('dev').waitFor();
    };
    assert.equal(await page.getByTestId('dev').count(), 0, 'Entwicklerseite ist im Spiel nicht sichtbar');
    await openDev();
    await shot('30-entwicklerseite');
    assert.equal(await page.getByTestId('kpi-minute10').getAttribute('data-value'), 'true');
    assert.equal(await page.getByTestId('kpi-alliance').getAttribute('data-value'), 'true');
    assert.equal(await page.getByTestId('kpi-nextday').getAttribute('data-value'), 'false');
    // Zeitraffer: zum nächsten Kalendertag, dann die App neu öffnen. Läuft der Test spät am Abend, hat schon der
    // Vier-Stunden-Sprung zum Nachtangriff den Tag gewechselt; dann genügt das Neuöffnen.
    const days = await page.evaluate(() => { const e = window.__mk.exportData(); return { first: e.summary.firstDay, now: e.events.at(-1).day }; });
    if (days.now === days.first) await click('dev-1d');
    await click('dev-close');
    await page.reload();
    await page.waitForFunction(() => window.__mk?.state().screen === 'city');
    await openDev();
    assert.equal(await page.getByTestId('kpi-nextday').getAttribute('data-value'), 'true');
    assert.equal(await page.getByTestId('dev-lapse').count(), 1, 'Zeitraffer ist im Export gekennzeichnet');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('dev-export').tap()]);
    const exportPath = path.join(SHOTS, 'export.json');
    await download.saveAs(exportPath);
    const exported = JSON.parse(require('node:fs').readFileSync(exportPath, 'utf8'));
    assert.match(download.suggestedFilename(), /^mk-export-[0-9a-f]{12}-\d{4}-\d{2}-\d{2}\.json$/);
    assert.equal(exported.format, 1);
    assert.deepEqual([exported.summary.reachedMinute10, exported.summary.joinedAlliance, exported.summary.returnedNextDay], [true, true, true]);
    assert.ok(exported.summary.secondsToFirstTower >= 6, 'Zeit bis zum ersten Turm ist erfasst');
    assert.equal(exported.summary.sessions, 2);
    const types = new Set(exported.events.map((e) => e.type));
    for (const type of ['app_open', 'app_close', 'tutorial_step', 'tower_built', 'building_started', 'battle_start', 'battle_end', 'action_cancelled', 'alliance_joined', 'help_requested', 'goal_claimed', 'raid_report']) {
      assert.ok(types.has(type), `Ereignis ${type} ist aufgezeichnet`);
    }
    assert.equal(exported.events.filter((e) => e.type === 'tutorial_step').length, exported.summary.lastStepIndex + 1, 'jeder Tutorial-Schritt genau einmal');
    for (const e of exported.events) assert.deepEqual(Object.keys(e).sort(), ['data', 'day', 'lapse', 'seq', 'session', 't', 'type']);
    // Nur grob Betriebssystem und Browserfamilie beim Start, keine Kennung des Geräts oder Browsers.
    assert.doesNotMatch(JSON.stringify(exported), /Mozilla|Pixel|userAgent|AppleWebKit|Build\//i, 'keine Gerätekennung im Export');
    assert.deepEqual(Object.keys(exported.events.find((e) => e.type === 'app_open').data).sort(), ['browser', 'fresh', 'os', 'standalone', 'step']);
    // Dieselben Kennzahlen aus der Datei, mit dem Auswerteskript.
    const out = require('node:child_process').execFileSync('node', ['scripts/metrics.ts', exportPath], { encoding: 'utf8' });
    assert.match(out, /Minute 10 erreicht:\s+100 %/);
    assert.match(out, /Allianz beigetreten:\s+100 %/);
    assert.match(out, /Rückkehr am nächsten Tag:\s+100 %/);
    await click('dev-close');
    if (await page.getByTestId('raid-ok').count()) await click('raid-ok');

    // Testbericht: für Tester mit einem Tipp erreichbar, mit freiwilliger Anmerkung.
    await click('report-open');
    await page.getByTestId('report').waitFor();
    await page.getByTestId('report-note').fill('Welle 4 war zu schwer');
    await shot('31-testbericht');
    const [reportFile] = await Promise.all([page.waitForEvent('download'), page.getByTestId('report-send').tap()]);
    assert.match(reportFile.suggestedFilename(), /^mk-testbericht-[0-9a-f]{12}-\d{4}-\d{2}-\d{2}\.json$/);
    const reportPath = path.join(SHOTS, 'testbericht.json');
    await reportFile.saveAs(reportPath);
    const sentReport = JSON.parse(require('node:fs').readFileSync(reportPath, 'utf8'));
    assert.equal(sentReport.notes.at(-1).text, 'Welle 4 war zu schwer');
    assert.ok(sentReport.events.length >= exported.events.length);
    await page.getByTestId('report-message').waitFor();
    assert.equal(await page.getByTestId('report-note').inputValue(), '', 'die Anmerkung ist übergeben');
    assert.match(require('node:child_process').execFileSync('node', ['scripts/metrics.ts', reportPath], { encoding: 'utf8' }), /Minute 10 erreicht:\s+100 %/);
    await click('report-close');
    assert.equal((await page.evaluate(() => window.__mk.exportData().events.at(-1))).type, 'report_sent');

    // Wachstum: Gebäude haben Ausbaustufen, der Burgfried nennt, was ihm fehlt, das Lager hat eine Grenze.
    s = await state();
    const woodPlot = s.game.buildings.find((b) => b.def === 'holzfaeller').plot;
    await tapAt('plot', woodPlot);
    await page.getByTestId('sheet').waitFor();
    await shot('32-ausbau');
    assert.match(await page.getByTestId('sheet').textContent(), /Holzfäller · Stufe 1/);
    assert.match(await page.getByTestId('sheet').textContent(), /1800 Holz je Stunde.*Danach: 2100 Holz je Stunde/);
    await click('building-upgrade');
    s = await state();
    assert.ok(s.game.buildings.find((b) => b.plot === woodPlot).upgradeDoneAt > s.game.now, 'der Ausbau läuft');
    await skip(125);
    await page.waitForFunction((p) => window.__mk.state().game.buildings.find((b) => b.plot === p).level === 2, woodPlot);
    await tapAt('keep');
    await page.getByTestId('keep-upgrade').waitFor();
    assert.match(await page.getByTestId('keep-upgrade').textContent(), /Braucht Speicher Stufe 2/);
    assert.equal(await page.getByTestId('keep-upgrade').isDisabled(), true);
    await shot('33-burgfried-braucht-speicher');
    await click('sheet-close');
    // Erträge laufen nur bis zum Lagerplatz: nach einem Tag steht das Holz an der Grenze, nicht darüber.
    const stockBefore = (await state()).game.resources;
    await skip(24 * 3600);
    await page.waitForFunction(() => window.__mk.state().game.raidReport !== null || window.__mk.state().game.now > 0);
    await page.waitForTimeout(300);
    if (await page.getByTestId('raid-ok').count()) await click('raid-ok');
    s = await state();
    assert.ok(s.game.resources.wood <= Math.max(stockBefore.wood, 5000), `Holz bleibt an der Lagergrenze (${s.game.resources.wood})`);
    assert.equal(await page.getByTestId('res-wood').getAttribute('data-full'), 'true');
    await shot('34-lager-voll');

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
    assert.deepEqual(s.game.buildings.map((b) => b.def), ['holzfaeller', 'steinbruch', 'kaserne', 'speicher', 'hof']);
    assert.equal(s.game.allianceJoined, true);
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
    console.log('E2E ok: Minute 0 bis 30, Nachtangriff bei Rückkehr, Wiederholung identisch, Speicherstand, Update von M1, Manifest, Offline');
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });
