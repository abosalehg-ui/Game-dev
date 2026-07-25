/**
 * Renders every office stage to a PNG so a Three.js upgrade (or any lighting /
 * material change) can be reviewed visually instead of by hope. Also prints the
 * mean RGB of each frame, which catches the whole class of colour-management
 * regressions that are obvious in numbers and easy to miss by eye.
 *
 * Usage: node tools/shot-stages.mjs <out-dir> [label]
 * Set CHROME_PATH to override the browser binary.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || 'shots');
const LABEL = process.argv[3] || 'shot';
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.woff2':'font/woff2' };

// Serve index.html with a debug hook appended so the harness can drive the scene.
const patched = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(
  /<\/script>\s*<\/body>/,
  `
window.__shot={
  stage:(s)=>{S.st=s;S.employees=Array.from({length:[0,2,4,8,15,23][s]},(_,i)=>({role:['coder','designer','artist','composer','marketer'][i%5],name:'E'+i,level:0,exp:0,salary:2000}));
    S.ips=Array.from({length:6},(_,i)=>({id:'i'+i,name:'IP'+i,genre:['action','rpg','sim','horror','racing','puzzle'][i],topic:'space',bestScore:8,sequels:0,dlcs:0}));
    S.awards=[{year:1,game:'a',score:9},{year:2,game:'b',score:9}];
    S.gamesThisYear=1; buildRoom(s); camCtl.yaw=0; camCtl.zoom=1; setCam(s);},
  daylight:(i)=>{S.gamesThisYear=i;applyDayPhase();
    // snap the lerp instead of waiting ~5s of frames for it to converge
    for(let k=0;k<400;k++){const t=dayTarget;amb.color.lerp(new THREE.Color(t.amb),0.2);amb.intensity+=(t.ambI*LIGHT_GAIN-amb.intensity)*0.2;
      dl.color.lerp(new THREE.Color(t.dl),0.2);dl.intensity+=(t.dlI*LIGHT_GAIN-dl.intensity)*0.2;
      if(scene.background&&scene.background.isColor)scene.background.lerp(new THREE.Color(t.bg),0.2);
      winMeshes.forEach(w=>{w.material.emissive.lerp(new THREE.Color(t.win),0.2);w.material.emissiveIntensity+=(t.winI-w.material.emissiveIntensity)*0.2;});}},
  info:()=>({revision:(THREE.REVISION||'?'),calls:renderer.info.render.calls,tris:renderer.info.render.triangles,
    colorSpace:renderer.outputColorSpace||renderer.outputEncoding||'n/a',
    colorManaged:(THREE.ColorManagement?THREE.ColorManagement.enabled:'n/a'),
    toneMapping:renderer.toneMapping}),
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

// Minimal PNG decoder (RGBA, 8-bit, no interlace) — enough to average a screenshot.
function meanRGB(pngBuf) {
  let pos = 8, w = 0, h = 0, bitDepth = 0, colorType = 0; const idat = [];
  while (pos < pngBuf.length) {
    const len = pngBuf.readUInt32BE(pos); const type = pngBuf.toString('ascii', pos + 4, pos + 8);
    const data = pngBuf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) return null;
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const cur = Buffer.alloc(stride); const prev = Buffer.alloc(stride);
  let sum = [0, 0, 0], n = 0, rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    raw.copy(cur, 0, rp, rp + stride); rp += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = cur[i];
      if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[i] = v & 0xff;
    }
    for (let x = 0; x < w; x++) { sum[0] += cur[x * bpp]; sum[1] += cur[x * bpp + 1]; sum[2] += cur[x * bpp + 2]; n++; }
    cur.copy(prev);
  }
  return sum.map(v => +(v / n).toFixed(1));
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text())) errors.push('console: ' + m.text()); });
await page.goto(`http://localhost:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('gd_save'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.click('#bst');
await page.waitForTimeout(700);
// Hide the UI so the shots compare rendering only.
await page.evaluate(() => { document.getElementById('ui').style.display = 'none'; document.getElementById('mp').style.display = 'none'; document.getElementById('pt').style.display = 'none'; });

const info = await page.evaluate(() => window.__shot.info());
const rows = [];
for (const s of [0, 1, 2, 3, 4, 5]) {
  await page.evaluate(st => window.__shot.stage(st), s);
  await page.evaluate(() => window.__shot.daylight(1)); // noon, the reference phase
  await page.waitForTimeout(350);
  const file = path.join(OUT, `${LABEL}-stage${s}.png`);
  const buf = await page.screenshot({ path: file });
  const stats = await page.evaluate(() => window.__shot.info());
  rows.push({ stage: s, mean: meanRGB(buf), calls: stats.calls, tris: stats.tris });
}
// One night shot: the day/night phase is where emissive + colour management diverge most.
await page.evaluate(() => window.__shot.stage(5));
await page.evaluate(() => window.__shot.daylight(3));
await page.waitForTimeout(350);
const nightBuf = await page.screenshot({ path: path.join(OUT, `${LABEL}-night.png`) });
rows.push({ stage: 'night', mean: meanRGB(nightBuf) });

await browser.close();
server.close();
console.log(JSON.stringify({ label: LABEL, renderer: info, perStage: rows, errors: errors.slice(0, 5) }, null, 2));
