/**
 * Viewport framing regression test for "من الغرفة للقمة".
 *
 * onResize() used to pin the orthographic half-HEIGHT at 18 and derive the
 * half-width from the window aspect. On a desktop that is right; on a portrait
 * phone it is not. At 390×844 (aspect 0.46) it left a half-width of 8.3 world
 * units against a skyscraper floor whose corner-to-centre radius is 28.4 — two
 * thirds of the room off-screen, with no way for the player to recover it (the
 * pinch-zoom floor is 0.5, which is nowhere near enough). It got worse the
 * further the player progressed, which is exactly backwards: the reward for
 * building a bigger studio was seeing less of it.
 *
 * This pins the fix. For every stage, on every viewport shape the game can
 * plausibly meet, and at every yaw the player can orbit to, all four corners of
 * the room's FLOOR must land inside the camera frustum. The floor rather than the
 * whole bounding volume, because an isometric diorama crops what sits above the
 * furniture on purpose — see the comment on the `corners` hook below.
 *
 * It also asserts the two properties that make the fix safe rather than merely
 * effective:
 *   - a wide screen is untouched (the height still governs there),
 *   - the framing does not pump in and out as the room is orbited.
 *
 * Run: `npm run test:fit`. Set CHROME_PATH to override the browser binary.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.woff2':'font/woff2' };

// Expose the camera and the built room. `corners` projects the room's bounding box
// through three.js's own projection maths rather than re-deriving it here — a
// re-derivation would be free to be wrong in exactly the same way the game is.
const patched = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(
  /<\/script>\s*<\/body>/,
  `
window.__fit={
  stage:(s)=>{
    S.st=s;
    S.employees=Array.from({length:[0,2,4,8,15,23][s]},(_,i)=>({role:'coder',name:'E'+i,level:0,exp:0,salary:2000}));
    buildRoom(s);
    camCtl.yaw=0;camCtl.zoom=1;setCam(s);snapCam();
  },
  yaw:(y)=>{camCtl.yaw=y;snapCam();},
  // Normalised device coordinates of the four corners of the room's FLOOR.
  // |x|<=1 and |y|<=1 means the corner is on screen.
  //
  // The floor plate, not the whole bounding volume, is the thing under test.
  // An isometric diorama deliberately crops what sits above the furniture —
  // ceiling lights, the tops of the glass, and the dust motes that drift up and
  // wrap — and demanding those stay on screen would be asserting a look the game
  // has never had and does not want. What the player is owed is the floor they
  // built on: every desk, every employee, corner to corner.
  //
  // The dynamic groups are skipped for the same reason measureRoomFit() skips
  // them: they hold the drifting decoration.
  //
  // The vendored bundle is tree-shaken to what the game actually imports, and
  // THREE.Vector3 is not on that list — adding it would grow the download for
  // every player to serve a test. Box3 already owns two, so the scratch vector
  // is borrowed from one of them; .project() is three's own projection maths,
  // which is the point (a re-derivation here would be free to be wrong in
  // exactly the same way the game is).
  corners:()=>{
    const b=new THREE.Box3();
    const acc=new THREE.Box3();
    let seeded=false;
    for(const child of rg.children){
      if(child.userData&&child.userData.dyn)continue;
      acc.setFromObject(child);
      if(!Number.isFinite(acc.min.x))continue;
      if(seeded)b.union(acc);else{b.copy(acc);seeded=true;}
    }
    if(!seeded)return [];
    const v=b.min.clone();
    const out=[];
    for(const x of [b.min.x,b.max.x])for(const z of [b.min.z,b.max.z]){
      v.set(x,b.min.y,z).project(camera);
      out.push({x:+v.x.toFixed(4),y:+v.y.toFixed(4)});
    }
    return out;
  },
  frustum:()=>({
    halfW:(camera.right-camera.left)/2,
    halfH:(camera.top-camera.bottom)/2,
    // Tolerated as absent so this suite still reports a useful verdict when run
    // against a build that predates the fix, instead of dying on a ReferenceError
    // before it can print which viewports clipped.
    fit:(typeof roomFitRadius==='number'?roomFitRadius:null),
  }),
};
</script>
</body>`);
if (!patched.includes('window.__fit')) { console.error('could not inject the fit hook'); process.exit(1); }

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

// Shapes chosen for what they stress, not for specific handsets: the narrowest
// phone still sold, a mainstream tall phone, a portrait tablet, the reference
// desktop the screenshots use, and an ultrawide.
const VIEWPORTS = [
  { w: 320, h: 720, name: 'narrow phone (portrait)' },
  { w: 390, h: 844, name: 'tall phone (portrait)' },
  { w: 768, h: 1024, name: 'tablet (portrait)' },
  { w: 844, h: 390, name: 'phone (landscape)' },
  { w: 900, h: 620, name: 'desktop (reference)' },
  { w: 2560, h: 1080, name: 'ultrawide' },
];
// A quarter turn covers every distinct framing: the room is square, so yaw and
// yaw+90° present the same silhouette.
const YAWS = [0, Math.PI / 8, Math.PI / 4, (3 * Math.PI) / 8];

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text())) errors.push('console: ' + m.text()); });
await page.goto(`http://localhost:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('gd_save'));
await page.reload({ waitUntil: 'domcontentloaded' });
// Wait on the CONDITION, not the clock. Fixed sleeps were the second reason this
// suite went red on a loaded runner and green on the retry.
await page.waitForFunction(() => window.__fit && document.getElementById('bst'));
await page.click('#bst');
await page.waitForFunction(() => document.getElementById('ss').style.display === 'none');

// The corner projection reads the camera's world matrix. applyCam() refreshes it
// synchronously now, so a stage or yaw change is observable from the very next
// evaluate() — but give the renderer one frame anyway so the check also covers
// what the player would actually see drawn.
const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
const setViewport = async (w, h) => {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForFunction(([ww, hh]) => window.innerWidth === ww && window.innerHeight === hh, [w, h]);
};

const checks = {};
const note = {};
const summary = [];

// A corner exactly on the edge is technically visible but touches the bezel, so
// require it to clear by a little — the same air CAM_FIT_MARGIN is there to buy.
const NDC_LIMIT = 0.995;

let worstOverflow = 0;
let worstWhere = '';
const offenders = [];

for (const vp of VIEWPORTS) {
  await setViewport(vp.w, vp.h);
  let vpWorst = 0;
  for (let s = 0; s <= 5; s++) {
    await page.evaluate(st => window.__fit.stage(st), s);
    await settle();
    for (const y of YAWS) {
      await page.evaluate(yy => window.__fit.yaw(yy), y);
      const corners = await page.evaluate(() => window.__fit.corners());
      for (const c of corners) {
        const over = Math.max(Math.abs(c.x), Math.abs(c.y)) - NDC_LIMIT;
        if (over > vpWorst) vpWorst = over;
        if (over > worstOverflow) {
          worstOverflow = over;
          worstWhere = `${vp.name}, stage ${s}, yaw ${(y * 180 / Math.PI).toFixed(0)}°`;
        }
      }
    }
  }
  summary.push(`${vp.name.padEnd(24)} ${vp.w}×${vp.h}  worst corner overflow: ${vpWorst > 0 ? '+' + vpWorst.toFixed(3) + ' OFF-SCREEN' : 'none (fits)'}`);
  if (vpWorst > 0) offenders.push(vp.name);
}

checks['every floor fits on every viewport, at every orbit angle'] = worstOverflow <= 0;
note['every floor fits on every viewport, at every orbit angle'] = worstOverflow > 0
  ? `worst: ${worstWhere} by ${worstOverflow.toFixed(3)} NDC (${offenders.join(', ')})`
  : `${VIEWPORTS.length} viewports × 6 stages × ${YAWS.length} angles, all inside`;

// The fix must not touch the desktop framing. 18 is CAM_BASE_HALF_H; anything
// else at 900×620 on the early stages means the baseline look moved.
{
  await setViewport(900, 620);
  await page.evaluate(() => window.__fit.stage(0));
  await settle();
  const f = await page.evaluate(() => window.__fit.frustum());
  checks['a wide screen keeps the original framing'] = Math.abs(f.halfH - 18) < 1e-6;
  note['a wide screen keeps the original framing'] = `half-height ${f.halfH.toFixed(2)} (baseline 18)`;
}

// Orbiting must not resize the frustum, or the scene visibly breathes as it spins.
{
  await setViewport(390, 844);
  await page.evaluate(() => window.__fit.stage(5));
  await settle();
  const seen = [];
  for (const y of YAWS) {
    await page.evaluate(yy => window.__fit.yaw(yy), y);
    seen.push((await page.evaluate(() => window.__fit.frustum())).halfW);
  }
  const spread = Math.max(...seen) - Math.min(...seen);
  checks['the framing does not pump while orbiting'] = spread < 1e-6;
  note['the framing does not pump while orbiting'] = `half-width spread ${spread.toFixed(6)} across ${YAWS.length} angles`;
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
console.log('\n' + (ok ? 'VIEWPORT FIT PASS' : 'VIEWPORT FIT FAIL'));
process.exit(ok ? 0 : 1);
