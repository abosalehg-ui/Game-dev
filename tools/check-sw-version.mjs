/**
 * Guard against shipping a new index.html without bumping the service worker
 * cache version. If index.html (or the vendored Three.js) changed relative to
 * the base branch but sw.js's VERSION string did not, returning players would
 * be served the old cached build. Fails CI in that case.
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
    console.error('could not run git diff:', e.message);
    process.exit(0); // don't block if git context is unavailable
  }
}

function swVersion(ref) {
  try {
    const src = ref === 'HEAD'
      ? fs.readFileSync('sw.js', 'utf8')
      : execSync(`git show ${ref}:sw.js`, { encoding: 'utf8' });
    const m = src.match(/const\s+VERSION\s*=\s*['"]([^'"]+)['"]/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const appChanged = changed('index.html') || changed('vendor/');
if (!appChanged) {
  console.log('✓ app shell unchanged — no service worker bump required');
  process.exit(0);
}

const before = swVersion(base);
const after = swVersion('HEAD');
if (before && after && before === after) {
  console.error(`✗ index.html/vendor changed but sw.js VERSION is still ${after}.`);
  console.error('  Bump the VERSION constant in sw.js so returning players get the new build.');
  process.exit(1);
}
console.log(`✓ service worker version bumped (${before} → ${after})`);
