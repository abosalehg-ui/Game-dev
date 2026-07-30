/**
 * Compares two sets of stage renders produced by tools/shot-stages.mjs.
 * Reports mean RGB, perceptual luma and the per-pixel difference, so a rendering
 * change can be judged in numbers instead of by memory of how it looked.
 *
 * Usage: node tools/compare-shots.mjs <dir> <labelA> <labelB>
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function decode(file) {
  const buf = fs.readFileSync(file);
  let pos = 8, w = 0, h = 0, bd = 0, ct = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bd !== 8 || (ct !== 6 && ct !== 2)) throw new Error(`unsupported PNG (bd=${bd} ct=${ct})`);
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * bpp);
  const cur = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++];
    raw.copy(cur, 0, rp, rp + stride); rp += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = cur[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[i] = v & 0xff;
    }
    cur.copy(out, y * stride); cur.copy(prev);
  }
  return { w, h, bpp, px: out };
}
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function stats(img) {
  let s = [0, 0, 0], n = 0;
  for (let i = 0; i < img.px.length; i += img.bpp) { s[0] += img.px[i]; s[1] += img.px[i + 1]; s[2] += img.px[i + 2]; n++; }
  const mean = s.map(v => v / n);
  return { mean: mean.map(v => +v.toFixed(1)), luma: +luma(...mean).toFixed(1) };
}
function diff(a, b) {
  if (a.w !== b.w || a.h !== b.h) return null;
  let sum = 0, n = 0, big = 0;
  for (let i = 0; i < a.px.length; i += a.bpp) {
    const d = (Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 1] - b.px[i + 1]) + Math.abs(a.px[i + 2] - b.px[i + 2])) / 3;
    sum += d; if (d > 24) big++; n++;
  }
  return { meanAbs: +(sum / n).toFixed(1), pctChanged: +(big / n * 100).toFixed(1) };
}

const [dir, A, B] = process.argv.slice(2);
if (!dir || !A || !B) { console.error('usage: compare-shots.mjs <dir> <labelA> <labelB>'); process.exit(1); }
const names = fs.readdirSync(dir).filter(f => f.startsWith(A + '-') && f.endsWith('.png'))
  .map(f => f.slice(A.length + 1, -4)).sort();
console.log(`${'view'.padEnd(8)} ${(A + ' luma').padStart(12)} ${(B + ' luma').padStart(12)} ${'ratio'.padStart(6)} ${'Δpx'.padStart(6)} ${'%>24'.padStart(6)}`);
let worst = 0;
for (const nm of names) {
  const fa = path.join(dir, `${A}-${nm}.png`), fb = path.join(dir, `${B}-${nm}.png`);
  if (!fs.existsSync(fb)) { console.log(`${nm.padEnd(8)} (no counterpart)`); continue; }
  const ia = decode(fa), ib = decode(fb);
  const sa = stats(ia), sb = stats(ib), dd = diff(ia, ib);
  const ratio = sa.luma ? +(sb.luma / sa.luma).toFixed(2) : 0;
  worst = Math.max(worst, Math.abs(1 - ratio));
  console.log(`${nm.padEnd(8)} ${String(sa.luma).padStart(12)} ${String(sb.luma).padStart(12)} ${String(ratio).padStart(6)} ${String(dd ? dd.meanAbs : '-').padStart(6)} ${String(dd ? dd.pctChanged : '-').padStart(6)}`);
}
console.log(`\nlargest luma deviation from parity: ${(worst * 100).toFixed(0)}%`);
