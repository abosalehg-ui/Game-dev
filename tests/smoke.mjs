/**
 * Headless smoke test for "من الغرفة للقمة".
 *
 * Serves the repo over a local HTTP server and drives the game in Chromium:
 * boot → start → develop one full game (marketing → QA → review) and assert
 * the core loop works, plus a few regression guards:
 *   - no JS runtime errors on the happy path,
 *   - a malicious game name renders as text (no XSS execution),
 *   - the save never persists the mid-development flag or any session-only
 *     (underscore-prefixed) field, and is written at the current schema version.
 *
 * Run: `npm test`  (requires playwright + a Chromium install).
 * Set CHROME_PATH to override the browser binary; otherwise Playwright's
 * bundled Chromium is used.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  res.end(fs.readFileSync(fp));
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const errors = [];
// All assets are same-origin now (the font is vendored), so a "Failed to load
// resource" console error should not appear at all — it is still filtered because a
// sandboxed CI network can block the service-worker registration. Real JS logic
// errors surface as pageerror or a substantive console.error.
const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push('console.error: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

const results = {};
try {
  await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => localStorage.removeItem('gd_save'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);

  results.startBtn = await page.locator('#bst').isVisible();
  await page.click('#bst');
  await page.waitForTimeout(800);

  // The panel is a summary-chip list now; each decision lives in a focused picker.
  await page.evaluate(() => window.OpenPicker('genre'));
  await page.waitForTimeout(250);
  results.genreCount = await page.locator('#pickerBody .opt').count();
  await page.locator('#pickerBody .opt:not([disabled])').first().click();
  await page.waitForTimeout(150);
  await page.evaluate(() => window.ClosePicker());

  await page.evaluate(() => window.OpenPicker('topic'));
  await page.waitForTimeout(250);
  results.topicCount = await page.locator('#pickerBody .opt').count();
  // Every topic must carry a synergy rating for the chosen genre — this is the
  // teaching signal that replaced a hidden lookup table.
  results.topicRatings = await page.locator('#pickerBody .opt .om').count();
  await page.locator('#pickerBody .opt').first().click();
  await page.waitForTimeout(150);
  await page.evaluate(() => window.ClosePicker());

  await page.evaluate(() => window.OpenPicker('platform'));
  await page.waitForTimeout(250);
  results.platformCount = await page.locator('#pickerBody .opt').count();
  await page.evaluate(() => window.ClosePicker());

  // Malicious game name exercises the name-render paths (history, IPs, rivals).
  await page.evaluate(() => window.OpenPicker('name'));
  await page.waitForTimeout(200);
  await page.fill('#gni', '<img src=x onerror=window.__xss=1>');
  await page.evaluate(() => window.ClosePicker());
  await page.waitForTimeout(200);

  // The chips must reflect what was picked, and the panel must need no nested scroll.
  results.chipsFilled = await page.evaluate(() =>
    !document.getElementById('chipGenre').classList.contains('empty') &&
    !document.getElementById('chipTopic').classList.contains('empty'));
  results.nestedScrollers = await page.evaluate(() => {
    const panel = document.getElementById('mp');
    return [...panel.querySelectorAll('*')].filter(el => {
      const oy = getComputedStyle(el).overflowY;
      return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2;
    }).length;
  });
  results.panelFits = await page.evaluate(() => {
    const p = document.getElementById('mp');
    return p.scrollHeight <= p.clientHeight + 2;
  });
  results.devEnabled = await page.locator('#bdev').isEnabled();

  await page.click('#bdev');
  await page.waitForTimeout(400);
  results.mktModalOpen = (await page.locator('#mktModal.show').count()) > 0;
  await page.evaluate(() => window.ChooseMkt('none'));
  await page.waitForTimeout(300);
  results.qaModalOpen = (await page.locator('#qaModal.show').count()) > 0;
  await page.evaluate(() => window.ChooseQA('normal'));

  // Development now pauses halfway for a mid-production decision.
  try {
    await page.waitForSelector('#prodModal.show', { timeout: 10000 });
    results.prodModalOpen = true;
    await page.locator('#prodOpts button:not([disabled])').first().click();
  } catch { results.prodModalOpen = false; }

  try { await page.waitForSelector('#sr2.show', { timeout: 15000 }); results.reviewShown = true; }
  catch { results.reviewShown = false; }
  results.reviewHasScore = /\d/.test((await page.locator('#rva').textContent()) || '');

  await page.evaluate(() => window.toggleHistory());
  await page.evaluate(() => window.OpenRivals());
  await page.waitForTimeout(200);
  results.xssBlocked = await page.evaluate(() => window.__xss === undefined);
  await page.evaluate(() => window.CloseRivals());

  // Live pre-release feedback must be populated before any money is spent.
  results.previewLive = await page.evaluate(() => {
    const el = document.getElementById('qualityPreview');
    return !!el && el.style.display !== 'none' && /التوليفة/.test(el.textContent);
  });
  // Golden ideal-split markers should be positioned once a genre is picked.
  results.idealMarkers = await page.evaluate(() => {
    const m = document.getElementById('mkd');
    return !!m && m.style.display !== 'none' && /%$/.test(m.style.left);
  });
  // Escape must close an informational panel.
  await page.evaluate(() => window.OpenSettings());
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  results.escapeClosesPanel = (await page.locator('#settingsModal.show').count()) === 0;
  // Sliders must be operable from the keyboard. Test decrement first: with the full
  // point budget already allocated, an increment is legitimately clamped to a no-op,
  // so only the freed-up direction proves the handler is wired.
  results.sliderKeyboard = await page.evaluate(() => {
    const w = document.querySelector('.stw[data-s="design"]');
    const val = () => +document.getElementById('vd').textContent;
    w.focus();
    const start = val();
    w.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const down = val();
    w.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    const back = val();
    return down === start - 1 && back === start;
  });

  results.save = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('gd_save') || '{}');
    return { savedDev: 'dev' in s ? s.dev : null, hasUnderscore: Object.keys(s).some(k => k[0] === '_'), saveVersion: s.saveVersion, gc: s.gc };
  });
} finally {
  await browser.close();
  server.close();
}

const s = results.save || {};
const checks = {
  'start screen visible': results.startBtn === true,
  'genre picker lists every genre (>=8)': results.genreCount >= 8,
  'topic picker lists every topic (>=10)': results.topicCount >= 10,
  'every topic shows a synergy rating': results.topicRatings === results.topicCount,
  'platform picker lists every platform (>=4)': results.platformCount >= 4,
  'summary chips reflect the picks': results.chipsFilled === true,
  'panel has no nested scrollbars': results.nestedScrollers === 0,
  'panel fits without scrolling': results.panelFits === true,
  'develop button enabled': results.devEnabled === true,
  'marketing modal opens': results.mktModalOpen === true,
  'QA modal opens': results.qaModalOpen === true,
  'review appears': results.reviewShown === true,
  'review shows a score': results.reviewHasScore === true,
  'game name XSS blocked': results.xssBlocked === true,
  'mid-production decision appears': results.prodModalOpen === true,
  'live quality preview populated': results.previewLive === true,
  'ideal-split markers positioned': results.idealMarkers === true,
  'Escape closes an info panel': results.escapeClosesPanel === true,
  'sliders respond to keyboard': results.sliderKeyboard === true,
  'save never persists dev flag': s.savedDev === false,
  'save has no session-only fields': s.hasUnderscore === false,
  'save at current schema version': s.saveVersion === 5,
  'a game was recorded': s.gc >= 1,
  'no JS runtime errors': errors.length === 0,
};

let ok = true;
for (const [name, pass] of Object.entries(checks)) {
  console.log(`${pass ? '✓' : '✗'} ${name}`);
  if (!pass) ok = false;
}
if (errors.length) console.log('\nJS errors:\n' + errors.join('\n'));
console.log('\n' + (ok ? 'SMOKE PASS' : 'SMOKE FAIL'));
process.exit(ok ? 0 : 1);
