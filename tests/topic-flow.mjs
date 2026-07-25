/**
 * Topic-selection flow test for "من الغرفة للقمة".
 *
 * tests/topic-detect.mjs proves the derivation function is right. This proves the
 * three flows built on top of it behave as the panel promises:
 *   - a manual pick from the picker overrides the name,
 *   - editing the name afterwards takes control back and re-derives,
 *   - a sequel keeps its series' topic (🔒) even when the player renames it.
 *
 * The sequel path is seeded through a save with a ready-made IP, because reaching
 * one organically needs a release scoring 7+.
 *
 * Run: `npm test`  (requires playwright + a Chromium install).
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
const URL_BASE = `http://localhost:${server.address().port}/index.html`;

// A mid-game save carrying one desert-themed IP, ready to spawn a sequel.
const SAVE = {
  saveVersion: 5, money: 5000000, fn: 9000, gc: 12, st: 3, bs: 9, pm: 2000000, hs: 8,
  genre: null, topic: null, sl: { design: 5, code: 7, sound: 5 },
  hist: [], ach: ['f'], sk: 0, em: null, tt: null, gse: 0, dev: false, eggs: 0,
  difficulty: 'normal', audio: { volume: 0, muted: true }, theme: 'dark',
  platforms: ['pc'], research: { points: 10, unlocked: [] }, employees: [],
  ips: [{ id: 'ip_seed', name: 'ملحمة الصحراء', genre: 'action', topic: 'desert', bestScore: 9, sequels: 0, dlcs: 0 }],
  marketing: { hype: 0, campaign: null, cost: 0 }, qaMode: null, bugs: 0,
  year: 5, gamesThisYear: 2, awards: [], prestige: { level: 0 }, conventionCooldown: 0,
  rivals: [], morale: 75, loan: null, engineVersion: 0, contract: null, contractCooldown: 5,
  loansRepaid: 0, gotyWins: 0, partyUsed: false, pendingDevCost: 0, tips: ['panel'],
};

const errors = [];
const out = {};
let bootError = null;
const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
const browser = await chromium.launch(launchOpts);
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text())) errors.push('console.error: ' + m.text()); });

  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(s => localStorage.setItem('gd_save', s), JSON.stringify(SAVE));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.click('#bst');
  await page.waitForTimeout(900);

  const echo = () => page.locator('#topicEcho').innerText();
  await page.locator('#gr .sb2').first().click();

  // 1) The name drives the topic.
  await page.fill('#gni', 'ملحمة الصحراء');
  await page.waitForTimeout(300);
  out.derived = (await echo()).trim();

  // 2) A manual pick from the picker overrides it.
  await page.locator('#topicEcho .tmain').click();
  await page.waitForTimeout(250);
  await page.locator('#tpGrid .tpc').first().click(); // فضاء — the first topic
  await page.waitForTimeout(250);
  out.afterPick = (await echo()).trim();
  await page.evaluate(() => window.CloseTopicPicker());

  // 3) Editing the name takes control back.
  await page.fill('#gni', 'حصار المجرة');
  await page.waitForTimeout(300);
  out.afterEdit = (await echo()).trim();

  // 4) The dice button always yields a name that resolves to a real topic.
  await page.click('#gnrand');
  await page.waitForTimeout(300);
  out.rolledName = await page.inputValue('#gni');
  out.rolledEcho = (await echo()).trim();

  // 5) A sequel pins its series topic, and a rename must not move it.
  await page.evaluate(() => window.OpenIPs());
  await page.waitForTimeout(300);
  await page.locator('#ipList button.bg').first().click(); // 🔄 جزء ثانٍ
  await page.waitForTimeout(400);
  out.sequelName = await page.inputValue('#gni');
  out.sequelEcho = (await echo()).trim();
  await page.fill('#gni', 'مجرة النور');
  await page.waitForTimeout(350);
  out.sequelAfterRename = (await echo()).trim();

  // 6) Picking a different topic is how a sequel is abandoned — the lock lifts and
  //    the pick takes effect, rather than being silently swallowed by the lock.
  await page.locator('#topicEcho .tmain').click();
  await page.waitForTimeout(250);
  await page.locator('#tpGrid .tpc').first().click(); // فضاء ≠ صحراء
  await page.waitForTimeout(300);
  out.afterAbandon = (await echo()).trim();
  await page.evaluate(() => window.CloseTopicPicker());
} catch (e) {
  bootError = e.message;
} finally {
  await browser.close();
  server.close();
}

const checks = {
  'name derives the topic': /صحراء/.test(out.derived || '') && /من «/.test(out.derived || ''),
  'manual pick overrides the name': /فضاء/.test(out.afterPick || '') && /اختيار يدوي/.test(out.afterPick || ''),
  'editing the name clears the manual pick': /فضاء/.test(out.afterEdit || '') && /من «/.test(out.afterEdit || ''),
  'dice produces a name': (out.rolledName || '').trim().length > 0,
  'dice name resolves to a real topic': !/عام/.test(out.rolledEcho || ''),
  'sequel names itself after the series': /ملحمة الصحراء/.test(out.sequelName || ''),
  'sequel pins the series topic': /🔒/.test(out.sequelEcho || '') && /صحراء/.test(out.sequelEcho || ''),
  'renaming a sequel does not move its topic': /🔒/.test(out.sequelAfterRename || '') && /صحراء/.test(out.sequelAfterRename || ''),
  'picking another topic abandons the sequel': !/🔒/.test(out.afterAbandon || '') && /فضاء/.test(out.afterAbandon || ''),
  'no JS runtime errors': errors.length === 0,
};

if (bootError) console.log('✗ could not drive the page: ' + bootError);
let failed = bootError ? 1 : 0;
for (const [name, ok] of Object.entries(checks)) {
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}`);
}
if (failed) {
  console.log('\nobserved:');
  for (const [k, v] of Object.entries(out)) console.log(`  ${k}: ${JSON.stringify(v)}`);
  if (errors.length) console.log('  errors: ' + errors.join(' | '));
}
console.log(failed ? '\nTOPIC FLOW FAIL' : '\nTOPIC FLOW PASS');
process.exit(failed ? 1 : 0);
