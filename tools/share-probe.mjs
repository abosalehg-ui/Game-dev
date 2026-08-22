/**
 * Market-share probe for "من الغرفة للقمة".
 *
 * Answers one question that tools/balance-sim.mjs structurally cannot: is the
 * "متصدر السوق (25%)" achievement actually reachable?
 *
 * The sim models base game releases only — by its own admission it leaves out
 * DLC, sequels, conventions and the 2,000 fans a Game of the Year win pays. Those
 * are exactly the fan sources that would decide the question, so the sim's ~17%
 * plateau is a floor, not a verdict. This drives the REAL game in a browser
 * instead, playing it the way a competent player would, and reports the share the
 * achievement is actually checked against.
 *
 * It is a measurement tool, not a gate: it takes minutes, and the answer moves
 * whenever the balance does. Run it after touching fan income, rival growth, or
 * the achievement threshold.
 *
 *   node tools/share-probe.mjs             # 70 releases
 *   node tools/share-probe.mjs 120         # longer run
 *
 * Set CHROME_PATH to override the browser binary.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = Number(process.argv[2] || 70);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.woff2':'font/woff2' };

// The game keeps its tables module-scoped and exposes only what the UI needs, so
// the probe injects its own hook rather than the file exporting internals to
// window for a tool's benefit. Same pattern as tools/shot-stages.mjs.
const patched = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(
  /<\/script>\s*<\/body>/,
  `
window.__probe={
  // The best genre/topic pairing available this turn, by the game's own synergy
  // table, with this year's hot topics weighted in — i.e. play it properly.
  pickBest:()=>{
    const buttons=[...document.querySelectorAll('#gr .sb2')].filter(x=>!x.disabled&&!x.classList.contains('lock'));
    if(!buttons.length)return false;
    let best=null;
    buttons.forEach(btn=>{
      const g=GENRES.find(x=>btn.textContent.includes(x.name));
      if(!g)return;
      for(const t of REAL_TOPICS){
        const hot=(S.marketTaste&&(S.marketTaste.hot||[]).includes(t.id))?1.5:0;
        const score=synergyFor(g.id,t.id)+hot;
        if(!best||score>best.score)best={btn,topic:t,score};
      }
    });
    if(!best)return false;
    best.btn.click();
    const words=TOPIC_WORDS[best.topic.id];
    const el=document.getElementById('gni');
    el.value=words[(Math.random()*words.length)|0]+' الأبطال';
    el.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  },
  // Allocate the point budget to the genre's ideal split for this year.
  aimPoints:()=>{
    const genre=GENRES.find(x=>x.id===S.genre);
    if(!genre)return false;
    const ideal=idealFor(genre), cap=STG[S.st].maxPts;
    const raw=ideal.map(p=>Math.max(1,Math.round(cap*p/100)));
    let total=raw[0]+raw[1]+raw[2];
    while(total>cap){const i=raw.indexOf(Math.max(...raw));raw[i]--;total--;}
    S.sl={design:raw[0],code:raw[1],sound:raw[2]};
    updateUI();
    return true;
  },
  // The exact expression the mkt40 achievement is evaluated with.
  snapshot:()=>{
    const r=S.rivals||[];
    const pw=Math.max(100,(S.fn||0)*1.2+100);
    return {
      gc:S.gc, st:S.st, year:S.year, fans:Math.round(S.fn||0),
      share:+(r.length?pw/(pw+r.reduce((a,x)=>a+x.fans,0))*100:0).toFixed(1),
      awards:(S.awards||[]).length, goty:S.gotyWins||0,
      ips:(S.ips||[]).length, employees:(S.employees||[]).length,
      hasMkt40:(S.ach||[]).includes('mkt40'),
    };
  },
};
</script>
</body>`);
if (!patched.includes('window.__probe')) { console.error('could not inject the probe hook'); process.exit(1); }

const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/index.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(patched); return; }
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { r.writeHead(404); r.end('nf'); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  r.end(fs.readFileSync(fp));
});
await new Promise(r => server.listen(0, r));

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const pg = await browser.newPage();
const errs = [];
pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
pg.on('dialog', async d => { await d.accept(); });
await pg.goto(`http://localhost:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
await pg.evaluate(() => localStorage.removeItem('gd_save'));
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1200);
await pg.click('#bst');
await pg.waitForTimeout(600);

const topModal = () => pg.evaluate(() => { const e = document.querySelector('.os.show:not(#sp)'); return e ? e.id : null; });

// A competent player, not a random one: take every fan-bearing opportunity.
async function handle(id) {
  if (id === 'prodModal') {
    // Prefer the option that raises the review score, since score drives both
    // sales and fans; fall back to whatever is affordable.
    await pg.locator('#prodOpts button:not([disabled])').first().click();
  } else if (id === 'mktModal') {
    // Largest campaign we can afford — marketing hype converts directly to fans.
    await pg.evaluate(() => {
      const opts = [...document.querySelectorAll('#mktModal .mkt-opt')].filter(o => !o.classList.contains('dis'));
      if (opts.length) opts[opts.length - 1].click(); else window.ChooseMkt('none');
    });
  } else if (id === 'qaModal') {
    // Full QA when it is affordable: +0.4 review score and no bugs.
    await pg.evaluate(() => {
      const opts = [...document.querySelectorAll('#qaModal .qa-opt')].filter(o => !o.classList.contains('dis'));
      if (opts.length) opts[opts.length - 1].click(); else window.ChooseQA('normal');
    });
  } else if (id === 'sr2') await pg.evaluate(() => window.nextGame());
  else if (id === 'se') await pg.evaluate(() => window.closeEvent());
  else if (id === 'su') await pg.evaluate(() => window.doUpgrade());
  else if (id === 'conventionModal') {
    // Conventions are a fan source the sim ignores entirely — take the richest.
    await pg.evaluate(() => {
      const opts = [...document.querySelectorAll('#convOpts button:not([disabled])')];
      if (opts.length) opts[opts.length - 1].click(); else window.SkipConv();
    });
  } else if (id === 'contractModal') await pg.evaluate(() => window.AcceptContract());
  else if (id === 'loanModal') await pg.evaluate(() => window.TakeLoan(0.5));
  else if (id === 'sg2') await pg.evaluate(() => window.restartGame());
  // Keep playing after the ending rather than prestiging, so the probe measures
  // one continuous studio rather than restarting mid-measurement.
  else if (id === 'vicModal') await pg.evaluate(() => window.continueAfterWin());
  else await pg.evaluate(mid => document.getElementById(mid).classList.remove("show"), id);
  await pg.waitForTimeout(120);
}

async function settle(budgetMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    const id = await topModal();
    if (id) { await handle(id); continue; }
    if (await pg.evaluate(() => document.getElementById('sp').classList.contains('show'))) { await pg.waitForTimeout(120); continue; }
    if (await pg.evaluate(() => document.getElementById('mp').classList.contains('open'))) return true;
    await pg.waitForTimeout(120);
  }
  return false;
}

// Buy every fan-multiplying research node and hire whoever is affordable —
// both feed the fan curve the achievement is measured on.
async function invest() {
  await pg.evaluate(() => {
    try {
      window.OpenResearch();
      const buys = [...document.querySelectorAll('#resList button:not([disabled])')];
      buys.forEach(b => b.click());
      window.CloseResearch();
    } catch (_) {}
    try {
      window.OpenEmps();
      const hires = [...document.querySelectorAll('#empContent button:not([disabled])')]
        .filter(b => /وظّف/.test(b.textContent));
      hires.slice(0, 3).forEach(b => b.click());
      window.CloseEmps();
    } catch (_) {}
  });
  await pg.waitForTimeout(120);
  // Investing can leave a modal up; clear it before the next release.
  const id = await topModal();
  if (id) await handle(id);
}

const trace = [];
let stopped = null;

for (let g = 1; g <= GAMES; g++) {
  if (!await settle(30000)) { stopped = 'settle timeout before game ' + g; break; }
  if (g % 3 === 0) await invest();
  if (!await settle(20000)) { stopped = 'settle timeout after investing at ' + g; break; }

  const ready = await pg.evaluate(() => window.__probe.pickBest());
  if (!ready) { stopped = 'no selectable genre at game ' + g; break; }
  await pg.waitForTimeout(220);
  await pg.evaluate(() => window.__probe.aimPoints());
  await pg.waitForTimeout(120);

  if (!await pg.locator('#bdev').isEnabled()) {
    if (await pg.locator('#scopeTrim').isVisible()) { await pg.evaluate(() => window.trimScope()); await pg.waitForTimeout(180); }
  }
  if (!await pg.locator('#bdev').isEnabled()) {
    if (await pg.locator('#bfree').isVisible()) {
      await pg.evaluate(() => window.freelance());
      if (!await settle(20000)) { stopped = 'freelance never settled at ' + g; break; }
      continue;
    }
    stopped = 'development unavailable at game ' + g;
    break;
  }
  await pg.click('#bdev');
  if (!await settle(30000)) { stopped = 'release never settled at game ' + g; break; }

  const snap = await pg.evaluate(() => window.__probe.snapshot());
  trace.push(snap);
}

const final = trace[trace.length - 1] || {};
const peak = trace.reduce((a, t) => (t.share > (a.share ?? -1) ? t : a), {});
const unlocked = trace.some(t => t.hasMkt40);

await browser.close();
server.close();

console.log(`\n=== market-share probe: ${trace.length} releases, competent play ===`);
console.log('  release   stage  year   fans    share   awards  GOTY');
for (const t of trace) {
  if (t.gc % 5 !== 0 && t !== final) continue;
  console.log(
    String(t.gc).padStart(9),
    String(t.st).padStart(6),
    String(t.year).padStart(5),
    String(t.fans).padStart(7),
    (t.share + '%').padStart(8),
    String(t.awards).padStart(7),
    String(t.goty).padStart(5),
  );
}
console.log(`\npeak share ${peak.share}% at release ${peak.gc}; final ${final.share}% with ${final.awards} awards and ${final.goty} GOTY wins`);
console.log(`متصدر السوق (25%) achievement unlocked during the run: ${unlocked ? 'YES' : 'NO'}`);
if (stopped) console.log('stopped: ' + stopped);
if (errs.length) console.log('JS errors:\n' + errs.slice(0, 5).join('\n'));
