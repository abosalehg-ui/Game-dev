/**
 * Syntax gate for the game's inline module script.
 *
 * The whole game lives in index.html. This extracts the <script type="module">
 * block, strips the bare `import` (which the parser can't resolve standalone),
 * and parses it with the V8 parser via vm.compileFunction. A syntax error here
 * fails CI before the slower browser smoke test runs.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) { console.error('✗ could not find the module <script> block in index.html'); process.exit(1); }

// Remove bare import statements — vm can't resolve them and we only check syntax.
const js = m[1].replace(/^\s*import\s.*?;\s*$/gm, '');

try {
  // Module-level syntax (import/export already stripped) parses fine as a script body.
  new vm.Script(js, { filename: 'index.html:module' });
  console.log('✓ index.html module script: syntax OK');
} catch (e) {
  console.error('✗ syntax error in index.html module script:');
  console.error('  ' + e.message);
  process.exit(1);
}

// Also sanity-check the service worker parses.
try {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  new vm.Script(sw, { filename: 'sw.js' });
  console.log('✓ sw.js: syntax OK');
} catch (e) {
  console.error('✗ syntax error in sw.js:');
  console.error('  ' + e.message);
  process.exit(1);
}
