/**
 * Formula unit tests for "من الغرفة للقمة".
 *
 * computeScore(), computeSales(), getDevCost() and their helpers were only ever
 * exercised incidentally, through a whole release in the smoke test, and the
 * balance simulation re-implemented them in Node — a parallel implementation,
 * not a check. This suite calls the REAL functions inside the running game
 * (through the same injected-hook pattern the other suites use) and pins the
 * properties the balance depends on:
 *
 *   - the score curve is continuous and monotonic in "how far you beat your
 *     own record", with no step where +0.01 pays what +5 pays;
 *   - every score lands in [1,10] whatever the inputs;
 *   - revenue rises with the review average and with fans, but fans past the
 *     soft cap count at the tail rate — the multiplier is no longer unbounded;
 *   - the strike event doubles the development cost by exactly its constant;
 *   - the constants tools/balance-sim.mjs parses out of index.html are the ones
 *     the game is actually running on.
 *
 * Run: `npm run test:formulas`. Set CHROME_PATH to override the browser binary.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readSalesModel, readRevenueSlope, effectiveFans as simEffectiveFans } from '../tools/balance-constants.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.woff2':'font/woff2' };

const patched = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(
  /<\/script>\s*<\/body>/,
  `
window.__f={
  balance:()=>JSON.parse(JSON.stringify({score:BALANCE.score,sales:BALANCE.sales,events:BALANCE.events})),
  curve:(d2)=>scoreCurve(d2),
  effectiveFans:(fn)=>effectiveFans(fn),
  // A neutral studio: no research, no employees, no events, fixed sliders.
  neutral:(o)=>{
    o=o||{};
    S.st=o.st??2; S.hs=o.hs??5; S.em=null; S.morale=75; S.qaMode='normal'; S._prodScoreBonus=0;
    S.research={points:0,unlocked:[]}; S.employees=[]; S.engineVersion=0;
    S.fn=o.fn??0; S.prestige={level:0}; S.marketing={hype:0,campaign:null,cost:0,bonus:0};
    S.platforms=['pc']; S.difficulty='normal'; S.loan=null;
    S.rivals=(S.rivals||[]).map(r=>({...r,fans:1000}));
    const mx=STG[S.st].maxPts; S.sl={design:Math.floor(mx*0.4),code:Math.floor(mx*0.4),sound:mx-2*Math.floor(mx*0.4)};
  },
  rel:(genreId,topicId)=>({genre:GENRES.find(g=>g.id===genreId),topic:TOPICS.find(t=>t.id===topicId),eggKey:null,egg:null,parentIP:null}),
  score:(genreId,topicId)=>{const hs=S.hs;const r=computeScore(window.__f.rel(genreId,topicId));S.hs=hs;return r;},
  sales:(avg,fn,genreId,topicId)=>{S.fn=fn;const em=S.em;const r=computeSales(window.__f.rel(genreId,topicId),{avg,scores:[avg,avg,avg,avg],bugCount:0,sequelInfo:null,bonus:skillBonuses()});S.em=em;return r;},
  devCost:()=>getDevCost(),
  withEvent:(type,fn)=>{S.em=type;try{return fn==='cost'?getDevCost():null}finally{S.em=null}},
  stageRevenue:(i)=>BALANCE.sales.stageRevenue(i),
};
</script>
</body>`);
if (!patched.includes('window.__f')) { console.error('could not inject the formula hook'); process.exit(1); }

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
await page.goto(`http://localhost:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('gd_save'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__f && document.getElementById('bst'));
await page.click('#bst');
await page.waitForFunction(() => document.getElementById('ss').style.display === 'none');

const checks = {};
const note = {};
const B = await page.evaluate(() => window.__f.balance());

// ---- 1. Score curve: continuous, monotonic, bounded ----
{
  const xs = []; for (let d = -4; d <= 3; d += 0.05) xs.push(+d.toFixed(2));
  const ys = await page.evaluate(xs => xs.map(x => window.__f.curve(x)), xs);
  let monotonic = true, maxJump = 0;
  for (let i = 1; i < ys.length; i++) { if (ys[i] < ys[i - 1] - 1e-9) monotonic = false; maxJump = Math.max(maxJump, ys[i] - ys[i - 1]); }
  checks['score curve never decreases as you beat your record by more'] = monotonic;
  // A 0.05 step in d2 may move the score by at most the steepest segment's slope × 0.05 — no cliffs.
  const steepest = Math.max(...B.score.curve.slice(1).map(([x, y], i) => (y - B.score.curve[i][1]) / (x - B.score.curve[i][0])));
  checks['score curve has no step (continuous)'] = maxJump <= steepest * 0.05 + 1e-6;
  note['score curve has no step (continuous)'] = `largest move per 0.05 of d2: ${maxJump.toFixed(3)} (steepest slope ${steepest.toFixed(2)})`;
  checks['score curve is clamped at both ends'] = ys[0] === B.score.curve[0][1] && ys[ys.length - 1] === B.score.curve[B.score.curve.length - 1][1];
}

// ---- 2. computeScore stays inside [1,10] across the whole record range ----
{
  const out = await page.evaluate(() => {
    const res = [];
    for (const hs of [-5, 0, 3, 5, 7, 9, 12, 20]) {
      window.__f.neutral({ hs });
      for (let i = 0; i < 25; i++) { const r = window.__f.score('action', 'space'); res.push({ hs, avg: r.avg, raw: r.raw, scores: r.scores }); }
    }
    return res;
  });
  const bad = out.filter(r => !(r.avg >= 1 && r.avg <= 10) || r.scores.some(s => s < 1 || s > 10));
  checks['every review score is within [1,10]'] = bad.length === 0;
  note['every review score is within [1,10]'] = bad.length ? JSON.stringify(bad[0]) : `${out.length} samples`;
  // Beating a low record should, on average, score higher than trailing a high one.
  const mean = hs => { const v = out.filter(r => r.hs === hs).map(r => r.avg); return v.reduce((a, b) => a + b, 0) / v.length; };
  checks['beating your record scores higher on average than trailing it'] = mean(0) > mean(12);
  note['beating your record scores higher on average than trailing it'] = `mean avg at hs=0: ${mean(0).toFixed(2)}, at hs=12: ${mean(12).toFixed(2)}`;
}

// ---- 3. Sales: rise with the average, and the fan multiplier has a knee ----
{
  const r = await page.evaluate(() => {
    window.__f.neutral({ st: 2 });
    const at = (avg, fn) => window.__f.sales(avg, fn, 'action', 'space').rev;
    return { a5: at(5, 0), a7: at(7, 0), a9: at(9, 0), f0: at(8, 0), fCap: at(8, 20000), f2: at(8, 40000), f10: at(8, 200000),
             eff: [0, 20000, 40000, 200000].map(x => window.__f.effectiveFans(x)) };
  });
  checks['revenue rises with the review average'] = r.a5 < r.a7 && r.a7 < r.a9;
  note['revenue rises with the review average'] = `avg5=${r.a5} avg7=${r.a7} avg9=${r.a9}`;
  checks['fans still help past the soft cap, but at the tail rate'] = r.fCap > r.f0 && r.f2 > r.fCap && r.f10 > r.f2;
  // The second 20k fans must pay far less than the first. Not exactly fanTail
  // of it: fans also lift market share (shareFloor + share × shareRange), so
  // the measured ratio sits a little above the tail rate. The exact knee is
  // pinned on effectiveFans() below; here the property is "diminishing".
  const belowGain = r.fCap - r.f0, aboveGain = r.f2 - r.fCap;
  checks['the second 20k fans pay a fraction of the first'] = aboveGain / belowGain >= B.sales.fanTail && aboveGain / belowGain < B.sales.fanTail + 0.1;
  note['the second 20k fans pay a fraction of the first'] = `gain below cap ${belowGain}, above ${aboveGain}, ratio ${(aboveGain / belowGain).toFixed(3)} (fanTail ${B.sales.fanTail}, plus market-share lift)`;
  // The old unbounded multiplier at 200k fans was ×401; it must now be well under half of that.
  const uncapped = 1 + 200000 * B.sales.fanWeight;
  checks['200k fans multiply revenue by well under half the old unbounded factor'] = r.f10 / r.f0 < uncapped * 0.5;
  note['200k fans multiply revenue by well under half the old unbounded factor'] = `×${(r.f10 / r.f0).toFixed(1)} (was ×${uncapped.toFixed(0)} before the cap)`;
  checks['effectiveFans matches the sim mirror'] = [0, 20000, 40000, 200000].every((x, i) => Math.abs(r.eff[i] - simEffectiveFans(x)) < 1e-6);
}

// ---- 4. getDevCost: the strike event multiplies by its BALANCE constant ----
{
  const r = await page.evaluate(() => { window.__f.neutral({ st: 2 }); return { base: window.__f.devCost(), strike: window.__f.withEvent('strike', 'cost') }; });
  checks['strike multiplies the dev cost by BALANCE.events.strikeCostMult'] = Math.abs(r.strike / r.base - B.events.strikeCostMult) < 1e-9;
  note['strike multiplies the dev cost by BALANCE.events.strikeCostMult'] = `${r.base} → ${r.strike} (×${(r.strike / r.base).toFixed(2)})`;
}

// ---- 5. The sim's parsed constants are the game's constants ----
{
  const parsed = readSalesModel();
  const slope = readRevenueSlope();
  const pageSlope = await page.evaluate(() => [0, 1, 5].map(i => window.__f.stageRevenue(i)));
  const same = Object.keys(parsed).every(k => Math.abs(parsed[k] - B.sales[k]) < 1e-12);
  checks['balance-sim parses the same sales constants the game runs on'] = same;
  note['balance-sim parses the same sales constants the game runs on'] = Object.keys(parsed).map(k => `${k}=${parsed[k]}${parsed[k] === B.sales[k] ? '' : '≠' + B.sales[k]}`).join(' ');
  checks['balance-sim parses the same stage-revenue slope'] = [0, 1, 5].every((i, j) => Math.abs(slope.base + i * slope.perStage - pageSlope[j]) < 1e-12);
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
console.log('\n' + (ok ? 'FORMULAS PASS' : 'FORMULAS FAIL'));
process.exit(ok ? 0 : 1);
