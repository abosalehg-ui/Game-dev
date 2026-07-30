/**
 * Renders the screenshots the README embeds. Unlike tools/shot-stages.mjs — which
 * hides the UI on purpose so a Three.js upgrade can be diffed as pure rendering —
 * this keeps the interface visible, because the interface is what a reader is
 * trying to see before deciding to play.
 *
 * Each shot is driven into a believable state (a staffed office, a game mid-review,
 * a filled research tree) rather than the empty opening save, so the README shows
 * the game as it actually looks after an hour rather than in its first minute.
 *
 * Usage: node tools/shot-readme.mjs [out-dir]     (default: docs/screenshots)
 * Set CHROME_PATH to override the browser binary.
 *
 * Re-run after any visual change and commit the result — the README points at
 * these files, so a stale shot is a stale promise.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'docs/screenshots');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.woff2':'font/woff2' };

// Same injection trick as shot-stages.mjs: append a debug hook so the harness can
// place the player in a given office with a given crew without playing there.
const patched = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(
  /<\/script>\s*<\/body>/,
  `
window.__shot={
  // Film grain is per-pixel random noise. It is nearly invisible on screen and it
  // suppresses banding in the sky gradient, but it defeats PNG's row filters
  // completely — leaving it on made every committed screenshot roughly ten times
  // larger. Runtime keeps it; captures do not.
  degrain:()=>{if(typeof gradePass!=='undefined'&&gradePass)gradePass.uniforms.uGrain.value=0;},
  stage:(s,opts)=>{const o=opts||{};
    S.st=s;
    S.employees=Array.from({length:[0,2,4,8,15,23][s]},(_,i)=>({role:['coder','designer','artist','composer','marketer'][i%5],name:'موظف'+i,level:i%4,exp:0,salary:2000}));
    S.money=[9000,60000,400000,2100000,9000000,42000000][s];
    S.fn=[120,2400,18000,90000,420000,1500000][s];
    S.gc=[1,5,12,22,31,38][s];
    S.year=[1,2,4,6,8,10][s];
    S.ips=Array.from({length:Math.min(6,s+1)},(_,i)=>({id:'i'+i,name:['ملحمة الصحراء','حصار المجرة','أساطير الأندلس','قافلة الرحيل','وحوش الظلام','دوري الأبطال'][i],genre:['action','rpg','sim','horror','racing','puzzle'][i],topic:['desert','space','islamic','bedouin','animals','sports'][i],bestScore:8+(i%2)/2,sequels:i%2,dlcs:0}));
    S.awards=s>=3?[{year:1,game:'ملحمة الصحراء',score:9},{year:2,game:'حصار المجرة',score:9.5}]:[];
    // Rivals have to be grown alongside the player, or the market panel screenshots
    // a 97%-to-1% rout with every studio still "لم يصدر شيئاً بعد" — advertising the
    // competition system as trivially won. These track the shipped growth curve.
    S.rivals=RIVAL_DEFS.map((d,i)=>({id:d.id,quality:5.5+i*0.6,
      fans:Math.round([2400,9000,30000,110000,260000,700000][s]*(1-i*0.16)),
      games:[0,2,6,11,17,24][s],bestThisYear:7.5+i*0.4,bestName:['غزو الكواكب','ليل المدينة','سباق الكثبان','حراس القلعة'][i],
      lastGame:{name:['غزو الكواكب','ليل المدينة','سباق الكثبان','حراس القلعة'][i],score:7.5+i*0.4,year:S.year}}));
    S.research={points:4+s*2,unlocked:['engine','hd','design','code','sound','crossplat','analytics','mmo','br'].slice(0,Math.min(9,s*2))};
    // A release history, so the market panel and the 📜 log show a studio with a
    // past rather than one that has somehow gathered fans without shipping.
    S.hist=[{name:'ملحمة الصحراء',genre:'مغامرة',topic:'صحراء',score:9,revenue:1850000,year:S.year},
      {name:'حصار المجرة',genre:'استراتيجية',topic:'فضاء',score:8.5,revenue:920000,year:Math.max(1,S.year-1)},
      {name:'أساطير الأندلس',genre:'RPG',topic:'تاريخ إسلامي',score:9.5,revenue:2400000,year:Math.max(1,S.year-1)}].slice(0,s+1);
    S.engineVersion=Math.min(4,s);
    // Part-way through 📖 معجم الاستوديو, so the picker screenshot shows the ✓ marks
    // and the progress line doing their job instead of an empty checklist.
    S.topicsShipped=['desert','space','islamic','bedouin','animals','sports','city'].slice(0,Math.min(7,s+2));
    S.gamesThisYear=o.phase===undefined?1:o.phase;
    buildRoom(s);camCtl.yaw=o.yaw===undefined?0.35:o.yaw;camCtl.zoom=o.zoom||1;setCam(s);
    applyDayPhase();
    // Snap the day/night lerp instead of waiting ~5s of frames for it to converge.
    for(let k=0;k<400;k++){const t=dayTarget;amb.color.lerp(new THREE.Color(t.amb),0.2);amb.intensity+=(t.ambI*LIGHT_GAIN-amb.intensity)*0.2;
      dl.color.lerp(new THREE.Color(t.dl),0.2);dl.intensity+=(t.dlI*LIGHT_GAIN-dl.intensity)*0.2;
      if(scene.background&&scene.background.isColor)scene.background.lerp(new THREE.Color(t.bg),0.2);
      winMeshes.forEach(w=>{w.material.emissive.lerp(new THREE.Color(t.win),0.2);w.material.emissiveIntensity+=(t.winI-w.material.emissiveIntensity)*0.2;});}
    updateUI();buildSelectors();BPlatforms();},
  // The real review renderer, called with a plausible result — so the screenshot
  // shows the actual screen (score-card animation, confetti and all) rather than a
  // mock-up that can drift away from it.
  review:()=>showRev('ملحمة الصحراء',[9,9.5,8.5,9],9.0,1850000,4200,0,46000,0,null,2,0.92),
};
</script>
</body>`);
if (!patched.includes('window.__shot')) { console.error('could not inject the debug hook'); process.exit(1); }

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
const PORT = server.address().port;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const errors = [];
const written = [];

// `quality` pins the renderer tier for this page. The scene shots want the full
// chain; the UI and mobile shots are about the interface and are captured at 2×
// device scale, where the full chain on a software rasterizer is slow enough that
// the page stops responding to input altogether and the harness times out trying
// to click Start.
async function openPage(viewport, scale, quality) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  // Pin the top quality tier. Headless Chromium runs on SwiftShader, which the
  // game correctly detects and answers by dropping to the flat-shaded 'minimal'
  // tier — so without this the README would advertise the fallback renderer
  // rather than the one players with a GPU actually see.
  await page.evaluate(q => { localStorage.removeItem('gd_save'); localStorage.setItem('gd_quality', q); },
    process.env.SHOT_QUALITY || quality || 'high');
  await page.reload({ waitUntil: 'domcontentloaded' });
  // Longer than it looks like it needs to be: the full post-processing chain on a
  // software rasterizer takes seconds per frame, and a shot taken too early
  // catches the scene mid-fade into the current day phase.
  await page.waitForTimeout(3500);
  await page.click('#bst');
  await page.waitForTimeout(2500);
  // The first-run hint covers the panel; it has been seen by the time these
  // screenshots are meant to represent.
  await page.evaluate(() => { const x = document.querySelector('#hintPanel .hx'); if (x) x.click(); });
  await page.evaluate(() => window.__shot.degrain());
  return page;
}
async function shot(page, name, opts = {}) {
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file, ...opts });
  const kb = Math.round(fs.statSync(file).size / 1024);
  written.push({ name: name + '.png', kb });
  console.log(`  ${name}.png  ${kb} KB`);
}
// A modal centred in a 1200×720 frame leaves most of the image empty. Crop to the
// dialog plus a margin — enough blurred office still shows to place it in the game,
// without three quarters of the file being dimmed backdrop.
async function modalShot(page, name, selector) {
  const b = await page.locator(selector).boundingBox();
  if (!b) throw new Error('no bounding box for ' + selector);
  const pad = 48;
  await shot(page, name, { clip: {
    x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad),
    width: b.width + pad * 2, height: b.height + pad * 2,
  } });
}

// Morning. The four day phases are ordered morning/noon/evening/night, and "noon"
// is the darkest backdrop of the set (bg 0x0c0c14) — atmospheric in motion, muddy
// in a still. Morning's blue-grey is what makes the low-poly rooms read.
const MORNING = 0;

// ---- Desktop scenes: scale 1 ----------------------------------------------
// The 3D frames are gradient-heavy, which is exactly what PNG compresses worst:
// at deviceScaleFactor 2 the skyscraper alone came to 1.4 MB. GitHub renders a
// README image at ~850px wide anyway, so 1200 real pixels is already generous.
console.log('desktop scenes 1200×720 @1×:');
const scenes = await openPage({ width: 1200, height: 720 }, 1, 'high');
await scenes.evaluate(() => { if (document.getElementById('mp').classList.contains('open')) window.togglePanel(); });
await scenes.waitForTimeout(300);

// Hero: the studio, panel closed so the scene and the HUD both read.
await scenes.evaluate(m => window.__shot.stage(3, { yaw: 0.45, zoom: 1.5, phase: m }), MORNING);
await scenes.waitForTimeout(800);
await shot(scenes, 'hero');

// The six offices, for the progression gallery.
const STAGE_NAMES = ['bedroom', 'garage', 'office', 'studio', 'company', 'skyscraper'];
for (let s = 0; s < 6; s++) {
  await scenes.evaluate(a => window.__shot.stage(a.s, { yaw: 0.45, zoom: 1.5, phase: a.m }), { s, m: MORNING });
  await scenes.waitForTimeout(700);
  await shot(scenes, 'stage-' + s + '-' + STAGE_NAMES[s]);
}

// Night, where the emissive windows and the day/night cycle actually show.
await scenes.evaluate(() => window.__shot.stage(5, { yaw: 0.45, zoom: 1.5, phase: 3 }));
await scenes.waitForTimeout(800);
await shot(scenes, 'night');
await scenes.close();

// ---- Desktop UI: scale 2 ---------------------------------------------------
// These are flat panels of text, where PNG is efficient and the extra density is
// the difference between legible and smeared.
console.log('desktop UI 1200×720 @2×:');
const ui = await openPage({ width: 1200, height: 720 }, 2, 'low');
await ui.evaluate(() => { if (document.getElementById('mp').classList.contains('open')) window.togglePanel(); });
await ui.evaluate(m => window.__shot.stage(4, { yaw: 0.45, zoom: 1.4, phase: m }), MORNING);
await ui.waitForTimeout(700);

// The review screen — the payoff moment of every loop.
await ui.evaluate(() => window.__shot.review());
// The four score cards flip in on a 250 + i×300ms stagger; wait out the last one.
await ui.waitForTimeout(1800);
await modalShot(ui, 'review', '#sr2 .modal');
await ui.evaluate(() => document.getElementById('sr2').classList.remove('show'));

// Market standings and the research tree.
await ui.evaluate(() => window.OpenRivals());
await ui.waitForTimeout(500);
await modalShot(ui, 'market', '#rivalsModal .modal');
await ui.evaluate(() => window.CloseRivals());
await ui.evaluate(() => window.OpenResearch());
await ui.waitForTimeout(500);
await modalShot(ui, 'research', '#researchModal .modal');
await ui.evaluate(() => window.CloseResearch());
await ui.close();

// ---- Mobile: the dev panel, which is where the game is actually played -----
console.log('mobile 390×844:');
const mob = await openPage({ width: 390, height: 844 }, 2, 'low');
await mob.evaluate(m => window.__shot.stage(3, { yaw: 0.45, zoom: 1.3, phase: m }), MORNING);
await mob.waitForTimeout(700);
await mob.evaluate(() => { if (!document.getElementById('mp').classList.contains('open')) window.togglePanel(); });
await mob.locator('#gr .sb2').nth(3).click(); // مغامرة
await mob.fill('#gni', 'ملحمة الصحراء');
await mob.waitForTimeout(500);
await shot(mob, 'dev-panel');

await mob.locator('#topicEcho .tmain').click();
await mob.waitForTimeout(500);
await modalShot(mob, 'topic-picker', '#topicPicker .modal');
await mob.evaluate(() => window.CloseTopicPicker());

await mob.evaluate(() => window.OpenEmps());
await mob.waitForTimeout(500);
await modalShot(mob, 'employees', '#empModal .modal');
await mob.evaluate(() => window.CloseEmps());
await mob.close();

await browser.close();
server.close();

const total = written.reduce((a, w) => a + w.kb, 0);
console.log(`\n${written.length} images, ${total} KB total → ${path.relative(ROOT, OUT)}/`);
if (errors.length) { console.error('\nerrors:\n  ' + errors.slice(0, 5).join('\n  ')); process.exit(1); }
