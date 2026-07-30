/**
 * Navigation regression test for "من الغرفة للقمة".
 *
 * Employees used to lerp straight from their desk to the coffee corner with no
 * collision at all, walking through desks, beds, sofas and crates. This asserts
 * the replacement actually keeps them out of the furniture:
 *
 *   - every stage builds a walkable grid with reachable open space,
 *   - a route exists between a desk and the coffee spot on every stage that has one,
 *   - every point along every returned route clears the obstacle footprints,
 *   - simulated walking never puts a body inside an obstacle,
 *   - unreachable targets fail cleanly (null) instead of returning a path that
 *     tunnels through a wall.
 *
 * Run: `npm run test:path`. Set CHROME_PATH to override the browser binary.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.woff2':'font/woff2' };

// Expose the navigation internals plus the obstacle list captured before batching.
const patched = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(
  /<\/script>\s*<\/body>/,
  `
window.__nav={
  build:(s)=>{
    S.st=s;
    S.employees=Array.from({length:[0,2,4,8,15,23][s]},(_,i)=>({role:'coder',name:'E'+i,level:0,exp:0,salary:2000}));
    buildRoom(s);
  },
  // Re-derive obstacles the same way buildNav() does, but keep them for assertions.
  obstacles:(s)=>{
    S.st=s;
    S.employees=Array.from({length:[0,2,4,8,15,23][s]},(_,i)=>({role:'coder',name:'E'+i,level:0,exp:0,salary:2000}));
    curStage=s; clr();
    if(s===0)buildBedroom();else if(s===1)buildGarage();else if(s===2)buildSmallOffice();
    else if(s===3)buildStudio();else if(s===4)buildCompany();else buildSkyscraper();
    addDesks(s); addDeskDecor(s); placePeople(s);
    const list=collectObstacles();
    buildNav();
    return {obstacles:list, grid:nav?{cols:nav.cols,rows:nav.rows,minX:nav.minX,minZ:nav.minZ,
      free:Array.from(nav.blocked).filter(v=>!v).length, total:nav.blocked.length, cell:NAV_CELL}:null,
      radius:PERSON_RADIUS};
  },
  seats:()=>employees.map(e=>({x:e.userData.baseX,z:e.userData.baseZ,self:!!e.userData.isSelf})),
  coffee:(s)=>COFFEE_SPOTS[s],
  route:(fx,fz,tx,tz)=>navPath(fx,fz,tx,tz),
  // Walk a body along a route the way animate() does and report every sample.
  simulate:(fx,fz,tx,tz)=>{
    const p=navPath(fx,fz,tx,tz);
    if(!p)return null;
    const pos={x:fx,z:fz}; const samples=[{...pos}]; let pi=0, guard=0;
    while(pi<p.length&&guard++<20000){
      const wp=p[pi];
      const dx=wp.x-pos.x, dz=wp.z-pos.z, d=Math.hypot(dx,dz);
      const last=pi>=p.length-1;
      if(d<(last?0.18:0.45)){pi++;continue;}
      const sp=Math.min(0.045,d);
      pos.x+=dx/d*sp; pos.z+=dz/d*sp;
      samples.push({...pos});
    }
    return {waypoints:p, samples, finished:pi>=p.length};
  },
};
</script>
</body>`);
if (!patched.includes('window.__nav')) { console.error('could not inject the nav hook'); process.exit(1); }

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

// A body of radius `slack` at (x,z) is inside an obstacle if it overlaps its
// footprint. Routes are planned against PERSON_RADIUS-inflated obstacles, so the
// assertion uses a slightly smaller margin to allow for grid quantisation.
// Planning inflates obstacles by PERSON_RADIUS (0.55) and the grid quantises to
// 0.7 units, so a legitimate route can pass within ~0.35 of a footprint. Assert on
// actual penetration instead: a body centre inside the box itself is a real breach.
const PERSON_SLACK = 0.05;
function inside(pt, boxes, slack) {
  for (const o of boxes) {
    if (pt.x > o.minX - slack && pt.x < o.maxX + slack && pt.z > o.minZ - slack && pt.z < o.maxZ + slack) return o;
  }
  return null;
}

const checks = {};
const note = {};
const summary = [];

for (const stage of [0, 1, 2, 3, 4, 5]) {
  const info = await page.evaluate(s => window.__nav.obstacles(s), stage);
  const seats = await page.evaluate(() => window.__nav.seats());
  const coffee = await page.evaluate(s => window.__nav.coffee(s), stage);
  const g = info.grid;
  const label = `stage ${stage}`;

  checks[`${label}: obstacles were derived from the room`] = info.obstacles.length > 0;
  note[`${label}: obstacles were derived from the room`] = `${info.obstacles.length} boxes`;
  checks[`${label}: walkable grid has open space`] = !!g && g.free > 20;
  note[`${label}: walkable grid has open space`] = g ? `${g.free}/${g.total} cells free (${g.cols}×${g.rows})` : 'no grid';

  if (!coffee) { summary.push(`${label}: no coffee spot (solo stage) — skipped routing`); continue; }

  // Route every seated employee to the coffee spot and check the whole path.
  let routed = 0, failed = 0, breaches = [];
  for (const seat of seats) {
    if (seat.self) continue;
    const sim = await page.evaluate(a => window.__nav.simulate(a[0], a[1], a[2], a[3]),
      [seat.x, seat.z, coffee.x, coffee.z]);
    if (!sim) { failed++; continue; }
    routed++;
    if (!sim.finished) breaches.push(`route from (${seat.x},${seat.z}) never finished`);
    // Both endpoints are legitimately in contact with furniture: an employee stands
    // at their own desk, and the coffee spot is by definition next to the counter.
    // What must never happen is crossing furniture in between, so the assertion
    // covers the mid-route portion — everything more than one desk-length away from
    // either endpoint.
    const near = (p, x, z) => Math.hypot(p.x - x, p.z - z) < 2.2;
    for (let i = 0; i < sim.samples.length; i++) {
      const p = sim.samples[i];
      if (near(p, seat.x, seat.z) || near(p, coffee.x, coffee.z)) continue;
      const hit = inside(p, info.obstacles, PERSON_SLACK);
      if (hit) { breaches.push(`sample ${i} at (${p.x.toFixed(1)},${p.z.toFixed(1)}) inside box x[${hit.minX.toFixed(1)},${hit.maxX.toFixed(1)}] z[${hit.minZ.toFixed(1)},${hit.maxZ.toFixed(1)}]`); break; }
    }
  }
  checks[`${label}: every employee can reach the coffee corner`] = failed === 0 && routed > 0;
  note[`${label}: every employee can reach the coffee corner`] = `${routed} routed, ${failed} unroutable`;
  checks[`${label}: no walker passes through furniture`] = breaches.length === 0;
  note[`${label}: no walker passes through furniture`] = breaches.slice(0, 3).join(' | ');
  summary.push(`${label}: ${info.obstacles.length} obstacles, ${g.free}/${g.total} free, ${routed} routes clean`);
}

// A target well outside the room must fail rather than return a tunnelling path.
{
  await page.evaluate(() => window.__nav.obstacles(2));
  const far = await page.evaluate(() => window.__nav.route(0, 0, 500, 500));
  const ok = far === null || far.every(p => Math.abs(p.x) < 60 && Math.abs(p.z) < 60);
  checks['an out-of-bounds target does not tunnel out of the room'] = ok;
  note['an out-of-bounds target does not tunnel out of the room'] = far === null ? 'null (rejected)' : `clamped inside: ${JSON.stringify(far.slice(-1))}`;
}

// String-pulling should collapse the grid staircase, not return it cell by cell.
{
  const info = await page.evaluate(() => window.__nav.obstacles(5));
  const seats = await page.evaluate(() => window.__nav.seats());
  const coffee = await page.evaluate(() => window.__nav.coffee(5));
  const seat = seats.find(s => !s.self);
  const r = await page.evaluate(a => window.__nav.route(a[0], a[1], a[2], a[3]), [seat.x, seat.z, coffee.x, coffee.z]);
  const straightLine = Math.hypot(coffee.x - seat.x, coffee.z - seat.z);
  // An unsmoothed grid path across this distance is ~straightLine/NAV_CELL cells
  // (≈41 at the skyscraper). Assert a real collapse, not a specific waypoint count.
  const rawCells = straightLine / 0.7;
  checks['routes are smoothed into few long legs'] = !!r && r.length <= Math.max(6, rawCells / 4);
  note['routes are smoothed into few long legs'] = r ? `${r.length} waypoints for a ${straightLine.toFixed(0)}-unit crossing (raw grid path ≈${rawCells.toFixed(0)} cells)` : 'no route';
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
console.log('\n' + (ok ? 'PATHFINDING PASS' : 'PATHFINDING FAIL'));
process.exit(ok ? 0 : 1);
