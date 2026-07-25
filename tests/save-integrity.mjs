/**
 * Save-integrity regression suite for "من الغرفة للقمة".
 *
 * migrateSave()/sanitizeSave() is the highest-risk function in the project — it is
 * the only code that accepts data the player can author — and it previously had no
 * tests at all. Three real defects lived here, and each one below is pinned by a
 * case that reproduced it before the fix:
 *
 *   1. Visiting the start screen and leaving/reloading without pressing "متابعة"
 *      serialised the pristine default state over a real save. A 42-game, 1.2M,
 *      stage-3 save became 0 games / 10K / bedroom, silently, while the button
 *      still read "متابعة رحلتك".
 *   2. "مسح الحفظ" did not clear anything: location.reload() fired beforeunload,
 *      whose unguarded saveGame() wrote the in-memory state straight back.
 *   3. An imported save with employees[].name = '<img onerror=...>' executed the
 *      script (RenderEmps built the roster with innerHTML), and an unknown
 *      platform id or employee role threw inside getDevCost()/RenderEmps, leaving
 *      the state half-applied and the panel permanently frozen.
 *
 * Run: `npm run test:save`  (requires playwright + a Chromium install).
 * Set CHROME_PATH to override the browser binary.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.woff2':'font/woff2' };

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

const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
const browser = await chromium.launch(launchOpts);
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-save-'));

// A realistic mid-game save at the current schema version.
const REAL_SAVE = {
  saveVersion: 5, money: 1234567, fn: 9000, gc: 42, st: 3, bs: 9.5, pm: 2000000, hs: 8,
  genre: null, topic: null, sl: { design: 5, code: 7, sound: 5 },
  hist: [{ name: 'لعبتي', genre: 'أكشن', topic: 'فضاء', score: 9, revenue: 1000, year: 5 }],
  ach: ['f'], sk: 0, em: null, tt: null, gse: 0, dev: false, eggs: 2,
  difficulty: 'normal', audio: { volume: 0.6, muted: false }, theme: 'dark',
  platforms: ['pc'], research: { points: 10, unlocked: ['engine'] }, employees: [],
  ips: [], marketing: { hype: 0, campaign: null, cost: 0 }, qaMode: null, bugs: 0,
  year: 5, gamesThisYear: 2, awards: [{ year: 1, game: 'x', score: 9 }],
  prestige: { level: 2 }, conventionCooldown: 0, rivals: [], morale: 75,
  loan: null, engineVersion: 1, contract: null, contractCooldown: 0,
  loansRepaid: 1, gotyWins: 0, partyUsed: false, pendingDevCost: 0, tips: ['panel'],
};

async function newPage() {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text())) errors.push('console.error: ' + m.text()); });
  page.on('dialog', async d => { page.__dialogs = page.__dialogs || []; page.__dialogs.push(d.message()); await d.dismiss(); });
  return { page, errors };
}
const read = page => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('gd_save') || 'null'); } catch (e) { return 'UNPARSEABLE'; } });
const write = (page, obj) => page.evaluate(s => localStorage.setItem('gd_save', s), JSON.stringify(obj));
function saveFile(name, obj) {
  const fp = path.join(tmpDir, name);
  fs.writeFileSync(fp, Buffer.from(JSON.stringify(obj), 'utf8').toString('base64'));
  return fp;
}

// Boot with a save already present, optionally pressing "متابعة".
async function boot({ save = null, start = true } = {}) {
  const { page, errors } = await newPage();
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  if (save) await write(page, save);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  if (start) { await page.click('#bst'); await page.waitForTimeout(700); }
  return { page, errors };
}

async function importInto(page, obj) {
  const chooser = page.waitForEvent('filechooser');
  await page.evaluate(() => window.importSave());
  (await chooser).setFiles(saveFile('s' + Math.abs(JSON.stringify(obj).length) + '.txt', obj));
  await page.waitForTimeout(1000);
}

const checks = {};
const note = {};

try {
  // ---- 1. Merely visiting the start screen must not touch an existing save ----
  {
    const { page } = await newPage();
    await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
    await write(page, REAL_SAVE);
    // Reload twice without ever pressing a button: each reload fires the unload
    // handlers of the previous document, which is exactly what destroyed the save.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const after = await read(page);
    checks['reload on start screen preserves the save'] =
      !!after && after.gc === 42 && after.money === 1234567 && after.st === 3 && after.year === 5;
    note['reload on start screen preserves the save'] = after ? `gc=${after.gc} money=${after.money} st=${after.st}` : 'null';
    await page.close();
  }

  // ---- 2. Pressing "متابعة" restores the real save, not a default one ----
  {
    const { page, errors } = await boot({ save: REAL_SAVE });
    const stage = await page.locator('#ds').textContent();
    const prestige = await page.locator('#dpr').textContent();
    checks['continue restores the saved run'] = /استوديو/.test(stage) && prestige.trim() === '2';
    note['continue restores the saved run'] = `stage="${stage.trim()}" prestige=${prestige.trim()}`;
    checks['continue produces no JS errors'] = errors.length === 0;
    note['continue produces no JS errors'] = errors.slice(0, 2).join(' | ');
    await page.close();
  }

  // ---- 3. "مسح الحفظ" must actually delete, and survive the reload ----
  {
    const { page } = await boot({ save: REAL_SAVE });
    page.on('dialog', () => {}); // already handled in newPage
    await page.evaluate(() => { window.confirm = () => true; });
    await page.evaluate(() => window.ResetGame());
    await page.waitForTimeout(1500);
    const after = await read(page);
    checks['reset actually clears the save'] = after === null;
    note['reset actually clears the save'] = after === null ? 'cleared' : `still present (gc=${after && after.gc})`;
    await page.close();
  }

  // ---- 4. Normal play persists progress ----
  {
    const { page } = await boot({ save: REAL_SAVE });
    await page.evaluate(() => window.OpenSettings());
    await page.evaluate(() => window.CloseSettings());
    await page.waitForTimeout(300);
    const after = await read(page);
    checks['in-session changes are persisted'] = !!after && after.gc === 42 && after.saveVersion === 5;
    await page.close();
  }

  // ---- 5. Imported employee name must never execute ----
  {
    const { page, errors } = await boot({ save: null });
    await importInto(page, { ...REAL_SAVE, st: 2, money: 99999,
      employees: [{ role: 'coder', name: '<img src=x onerror="window.__pwn=1">', level: 0, exp: 0, salary: 2000 }] });
    await page.evaluate(() => window.OpenEmps());
    await page.waitForTimeout(800);
    const pwned = await page.evaluate(() => window.__pwn === 1);
    const shownAsText = await page.evaluate(() => (document.getElementById('empContent').textContent || '').includes('<img'));
    checks['imported employee name cannot execute script'] = pwned === false;
    checks['imported employee name renders as text'] = shownAsText === true;
    checks['employee-name import raises no JS error'] = errors.length === 0;
    note['employee-name import raises no JS error'] = errors.slice(0, 2).join(' | ');
    await page.close();
  }

  // ---- 6. Unknown platform id must be rejected, not crash the UI ----
  {
    const { page, errors } = await boot({ save: null });
    await importInto(page, { ...REAL_SAVE, st: 2, money: 99999, platforms: ['switch', 'pc'] });
    const platforms = await page.evaluate(() => document.querySelectorAll('#plr .sb2.a').length);
    const costBefore = await page.locator('#dcc').textContent();
    // The panel must keep updating after the import — this is what used to freeze.
    await page.locator('#plr .sb2').nth(1).click();
    await page.waitForTimeout(300);
    const costAfter = await page.locator('#dcc').textContent();
    checks['unknown platform id is filtered out'] = platforms >= 1;
    checks['UI still updates after a bad-platform import'] = costBefore !== costAfter;
    note['UI still updates after a bad-platform import'] = `"${costBefore.trim()}" -> "${costAfter.trim()}"`;
    checks['bad-platform import raises no JS error'] = errors.length === 0;
    note['bad-platform import raises no JS error'] = errors.slice(0, 2).join(' | ');
    await page.close();
  }

  // ---- 7. Unknown employee role must be rejected, not throw ----
  {
    const { page, errors } = await boot({ save: null });
    await importInto(page, { ...REAL_SAVE, st: 2, money: 99999,
      employees: [{ role: 'ninja', name: 'X', level: 0, exp: 0, salary: 2000 },
                  { role: 'coder', name: 'سالم', level: 1, exp: 12, salary: 3000 }] });
    const opened = await page.evaluate(() => { try { window.OpenEmps(); return 'ok'; } catch (e) { return 'threw: ' + e.message; } });
    await page.waitForTimeout(400);
    const roster = await page.evaluate(() => document.querySelectorAll('#empContent .empcard').length);
    checks['unknown employee role does not throw'] = opened === 'ok';
    note['unknown employee role does not throw'] = opened;
    checks['valid employees survive the filter'] = roster === 1;
    note['valid employees survive the filter'] = `${roster} card(s)`;
    checks['bad-role import raises no JS error'] = errors.length === 0;
    await page.close();
  }

  // ---- 8. Garbage / hostile numeric values must not poison the economy ----
  {
    const { page, errors } = await boot({ save: null });
    await importInto(page, { ...REAL_SAVE, money: 'NaN', fn: -50, st: 99, bs: 4000,
      morale: 900, year: -3, sl: { design: 99, code: 99, sound: 99 },
      research: { points: 'x', unlocked: ['engine', 'not-a-node'] } });
    const state = await page.evaluate(() => ({
      money: document.getElementById('dm').textContent,
      remaining: document.getElementById('dpl').textContent,
      cost: document.getElementById('dcc').textContent,
    }));
    checks['NaN money is coerced'] = !/NaN/.test(state.money);
    checks['over-cap points are clamped'] = Number(state.remaining) >= 0;
    checks['cost stays finite'] = !/NaN|Infinity/.test(state.cost);
    note['cost stays finite'] = JSON.stringify(state);
    checks['hostile-values import raises no JS error'] = errors.length === 0;
    note['hostile-values import raises no JS error'] = errors.slice(0, 2).join(' | ');
    await page.close();
  }

  // ---- 9. A pre-versioning (v1) save must migrate all the way to v5 ----
  {
    const { page, errors } = await boot({ save: null });
    await importInto(page, { money: 40000, fn: 300, gc: 6, st: 1, bs: 7.5, pm: 40000, hs: 6,
      sl: { design: 4, code: 4, sound: 4 }, hist: [{ name: 'قديمة', score: 7 }], ach: ['f'] });
    const migrated = await read(page);
    checks['v1 save migrates to the current version'] = !!migrated && migrated.saveVersion === 5;
    checks['v1 migration fills in the new fields'] =
      !!migrated && !!migrated.marketTaste && Array.isArray(migrated.tips) && Array.isArray(migrated.rivals) && migrated.rivals.length === 4;
    note['v1 migration fills in the new fields'] = migrated ? `taste=${!!migrated.marketTaste} tips=${JSON.stringify(migrated.tips)} rivals=${migrated.rivals.length}` : 'null';
    checks['v1 migration raises no JS error'] = errors.length === 0;
    note['v1 migration raises no JS error'] = errors.slice(0, 2).join(' | ');
    await page.close();
  }

  // ---- 10. A corrupt file must be refused and leave the run untouched ----
  {
    const { page, errors } = await boot({ save: REAL_SAVE });
    const chooser = page.waitForEvent('filechooser');
    await page.evaluate(() => window.importSave());
    const bad = path.join(tmpDir, 'corrupt.txt');
    fs.writeFileSync(bad, 'this is definitely not a save file at all');
    (await chooser).setFiles(bad);
    await page.waitForTimeout(800);
    const stage = await page.locator('#ds').textContent();
    checks['corrupt file leaves the run intact'] = /استوديو/.test(stage);
    note['corrupt file leaves the run intact'] = `stage="${stage.trim()}"`;
    checks['corrupt file is reported to the player'] = (page.__dialogs || []).some(m => /تالف|مرفوض|صالح/.test(m));
    note['corrupt file is reported to the player'] = JSON.stringify(page.__dialogs || []);
    checks['corrupt file raises no JS error'] = errors.length === 0;
    await page.close();
  }

  // ---- 11. Session-only fields must never reach disk ----
  // The game state object is module-scoped and deliberately not exposed on window,
  // so the only way to inject a session-only field is through a save file. (That
  // the injection below cannot be done directly from page context is itself the
  // property we want.) The no-underscore invariant on ordinary play is covered by
  // tests/smoke.mjs; this pins the import path.
  {
    const { page } = await boot({ save: REAL_SAVE });
    await importInto(page, { ...REAL_SAVE, _sneaky: 1, _sequelMode: true, _pendingGOTY: true });
    const after = await read(page);
    checks['underscore fields are stripped on import'] = !!after && !Object.keys(after).some(k => k[0] === '_');
    note['underscore fields are stripped on import'] = after ? Object.keys(after).filter(k => k[0] === '_').join(',') || 'none' : 'null';
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

let ok = true;
for (const [name, pass] of Object.entries(checks)) {
  console.log(`${pass ? '✓' : '✗'} ${name}${!pass && note[name] ? `\n    → ${note[name]}` : ''}`);
  if (!pass) ok = false;
}
console.log('\n' + (ok ? 'SAVE INTEGRITY PASS' : 'SAVE INTEGRITY FAIL'));
process.exit(ok ? 0 : 1);
