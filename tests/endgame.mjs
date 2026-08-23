/**
 * Endgame regression test for "من الغرفة للقمة".
 *
 * The skyscraper used to be the end of the content, not the end of the game: its
 * upgCost is Infinity, so past that point the numbers grew and nothing else
 * happened. There is now a finish line — run the top studio AND take Game of the
 * Year three years running — and this pins the parts of it that are easy to get
 * subtly wrong:
 *
 *   - the streak only counts CONSECUTIVE years; any year without a win resets it,
 *     otherwise "three in a row" quietly means "three, eventually",
 *   - the ending needs the top stage as well as the streak,
 *   - it fires once per run, not on every release afterwards,
 *   - both exits work, and "keep playing" leaves the studio intact,
 *   - a save written before the ending existed migrates without being handed
 *     a streak it never earned.
 *
 * Run: `npm run test:endgame`. Set CHROME_PATH to override the browser binary.
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
window.__end={
  // Put the studio one award short of the ending, with a rival to beat.
  arm:(opts)=>{
    const o=opts||{};
    S.st=o.st===undefined?5:o.st;
    S.gotyStreak=o.streak===undefined?2:o.streak;
    S.won=false;
    S.year=6; S.gc=30; S.pm=9000000; S.money=3000000;
    S.awards=[{year:3,game:'a',score:9},{year:4,game:'b',score:9}];
    S.hist=[{name:o.winner===false?'لعبة عادية':'تحفة',genre:'أكشن',topic:'فضاء',
             score:o.winner===false?6:9.5,revenue:1,year:S.year-1}];
    S.rivals=(S.rivals||[]).map(r=>({...r,bestThisYear:8,bestName:'منافس',fans:5000}));
    buildRoom(S.st);
    updateUI();
  },
  // Drive the REAL post-release sequence, not a shortcut. finishDevelopment()
  // sets _pendingGOTY and the pipeline's first step runs the ceremony, which takes
  // over the screen; closeEvent() is what resumes it at the step after. Calling
  // CheckGOTY() directly and then advance(0) would open the award modal and the
  // ending simultaneously and prove nothing about their ordering.
  runYear:()=>{ S._pendingGOTY=true; return advance(0); },
  // Dismiss the award ceremony the way the player does, resuming the pipeline.
  closeAward:()=>{ if(document.getElementById('se').classList.contains('show'))window.closeEvent(); },
  topModal:()=>document.querySelector('.os.show:not(#sp)')?.id||null,
  afterPrestige:()=>({st:S.st,gc:S.gc,prestige:S.prestige.level,won:!!S.won,streak:S.gotyStreak||0}),
  state:()=>({won:!!S.won,streak:S.gotyStreak||0,st:S.st,gc:S.gc,money:Math.round(S.money),
              awards:(S.awards||[]).length,met:winConditionMet(),
              modal:document.querySelector('.os.show:not(#sp)')?.id||null,
              goal:document.getElementById('goalBar').style.display,
              goalText:document.getElementById('goalBar').textContent}),
  streakConst:()=>WIN_STREAK,
  // Feed a pre-endgame save through the real migration path.
  migrateV5:(gotyWins)=>{
    const old={saveVersion:5,money:1000,fn:5000,gc:20,st:5,bs:9,pm:5000000,hs:8,
      sl:{design:8,code:8,sound:8},hist:[],ach:[],sk:0,difficulty:'normal',
      audio:{volume:0.6,muted:false},theme:'dark',platforms:['pc'],
      research:{points:0,unlocked:[]},employees:[],ips:[],year:9,
      marketing:{hype:0,campaign:null,cost:0},bugs:0,gamesThisYear:0,
      awards:[{year:1},{year:2},{year:3}],prestige:{level:0},conventionCooldown:0,
      rivals:initRivals(),morale:75,engineVersion:0,contractCooldown:0,
      loansRepaid:0,gotyWins:gotyWins,tips:[],marketTaste:rollMarketTaste(9)};
    const m=migrateSave(JSON.parse(JSON.stringify(old)));
    return {saveVersion:m.saveVersion,gotyStreak:m.gotyStreak,won:m.won,gotyWins:m.gotyWins};
  },
};
</script>
</body>`);
if (!patched.includes('window.__end')) { console.error('could not inject the endgame hook'); process.exit(1); }

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
page.on('dialog', async d => { await d.dismiss(); });
await page.goto(`http://localhost:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('gd_save'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.click('#bst');
await page.waitForTimeout(700);

const checks = {};
const note = {};
const summary = [];

const arm = o => page.evaluate(opts => window.__end.arm(opts), o || {});
// One full year-end: the ceremony fires, the player dismisses it, and the
// pipeline continues into whatever comes next.
const runYear = async () => {
  await page.evaluate(() => window.__end.runYear());
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__end.closeAward());
  await page.waitForTimeout(250);
};
const state = () => page.evaluate(() => window.__end.state());
const clearModals = () => page.evaluate(() => document.querySelectorAll('.os.show').forEach(e => e.classList.remove('show')));

const WIN_STREAK = await page.evaluate(() => window.__end.streakConst());
summary.push(`win condition: top stage + ${WIN_STREAK} consecutive Game of the Year wins`);

// 1. A third consecutive win at the top stage ends the run.
{
  await arm({ st: 5, streak: 2, winner: true });
  await runYear();
  await page.waitForTimeout(300);
  const st = await state();
  checks['a third straight award at the top stage triggers the ending'] =
    st.met === true && st.streak >= WIN_STREAK && st.modal === 'vicModal';
  note['a third straight award at the top stage triggers the ending'] = `condition met=${st.met} streak=${st.streak}, on screen: ${st.modal}`;
  await clearModals();
}

// 2. A losing year resets the streak — this is what "in a row" has to mean.
{
  await arm({ st: 5, streak: 2, winner: false });
  await runYear();
  await page.waitForTimeout(300);
  const st = await state();
  checks['a year without an award resets the streak'] = st.streak === 0 && st.won === false;
  note['a year without an award resets the streak'] = `streak=${st.streak} won=${st.won}`;
  await clearModals();
}

// 3. The streak alone is not enough — the studio has to be at the top.
{
  await arm({ st: 3, streak: 2, winner: true });
  await runYear();
  await page.waitForTimeout(300);
  const st = await state();
  checks['the streak alone does not end the run below the top stage'] = st.won === false && st.streak >= WIN_STREAK;
  note['the streak alone does not end the run below the top stage'] = `stage=${st.st} streak=${st.streak} won=${st.won}`;
  await clearModals();
}

// 4. Once spent, the ending must not re-fire on every subsequent release.
{
  await arm({ st: 5, streak: 2, winner: true });
  await runYear();
  await page.waitForTimeout(250);
  await page.evaluate(() => window.continueAfterWin());
  await page.waitForTimeout(250);
  const before = await state();
  await runYear();          // another winning year
  await page.waitForTimeout(300);
  const after = await state();
  checks['the ending fires once per run'] = before.won === true && after.modal !== 'vicModal';
  note['the ending fires once per run'] = `streak now ${after.streak}, modal ${after.modal}`;
  await clearModals();
}

// 4b. Showing the screen must not spend the ending — only answering it does.
//     Otherwise closing the tab at the victory screen burns the run's one prestige
//     offer, and _pendingPrestige is session-only so it cannot be recovered.
{
  await arm({ st: 5, streak: 2, winner: true });
  await runYear();
  await page.waitForTimeout(250);
  const shown = await state();
  await clearModals();                       // stand-in for "player never answered"
  const ignored = await state();
  await page.evaluate(() => window.continueAfterWin());
  await page.waitForTimeout(250);
  const answered = await state();
  checks['the ending is spent by answering it, not by showing it'] =
    shown.modal === 'vicModal' && shown.won === false && ignored.won === false && answered.won === true;
  note['the ending is spent by answering it, not by showing it'] =
    `on screen won=${shown.won}, dismissed won=${ignored.won}, answered won=${answered.won}`;
  await clearModals();
}

// 5. "Keep playing" must leave the studio exactly as it was.
{
  await arm({ st: 5, streak: 2, winner: true });
  await runYear();
  await page.waitForTimeout(250);
  const during = await state();
  await page.evaluate(() => window.continueAfterWin());
  await page.waitForTimeout(300);
  const after = await state();
  checks['keeping the studio preserves stage, releases and money'] =
    after.st === during.st && after.gc === during.gc && after.money === during.money;
  note['keeping the studio preserves stage, releases and money'] =
    `stage ${during.st}->${after.st}, releases ${during.gc}->${after.gc}, money ${during.money}->${after.money}`;
  await clearModals();
}

// 6. The other exit resets the run and banks the prestige.
{
  await arm({ st: 5, streak: 2, winner: true });
  await runYear();
  await page.waitForTimeout(250);
  await page.evaluate(() => window.prestigeFromWin());
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__end.afterPrestige());
  checks['starting a new run banks prestige and resets the studio'] =
    after.st === 0 && after.gc === 0 && after.prestige > 0 && after.won === false && after.streak === 0;
  note['starting a new run banks prestige and resets the studio'] =
    `stage=${after.st} releases=${after.gc} prestige=${after.prestige} won=${after.won}`;
  await clearModals();
}

// 7. The goal has to be legible before it is reached, and only where it applies.
{
  await arm({ st: 4, streak: 1, winner: true });
  await page.waitForTimeout(200);
  const mid = await state();
  await arm({ st: 5, streak: 1, winner: true });
  await page.waitForTimeout(200);
  const top = await state();
  checks['the goal is shown at the top stage and hidden before it'] =
    mid.goal === 'none' && top.goal === 'block' && /●/.test(top.goalText) && /○/.test(top.goalText);
  note['the goal is shown at the top stage and hidden before it'] =
    `stage 4: ${mid.goal || 'hidden'}; stage 5: "${top.goalText.trim().slice(0, 60)}"`;
  await clearModals();
}

// 8. Migration must not invent a streak. gotyWins is a lifetime total with no
//    record of which wins were consecutive, so it cannot seed one.
{
  const m = await page.evaluate(() => window.__end.migrateV5(7));
  checks['a pre-endgame save migrates without inheriting a streak'] =
    m.saveVersion === 6 && m.gotyStreak === 0 && m.won === false && m.gotyWins === 7;
  note['a pre-endgame save migrates without inheriting a streak'] =
    `v${m.saveVersion}, streak ${m.gotyStreak}, won ${m.won}, lifetime wins kept at ${m.gotyWins}`;
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
console.log('\n' + (ok ? 'ENDGAME PASS' : 'ENDGAME FAIL'));
process.exit(ok ? 0 : 1);
