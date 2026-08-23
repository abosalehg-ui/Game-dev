/**
 * Event-text regression test for "من الغرفة للقمة".
 *
 * The world events share a small set of `type`s whose magnitudes live in
 * BALANCE, but each event used to carry its own hand-written copy of the number
 * in its description. Four of them had drifted:
 *
 *   موسم رمضان   said -30%   and applied -40%   (BALANCE.sales.recession = 0.6)
 *   موسم الرياض  said +60%   and applied +50%   (BALANCE.sales.publisher = 1.5)
 *   استراحة قهوة said +1.5   and applied +1     (BALANCE.score.festivalBonus = 1)
 *   مشكلة سيرفر  said 15%    and took 20%       (BALANCE.events.hackMoneyLoss)
 *
 * Every screen in this game is a budgeting decision, so a wrong number in an
 * event is a wrong number in the player's arithmetic. The descriptions are now
 * templates filled from the same constants the effects read.
 *
 * This asserts the two things that keep it that way:
 *   - no event renders with an unresolved {token} left in it,
 *   - every rendered number equals the constant, recomputed independently here
 *     rather than compared against a hard-coded expected string (which would just
 *     be the old duplicated-number problem wearing a test's clothes).
 *
 * Run: `npm run test:events`. Set CHROME_PATH to override the browser binary.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.woff2':'font/woff2' };

const patched = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(
  /<\/script>\s*<\/body>/,
  `
window.__ev={
  // Rendered text for every event, with the run-specific tokens stubbed so only
  // the balance-driven ones are under test.
  all:()=>EVENTS.map(e=>({
    title:e.title, type:e.type, template:e.desc,
    text:describeEvent(e,{topic:'🚀 فضاء',rival:'🏢 منافس'}),
  })),
  balance:()=>({sales:BALANCE.sales,score:BALANCE.score,events:BALANCE.events}),
  // What getDevCost() actually multiplies by when the burned-PCs event is live.
  strikeCost:()=>{
    S.st=0;S.difficulty='normal';S.platforms=['pc'];S.sl={design:3,code:4,sound:3};
    S.research={points:0,unlocked:[]};S.engineVersion=0;S._sequelMode=false;
    S.em=null; const before=getDevCost();
    S.em='strike'; const after=getDevCost();
    S.em=null; return after/before;
  },
};
</script>
</body>`);
if (!patched.includes('window.__ev')) { console.error('could not inject the event hook'); process.exit(1); }

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(patched); return; }
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
await page.goto(`http://localhost:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('gd_save'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.click('#bst');
await page.waitForTimeout(700);

const events = await page.evaluate(() => window.__ev.all());
const B = await page.evaluate(() => window.__ev.balance());
const strikeCost = await page.evaluate(() => window.__ev.strikeCost());

const checks = {};
const note = {};
const summary = [];

// Independently derived here from the balance values the page reported. Written
// out longhand rather than importing the game's formatter, so a bug in the
// formatter is something this test can see rather than something it inherits.
function expectedFor(type) {
  const E = B.events;
  const asMult = m => (m >= 2 || m <= 0.5) ? '×' + +m.toFixed(2)
    : (Math.round((m - 1) * 100) > 0 ? '+' : '') + Math.round((m - 1) * 100) + '%';
  const signed = n => (n > 0 ? '+' : n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('en-US');
  const dec = n => (n > 0 ? '+' : n < 0 ? '-' : '') + (+Math.abs(n).toFixed(1));
  const pct = n => (n > 0 ? '+' : n < 0 ? '-' : '') + Math.round(Math.abs(n) * 100) + '%';
  switch (type) {
    case 'trend':      return { sales: asMult(B.sales.trend) };
    case 'recession':  return { sales: asMult(B.sales.recession) };
    case 'publisher':  return { sales: asMult(B.sales.publisher) };
    case 'piracy':     return { sales: asMult(B.sales.piracy) };
    case 'festival':   return { score: dec(B.score.festivalBonus) };
    case 'quit':       return { score: dec(-B.score.quitPenalty) };
    case 'strike':     return { cost: '×' + E.strikeCostMult };
    case 'hack':       return { costPct: Math.round(E.hackMoneyLoss * 100) + '%' };
    case 'competitor': return { fansPct: pct(-E.competitorFanLoss) };
    case 'award':      return { fans: signed(E.awardFans) };
    case 'viral':      return { fans: signed(E.viralFans) };
    case 'youtuber':   return { fans: signed(E.youtuberFans) };
    case 'gift':       return { money: signed(E.giftMoney) };
    case 'moraleUp':   return { morale: signed(E.moraleUp) };
    case 'moraleDown': return { morale: signed(E.moraleDown) };
    default:           return {};
  }
}

const unresolved = events.filter(e => /\{\w+\}/.test(e.text));
checks['no event renders with an unresolved token'] = unresolved.length === 0;
note['no event renders with an unresolved token'] = unresolved.length
  ? unresolved.map(e => `${e.title} → ${e.text}`).join(' | ')
  : `${events.length} events rendered clean`;

const wrong = [];
for (const e of events) {
  const want = expectedFor(e.type);
  for (const [token, value] of Object.entries(want)) {
    // Only assert on tokens the template actually uses: not every event of a type
    // quotes its number (عرض استحواذ deliberately stays vague).
    if (!e.template.includes(`{${token}}`)) continue;
    if (!e.text.includes(value)) wrong.push(`${e.title} [${e.type}/${token}] expected "${value}" — got "${e.text}"`);
  }
  summary.push(`${e.title.padEnd(26)} ${e.text}`);
}
checks['every event quotes the number the balance table holds'] = wrong.length === 0;
note['every event quotes the number the balance table holds'] = wrong.length ? wrong.join(' | ') : `${events.length} events checked against BALANCE`;

// The burned-PCs event is the one whose magnitude is applied somewhere other than
// triggerEvent(), so its text and its effect can drift independently of the rest.
checks['the burned-PCs event costs what its text says'] = Math.abs(strikeCost - B.events.strikeCostMult) < 1e-9;
note['the burned-PCs event costs what its text says'] = `getDevCost() multiplied by ${strikeCost}, text quotes ×${B.events.strikeCostMult}`;

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
console.log('\n' + (ok ? 'EVENT TEXT PASS' : 'EVENT TEXT FAIL'));
process.exit(ok ? 0 : 1);
