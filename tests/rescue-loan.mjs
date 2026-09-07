/**
 * Rescue-loan flow regression test for "من الغرفة للقمة".
 *
 * When the studio is broke after a release, the post-release pipeline offers a
 * rescue loan before declaring bankruptcy. Taking it used to resume the pipeline
 * TWICE: CloseLoan() advances past tryBankruptcy when a rescue is pending, and
 * TakeLoan() advanced again on top of that. Every step from tryUpgrade onward
 * then ran a second time — two independent rolls of contract/convention/event,
 * two stacked modals, and an upgrade prompt against money already spent.
 *
 * This pins: one advance per accepted rescue, at most one modal open afterwards,
 * and the pipeline still resumes at all (declining the rescue ends the run).
 *
 * Run: `npm run test:rescue`. Set CHROME_PATH to override the browser binary.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.woff2':'font/woff2' };

// The hook wraps the module-scoped advance() so the test can count resumptions
// without the game exporting internals for a test's benefit. Same pattern as
// tests/endgame.mjs.
const patched = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(
  /<\/script>\s*<\/body>/,
  `
window.__rescue={
  advances:0,
  arm:()=>{
    // Broke, past the bedroom, no loan: exactly the state tryBankruptcy rescues.
    S.st=1; S.money=100; S.loan=null; S._pendingGOTY=false; S.gc=4;
    S.hist=[{name:'x',genre:'أكشن',topic:'فضاء',score:6,revenue:1,year:S.year}];
    const real=advance;
    advance=function(from){window.__rescue.advances++;return real(from);};
    buildRoom(S.st);updateUI();
  },
  // Run the pipeline from the top the way finishDevelopment() does.
  run:()=>advance(0),
  modals:()=>[...document.querySelectorAll('.os.show:not(#sp)')].map(e=>e.id),
  state:()=>({money:Math.round(S.money),loan:!!S.loan,advances:window.__rescue.advances,
              modals:[...document.querySelectorAll('.os.show:not(#sp)')].map(e=>e.id)}),
};
</script>
</body>`);
if (!patched.includes('window.__rescue')) { console.error('could not inject the rescue hook'); process.exit(1); }

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
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text())) errors.push('console: ' + m.text()); });
page.on('dialog', d => d.dismiss());
await page.goto(`http://localhost:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('gd_save'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__rescue && document.getElementById('bst'));
await page.click('#bst');
await page.waitForFunction(() => document.getElementById('ss').style.display === 'none');

const checks = {};
const note = {};

// ---- 1. A broke studio is offered the rescue loan, not bankruptcy ----
await page.evaluate(() => window.__rescue.arm());
await page.evaluate(() => window.__rescue.run());
await page.waitForTimeout(300);
let st = await page.evaluate(() => window.__rescue.state());
checks['a broke studio is offered a rescue loan'] = st.modals.includes('loanModal') && !st.modals.includes('sg2');
note['a broke studio is offered a rescue loan'] = `modals=${st.modals.join(',') || 'none'}`;
const advancesBefore = st.advances;

// ---- 2. Taking it resumes the pipeline exactly once ----
await page.evaluate(() => window.TakeLoan(0.5));
await page.waitForTimeout(600);
st = await page.evaluate(() => window.__rescue.state());
const resumed = st.advances - advancesBefore;
checks['taking the rescue loan resumes the pipeline exactly once'] = resumed === 1;
note['taking the rescue loan resumes the pipeline exactly once'] = `advance() ran ${resumed}× after TakeLoan`;
checks['the loan was actually granted'] = st.loan === true && st.money > 100;
note['the loan was actually granted'] = `money=${st.money}, loan=${st.loan}`;
checks['at most one modal is open after the rescue'] = st.modals.filter(id => id !== 'loanModal').length <= 1 && !st.modals.includes('loanModal');
note['at most one modal is open after the rescue'] = `modals=${st.modals.join(',') || 'none'}`;

checks['no JS runtime errors'] = errors.length === 0;
note['no JS runtime errors'] = errors.slice(0, 3).join(' | ');

await browser.close();
server.close();

let ok = true;
for (const [name, pass] of Object.entries(checks)) {
  console.log(`${pass ? '✓' : '✗'} ${name}${note[name] ? `  — ${note[name]}` : ''}`);
  if (!pass) ok = false;
}
console.log('\n' + (ok ? 'RESCUE LOAN PASS' : 'RESCUE LOAN FAIL'));
process.exit(ok ? 0 : 1);
