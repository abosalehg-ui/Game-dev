/**
 * The balance constants tools/balance-sim.mjs reasons about, PARSED OUT OF
 * index.html rather than retyped. A hand-copied duplicate drifts — the sim once
 * reported on a stage curve the game had stopped shipping — and the sales
 * formula constants (score exponent, unit, fan weight, the fan soft cap, the
 * market-share band) were still literals inside the sim until the formula
 * suite started checking them against the page.
 *
 * tests/formulas.mjs imports these same readers and asserts they equal what the
 * running game reports from BALANCE, so a regex that stops matching is a red
 * test rather than a silently stale simulation.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = () => fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

export function readStages() {
  const block = html().match(/const STG=\[([\s\S]*?)\];/);
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

export function readRevenueSlope() {
  const m = html().match(/stageRevenue:\s*i\s*=>\s*([\d.]+)\s*\+\s*i\s*\*\s*([\d.]+)/);
  if (!m) throw new Error('could not locate BALANCE.sales.stageRevenue in index.html');
  return { base: Number(m[1]), perStage: Number(m[2]) };
}

// Everything computeSales() multiplies a base game's revenue by that the sim
// models: BALANCE.sales.{scoreExponent,unit,fanWeight,fanSoftCap,fanTail,
// shareFloor,shareRange}.
export function readSalesModel() {
  const src = html();
  const block = src.match(/sales:\{([\s\S]*?)\n\s*\},\n\s*fans:\{/);
  if (!block) throw new Error('could not locate BALANCE.sales in index.html');
  const num = key => {
    const m = block[1].match(new RegExp(`(?:^|[\\s,{])${key}:\\s*([\\d.]+)`));
    if (!m) throw new Error(`BALANCE.sales.${key} not found in index.html`);
    return Number(m[1]);
  };
  return {
    scoreExponent: num('scoreExponent'),
    unit: num('unit'),
    fanWeight: num('fanWeight'),
    fanSoftCap: num('fanSoftCap'),
    fanTail: num('fanTail'),
    shareFloor: num('shareFloor'),
    shareRange: num('shareRange'),
  };
}

// Mirror of effectiveFans() in index.html, on the parsed constants.
export function effectiveFans(fn, sales = readSalesModel()) {
  const f = Math.max(0, fn || 0);
  return f <= sales.fanSoftCap ? f : sales.fanSoftCap + (f - sales.fanSoftCap) * sales.fanTail;
}
