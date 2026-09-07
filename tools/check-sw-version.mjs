/**
 * Guard against shipping a new index.html without bumping the service worker
 * cache version. If index.html (or the vendored Three.js) changed relative to
 * the base branch but sw.js's VERSION string did not, returning players would
 * be served the old cached build. Fails CI in that case.
 *
 * This check fails CLOSED. An earlier version exited 0 when git was unavailable
 * and passed when the VERSION regex matched nothing on either side — printing
 * "✓ bumped (null → null)" — so the one failure mode it existed to catch
 * (a stale worker shipping silently) was also the one it could not report.
 *
 * Usage: node tools/check-sw-version.mjs <base-ref>
 */
import { execSync } from 'child_process';
import fs from 'fs';

const base = process.argv[2] || 'origin/main';

function changed(pathspec) {
  try {
    const out = execSync(`git diff --name-only ${base}...HEAD -- ${pathspec}`, { encoding: 'utf8' });
    return out.trim().length > 0;
  } catch (e) {
    console.error(`✗ could not run git diff against ${base}: ${e.message}`);
    console.error('  This guard needs the base ref fetched (CI: actions/checkout with the PR base).');
    process.exit(1);
  }
}

function swVersion(ref) {
  let src;
  try {
    src = ref === 'HEAD'
      ? fs.readFileSync('sw.js', 'utf8')
      : execSync(`git show ${ref}:sw.js`, { encoding: 'utf8' });
  } catch (e) {
    console.error(`✗ could not read sw.js at ${ref}: ${e.message}`);
    process.exit(1);
  }
  const m = src.match(/const\s+VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!m) {
    console.error(`✗ no "const VERSION = '…'" found in sw.js at ${ref} — the guard cannot see the cache version.`);
    process.exit(1);
  }
  return m[1];
}

const appChanged = changed('index.html') || changed('vendor/');
if (!appChanged) {
  console.log('✓ app shell unchanged — no service worker bump required');
  process.exit(0);
}

const before = swVersion(base);
const after = swVersion('HEAD');
if (before === after) {
  console.error(`✗ index.html/vendor changed but sw.js VERSION is still ${after}.`);
  console.error('  Bump the VERSION constant in sw.js so returning players get the new build.');
  process.exit(1);
}
console.log(`✓ service worker version bumped (${before} → ${after})`);
