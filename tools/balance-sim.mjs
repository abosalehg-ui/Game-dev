/**
 * Economic balance simulation for "من الغرفة للقمة".
 *
 * Re-implements the game's core money/fan/rival formulas so we can reason about
 * pacing WITHOUT playing hundreds of real games. It models a "competent player":
 * good genre/topic combos, sensible slider spread, PC-only, reinvesting.
 *
 * It reports, per office stage:
 *   - average revenue per game,
 *   - how many games it takes to afford the upgrade,
 * and it tracks the player's market share vs the four AI rivals over time.
 *
 * The stage table is PARSED OUT OF index.html rather than duplicated here. The
 * previous copy had drifted: its "CURRENT" block still held the pre-2024 curve
 * (garage 100K, smallOffice 4M, studio 20M, company 100M) while the game shipped
 * 120K/800K/3.5M/18M, so the tool was silently reporting on a build that no
 * longer existed. Anything mirrored from the game must be derived, not retyped.
 *
 * Run: `node tools/balance-sim.mjs`               — report the shipped curve
 *      `node tools/balance-sim.mjs 50000,120000,...` — compare a proposed curve
 * Use the output to size STG[].upgCost and the rival fan-growth curve.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- constants derived from index.html (single source of truth) ----
function readStages() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const block = html.match(/const STG=\[([\s\S]*?)\];/);
  if (!block) throw new Error('could not locate the STG table in index.html');
  const rows = [...block[1].matchAll(/\{name:'([^']+)'.*?devCost:(\d+).*?maxPts:(\d+).*?upgCost:([A-Za-z0-9]+)/g)];
  if (rows.length < 6) throw new Error(`parsed only ${rows.length} stages from index.html`);
  return rows.map(([, name, devCost, maxPts, upgCost]) => ({
    name,
    devCost: Number(devCost),
    maxPts: Number(maxPts),
    upgCost: upgCost === 'Infinity' ? Infinity : Number(upgCost),
  }));
}

// The per-stage revenue slope also lives in index.html (BALANCE.sales.stageRevenue).
// Parsed for the same reason as the stage table: a hand-copied duplicate drifts.
function readRevenueSlope() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/stageRevenue:\s*i\s*=>\s*([\d.]+)\s*\+\s*i\s*\*\s*([\d.]+)/);
  if (!m) throw new Error('could not locate BALANCE.sales.stageRevenue in index.html');
  return { base: Number(m[1]), perStage: Number(m[2]) };
}

// Short latin labels for the table, in stage order — the game's names are emoji + Arabic.
const LABELS = ['bedroom', 'garage', 'smallOffice', 'studio', 'company', 'skyscraper'];
const STG = readStages();
const REV = readRevenueSlope();

// Optional override of upgrade costs (pass values to compare a proposed curve).
const upgCostOverride = process.argv[2]
  ? process.argv[2].split(',').map((v) => (v.trim() === 'Infinity' ? Infinity : Number(v)))
  : null;

function initRivals() {
  return Array.from({ length: 4 }, () => ({
    quality: 4.5 + Math.random() * 1.5,
    fans: 1500 + Math.floor(Math.random() * 4500),
  }));
}

function playerFanGain(avg) {
  if (avg >= 9) return 200 + Math.random() * 300;
  if (avg >= 7) return 50 + Math.random() * 100;
  if (avg >= 5) return -10 + Math.random() * 30;
  return -(50 + Math.random() * 100);
}

// Rival fan growth. A genuinely dominant player (far more fans than the average
// rival) slows rival fan accumulation, so consistent quality lets share climb
// instead of eroding. A trailing player gets no free help.
function tickRivals(rivals, year, playerShare, playerFans) {
  rivals.forEach((r) => {
    if (Math.random() < 0.65) {
      const score = Math.max(1, Math.min(10, r.quality + (Math.random() + Math.random() + Math.random() - 1.5) * 0.8));
      let gain;
      if (score >= 7) gain = score * 120;
      else if (score < 5) gain = -r.fans * 0.05;
      else gain = score * 40;
      const avgRival = rivals.reduce((a, x) => a + x.fans, 0) / rivals.length;
      const dom = playerFans / (playerFans + avgRival);
      if (dom > 0.5) gain *= Math.max(0.3, 1 - (dom - 0.5) * 1.6);
      r.fans = Math.max(500, r.fans + Math.floor(gain));
    }
    const target = 5 + year * 0.25;
    r.quality += (target - r.quality) * 0.06;
    if (playerShare > 0.5) r.quality += 0.1;
    else if (playerShare < 0.15) r.quality -= 0.05;
    r.quality = Math.max(3, Math.min(9.5, r.quality));
  });
}

function simulate({ upgCosts = null } = {}) {
  const stages = STG.map((s, i) => ({ ...s, upgCost: upgCosts ? upgCosts[i] : s.upgCost }));
  let money = 10000, fn = 0, st = 0, year = 1, gamesThisYear = 0, gameCount = 0;
  const rivals = initRivals();
  const perStage = stages.map(() => ({ games: 0, revenue: 0 }));
  const shareTrace = [];

  const maxGames = 300;
  while (st < 5 && gameCount < maxGames) {
    const share = (() => {
      const pw = Math.max(100, fn * 1.2 + 100);
      const tot = pw + rivals.reduce((a, r) => a + r.fans, 0);
      return pw / tot;
    })();

    // A competent player scopes to roughly the free budget, so no surcharge.
    money -= stages[st].devCost;

    // Competent player: average review ~8, occasional 9.
    const avg = Math.min(10, 7.6 + Math.random() * 1.6);
    let sales = Math.pow(avg, 2.5) * 100 * (1 + fn * 0.002);
    sales *= 0.9 + share * 0.4; // market-share multiplier
    const rev = Math.floor(sales * (REV.base + st * REV.perStage));
    money += rev;
    fn = Math.max(0, fn + Math.floor(playerFanGain(avg)));

    perStage[st].games++;
    perStage[st].revenue += rev;
    gameCount++; gamesThisYear++;
    if (gamesThisYear >= 4) { gamesThisYear = 0; year++; }

    tickRivals(rivals, year, share, Math.max(100, fn * 1.2 + 100));
    if (gameCount % 4 === 0) shareTrace.push({ game: gameCount, share: +(share * 100).toFixed(1), fans: Math.floor(fn) });

    // Upgrade as soon as affordable (competent player reinvests immediately).
    if (money >= stages[st].upgCost) { money -= stages[st].upgCost; st++; }
  }

  return { perStage, shareTrace, reachedSkyscraper: st >= 5, totalGames: gameCount };
}

function report(label, opts) {
  // Average over several runs to smooth RNG.
  const RUNS = 40;
  const agg = STG.map(() => ({ games: 0, revenue: 0 }));
  let reached = 0, totalGames = 0;
  let lastTrace = [];
  for (let i = 0; i < RUNS; i++) {
    const r = simulate(opts);
    r.perStage.forEach((s, i2) => { agg[i2].games += s.games; agg[i2].revenue += s.revenue; });
    if (r.reachedSkyscraper) reached++;
    totalGames += r.totalGames;
    if (i === 0) lastTrace = r.shareTrace;
  }
  console.log(`\n=== ${label} ===`);
  console.log('stage        avg games   avg rev/game   upgrade cost   share of run');
  const total = agg.reduce((a, s) => a + s.games, 0) / RUNS;
  agg.forEach((s, i) => {
    const g = s.games / RUNS;
    const rpg = s.games ? s.revenue / s.games : 0;
    const uc = (opts.upgCosts ? opts.upgCosts[i] : STG[i].upgCost);
    console.log(
      (LABELS[i] || STG[i].name).padEnd(12),
      g.toFixed(1).padStart(6),
      '   ',
      Math.round(rpg).toLocaleString('en-US').padStart(11),
      '   ',
      (uc === Infinity ? '—' : uc.toLocaleString('en-US')).padStart(12),
      '   ',
      (total ? (g / total * 100).toFixed(0) + '%' : '—').padStart(5)
    );
  });
  console.log(`reached skyscraper: ${reached}/${RUNS} runs, avg total games ${total.toFixed(0)}`);
  console.log('player market share % over time (one run):');
  console.log('  ' + lastTrace.filter((_, i) => i % 3 === 0).map(t => `g${t.game}:${t.share}%`).join('  '));
}

// NB: this sim models BASE games only. Real income also comes from DLC, sequels,
// GOTY awards, publisher contracts and conventions, so real games-per-stage runs
// ~30-40% below these figures. We therefore target a slightly-loose sim pace.
//
// The pacing goal is that no single stage exceeds ~30% of the run. The previous
// curve put 28% in the studio and 56% in the company.
console.log(`stage revenue slope: ×${REV.base} + ${REV.perStage}/stage (from BALANCE.sales.stageRevenue)`);
report('SHIPPED curve (parsed from index.html)', {});
if (upgCostOverride) report('PROPOSED curve (from argv)', { upgCosts: upgCostOverride });
