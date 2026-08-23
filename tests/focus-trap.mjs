/**
 * Modal focus-containment test for "من الغرفة للقمة".
 *
 * Every overlay carries aria-modal="true", which tells a screen reader the rest
 * of the page is not there. Nothing enforced it: focus was moved into the modal
 * on open and restored on close, but never held, so six Tab presses out of the
 * settings panel landed on document.body and from there walked the toolbar and
 * the develop panel behind a dimmed, blurred backdrop the user could not read.
 *
 * This asserts the promise is kept:
 *   - Tab cycles inside an open overlay and never reaches the page behind it,
 *   - Shift+Tab wraps the other way,
 *   - the background is genuinely inert, not merely skipped,
 *   - closing the overlay hands focus back and releases the background.
 *
 * Run: `npm run test:focus`. Set CHROME_PATH to override the browser binary.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.woff2':'font/woff2' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  res.end(fs.readFileSync(fp));
});
await new Promise(r => server.listen(0, r));

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text())) errors.push('console: ' + m.text()); });
await page.goto(`http://localhost:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.evaluate(() => localStorage.removeItem('gd_save'));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.click('#bst');
await page.waitForTimeout(800);

const checks = {};
const note = {};
const summary = [];

// `stop` identifies the focused element by its position among the overlay's
// focusables, because the generated grids are all anonymous <button>s and
// counting distinct tag names would report "2 stops" for a sixteen-button picker.
const where = id => page.evaluate(mid => {
  const a = document.activeElement;
  const m = document.getElementById(mid);
  const items = [...m.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')];
  return {
    inside: !!a && m.contains(a),
    tag: a ? a.tagName + (a.id ? '#' + a.id : '') : 'null',
    stop: a ? items.indexOf(a) : -1,
    total: items.length,
  };
}, id);

// Two overlays with different shapes: settings is a hand-written form (range,
// checkboxes, select, buttons), the topic picker is a generated grid of sixteen
// buttons. A trap that only works on one of them is not a trap.
for (const [id, open, close] of [
  ['settingsModal', 'OpenSettings', 'CloseSettings'],
  ['topicPicker', 'OpenTopicPicker', 'CloseTopicPicker'],
]) {
  await page.evaluate(fn => window[fn](), open);
  await page.waitForTimeout(250);

  const start = await where(id);
  const seen = [];
  let escaped = null;
  // Well past the number of focusables in either overlay, so a trap that merely
  // delays the escape rather than preventing it still gets caught.
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const w = await where(id);
    seen.push(w.stop);
    if (!w.inside) { escaped = `after ${i + 1} Tab presses → ${w.tag}`; break; }
  }
  // A stop of -1 means focus landed inside the overlay on something the selector
  // does not know about, which is a gap in the trap's own notion of "focusable".
  const unknown = seen.filter(i => i < 0).length;
  checks[`Tab stays inside ${id}`] = escaped === null && unknown === 0;
  note[`Tab stays inside ${id}`] = escaped
    || (unknown ? `${unknown} stops on elements outside the focusable selector` : `30 presses over ${new Set(seen).size} of ${start.total} focusables, never left`);

  let backEscaped = null;
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Shift+Tab');
    const w = await where(id);
    if (!w.inside) { backEscaped = `after ${i + 1} Shift+Tab presses → ${w.tag}`; break; }
  }
  checks[`Shift+Tab stays inside ${id}`] = backEscaped === null;
  note[`Shift+Tab stays inside ${id}`] = backEscaped || '30 reverse presses, never left';

  summary.push(`${id.padEnd(16)} opened on ${start.tag}, cycled ${new Set(seen).size} of ${start.total} focusables`);

  await page.evaluate(fn => window[fn](), close);
  await page.waitForTimeout(250);
}

// The background must be inert while an overlay is up — skipping it in the tab
// order is not the same as removing it from the accessibility tree, and a
// pointer or a screen-reader cursor can still reach a merely-skipped element.
{
  await page.evaluate(() => window.OpenSettings());
  await page.waitForTimeout(200);
  const during = await page.evaluate(() => ['ui', 'mp', 'pt'].map(i => !!document.getElementById(i)?.inert));
  await page.evaluate(() => window.CloseSettings());
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ['ui', 'mp', 'pt'].map(i => !!document.getElementById(i)?.inert));
  const supported = await page.evaluate(() => 'inert' in HTMLElement.prototype);
  checks['the background is inert while a modal is open'] = !supported || during.every(Boolean);
  note['the background is inert while a modal is open'] = supported
    ? `ui/mp/pt inert = ${JSON.stringify(during)}`
    : 'inert unsupported in this browser; the Tab wrap above is the fallback';
  checks['the background is released when it closes'] = after.every(v => v === false);
  note['the background is released when it closes'] = `ui/mp/pt inert = ${JSON.stringify(after)}`;
}

// Closing must hand focus back to whatever opened the overlay, not drop it on
// body — otherwise the next Tab restarts from the top of the document.
//
// The game-name field is the anchor rather than the develop button, which is
// disabled until a genre is chosen and therefore cannot hold focus at all.
{
  await page.evaluate(() => document.getElementById('gni').focus());
  const before = await page.evaluate(() => document.activeElement?.id);
  await page.evaluate(() => window.OpenSettings());
  await page.waitForTimeout(200);
  await page.evaluate(() => window.CloseSettings());
  await page.waitForTimeout(250);
  const restored = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  checks['focus returns to the element that opened the modal'] = before === 'gni' && restored === 'gni';
  note['focus returns to the element that opened the modal'] = `opened from ${before}, focus landed on ${restored}`;
}

checks['no JS runtime errors'] = errors.length === 0;
note['no JS runtime errors'] = errors.slice(0, 3).join(' | ');

await browser.close();
server.close();

let ok = true;
for (const [name, pass] of Object.entries(checks)) {
  console.log(`${pass ? '✓' : '✗'} ${name}${note[name] ? `  — ${note[name]}` : ''}`);
  if (!pass) ok = false;
}
console.log('\n' + summary.map(s => '  ' + s).join('\n'));
console.log('\n' + (ok ? 'FOCUS TRAP PASS' : 'FOCUS TRAP FAIL'));
process.exit(ok ? 0 : 1);
