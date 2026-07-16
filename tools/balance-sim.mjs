/**
 * Economic balance simulation for "من الغرفة للقمة".
 *
 * Re-implements the game's core money/fan/rival formulas (kept in sync with
 * index.html's finishDevelopment / TickRivals) so we can reason about pacing
 * WITHOUT playing hundreds of real games. It models a "competent player":
 * good genre/topic combos, sensible slider spread, PC-only, reinvesting.
 *
 * It reports, per office stage:
 *   - average revenue per game,
 *   - how many games it takes to afford the upgrade,
 * and it tracks the player's market share vs the four AI rivals over time.
 *
 * Run: `node tools/balance-sim.mjs`
 * Use the output to size STG[].upgCost and the rival fan-growth curve.
 */

// ---- constants mirrored from index.html ----
const STG = [
  { name: 'bedroom',     devCost: 5000,    upgCost: 50000 },
  { name: 'garage',      devCost: 10000,   upgCost: 100000 },
  { name: 'smallOffice', devCost: 20000,   upgCost: 4000000 },
  { name: 'studio',      devCost: 300000,  upgCost: 20000000 },
  { name: 'company',     devCost: 800000,  upgCost: 100000000 },
  { name: 'skyscraper',  devCost: 2000000, upgCost: Infinity },
];

// Optional override of upgrade costs (pass values to compare a proposed curve).
const upgCostOverride = process.argv[2]
  ? process.argv[2].split(',').map(Number)
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

// Rival fan growth — set RIVAL_TUNE to test a rubber-banded variant against the player.
function tickRivals(rivals, year, playerShare, playerFans, tune) {
  rivals.forEach((r) => {
    if (Math.random() < 0.65) {
      const score = Math.max(1, Math.min(10, r.quality + (Math.random() + Math.random() + Math.random() - 1.5) * 0.8));
      let gain;
      if (score >= 7) gain = score * 120;
      else if (score < 5) gain = -r.fans * 0.05;
      else gain = score * 40;
      if (tune) {
        // Proposed: a genuinely dominant player (far more fans than the average
        // rival) slows rival fan accumulation, so consistent quality lets share
        // climb instead of eroding. A trailing player gets no free help.
        const avgRival = rivals.reduce((a, x) => a + x.fans, 0) / rivals.length;
        const dom = playerFans / (playerFans + avgRival);
        if (dom > 0.5) gain *= Math.max(0.3, 1 - (dom - 0.5) * 1.6);
      }
      r.fans = Math.max(500, r.fans + Math.floor(gain));
    }
    const target = 5 + year * 0.25;
    r.quality += (target - r.quality) * 0.06;
    if (playerShare > 0.5) r.quality += 0.1;
    else if (playerShare < 0.15) r.quality -= 0.05;
    r.quality = Math.max(3, Math.min(9.5, r.quality));
  });
}

function simulate({ tuneRivals = false, upgCosts = null } = {}) {
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

    const devCost = stages[st].devCost;
    money -= devCost;

    // Competent player: average review ~8, occasional 9.
    const avg = Math.min(10, 7.6 + Math.random() * 1.6);
    let sales = Math.pow(avg, 2.5) * 100 * (1 + fn * 0.002);
    sales *= 0.9 + share * 0.4; // market-share multiplier
    const rev = Math.floor(sales * (1.5 + st * 1.0));
    money += rev;
    fn = Math.max(0, fn + Math.floor(playerFanGain(avg)));

    perStage[st].games++;
    perStage[st].revenue += rev;
    gameCount++; gamesThisYear++;
    if (gamesThisYear >= 4) { gamesThisYear = 0; year++; }

    tickRivals(rivals, year, share, Math.max(100, fn * 1.2 + 100), tuneRivals);
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
  console.log('stage        avg games   avg rev/game   upgrade cost');
  agg.forEach((s, i) => {
    const g = s.games / RUNS;
    const rpg = s.games ? s.revenue / s.games : 0;
    const uc = (opts.upgCosts ? opts.upgCosts[i] : STG[i].upgCost);
    console.log(
      STG[i].name.padEnd(12),
      g.toFixed(1).padStart(6),
      '   ',
      Math.round(rpg).toLocaleString('en-US').padStart(11),
      '   ',
      (uc === Infinity ? '—' : uc.toLocaleString('en-US')).padStart(12)
    );
  });
  console.log(`reached skyscraper: ${reached}/${RUNS} runs, avg total games ${(totalGames / RUNS).toFixed(0)}`);
  console.log('player market share % over time (one run):');
  console.log('  ' + lastTrace.filter((_, i) => i % 3 === 0).map(t => `g${t.game}:${t.share}%`).join('  '));
}

// NB: this sim models BASE games only. Real income also comes from DLC, sequels,
// GOTY awards, publisher contracts and conventions, so real games-per-stage runs
// ~30-40% below these figures. We therefore target a slightly-loose sim pace.
const PROPOSED = upgCostOverride || [50000, 120000, 800000, 3500000, 18000000, Infinity];
report('CURRENT constants', { tuneRivals: false });
report('PROPOSED upgrade curve', { tuneRivals: false, upgCosts: PROPOSED });
report('PROPOSED curve + dominance-damped rivals', { tuneRivals: true, upgCosts: PROPOSED });
