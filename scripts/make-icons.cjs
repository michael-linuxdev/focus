// Erzeugt die PNG-Symbole aus public/icons/icon.svg (einmalig, Ergebnis ist eingecheckt).
// Aufruf: node scripts/make-icons.cjs  (braucht Playwright mit Chromium)
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const dir = path.join(__dirname, '..', 'public', 'icons');
  const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
  const browser = await chromium.launch();
  for (const [name, size, scale] of [['icon-192', 192, 1], ['icon-512', 512, 1], ['icon-maskable-512', 512, 0.7]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<body style="margin:0;background:#1d2a1f;display:grid;place-items:center;height:100vh">` +
        `<div style="width:${size * scale}px;height:${size * scale}px">${svg}</div></body>`,
    );
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
    await page.close();
  }
  await browser.close();
})();
