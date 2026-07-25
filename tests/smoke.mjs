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

  results.genreCount = await page.locator('#gr .sb2').count();
  results.platformCount = await page.locator('#plr .sb2').count();
  // The 15-chip topic row is gone: the name field carries the topic now.
  results.topicRowGone = (await page.locator('#tr').count()) === 0;

  await page.locator('#gr .sb2').first().click();
  // Writing a topic word must move the topic, and the echo must name the word it
  // matched — that read-back is the only thing making the derivation trustworthy.
  await page.fill('#gni', 'ملحمة الصحراء');
  await page.waitForTimeout(300);
  results.echoText = (await page.locator('#topicEcho').textContent()) || '';

  // The manual escape hatch: one tap on the echo opens a full-size picker.
  await page.locator('#topicEcho .tmain').click();
  await page.waitForTimeout(200);
  results.pickerOpen = (await page.locator('#topicPicker.show').count()) > 0;
  results.pickerCount = await page.locator('#tpGrid .tpc').count();
  await page.evaluate(() => window.CloseTopicPicker());

  // Malicious game name exercises the name-render paths (history, IPs, rivals).
  // It carries no topic word, so it must also fall back to عام rather than break.
  await page.fill('#gni', '<img src=x onerror=window.__xss=1>');
  await page.waitForTimeout(300);
  results.fallbackGeneral = /عام/.test((await page.locator('#topicEcho').textContent()) || '');
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
  'genres rendered (>=8)': results.genreCount >= 8,
  'platforms rendered (>=1)': results.platformCount >= 1,
  'topic chip row removed': results.topicRowGone === true,
  'name derives the topic': /صحراء/.test(results.echoText || ''),
  'echo names the matched word': /من «/.test(results.echoText || ''),
  'topic picker opens': results.pickerOpen === true,
  'picker lists every topic (>=16)': results.pickerCount >= 16,
  'unmatched name falls back to عام': results.fallbackGeneral === true,
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
