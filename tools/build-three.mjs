/**
 * Builds the vendored Three.js bundle in vendor/three.module.js.
 *
 * The game imports a specific, enumerated set of symbols from three — see
 * EXPORTS and ADDONS below. Shipping the full upstream build means shipping the
 * loaders, animation system, curves, every geometry primitive and both renderer
 * backends alongside them, and since r150 upstream also splits into
 * three.module.js + three.core.js, so a naive vendor copy is two files and
 * ~404 KB gzipped. Tree-shaking the same release down to what is actually
 * referenced gives ~134 KB gzipped: still far smaller than the r128 build this
 * replaced (~226 KB) despite being 57 revisions newer AND now carrying the
 * post-processing chain.
 *
 * Of that, the whole cinematic pipeline — EffectComposer, the passes, and the
 * PMREM generator behind image-based lighting — costs about 5 KB gzipped on top
 * of the plain-renderer bundle. Post-processing is cheap because it reuses the
 * renderer internals that were already being shipped.
 *
 * This is NOT a build step for running the game — index.html still loads the
 * committed bundle directly with no tooling. It is a maintenance script, run by
 * hand when upgrading Three.js, and its output is committed.
 *
 *   node tools/build-three.mjs              # rebuild at the pinned version
 *   node tools/build-three.mjs 0.186.0      # upgrade, then review the screenshots
 *
 * After any upgrade, ALWAYS diff the rendering:
 *   node tools/shot-stages.mjs /tmp/after after
 * and compare against a run from the previous bundle. Colour management and the
 * light model have both changed semantics inside this version range; the mean-RGB
 * numbers that script prints are what catch it.
 *
 * Requires network access (npm) and is the only script in the repo that does.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = process.argv[2] || '0.185.1';
const OUT = path.join(ROOT, 'vendor', 'three.module.js');

// Every symbol index.html imports from three. Keep this list in sync with the
// game: an unused entry only costs bytes, but a missing one is a runtime crash.
const EXPORTS = [
  'Scene', 'Color', 'OrthographicCamera', 'WebGLRenderer',
  'AmbientLight', 'DirectionalLight', 'PointLight', 'PCFSoftShadowMap',
  'Group', 'Mesh', 'BoxGeometry', 'MeshStandardMaterial',
  'BufferGeometry', 'BufferAttribute', 'Points', 'PointsMaterial',
  'SRGBColorSpace', 'ColorManagement', 'ACESFilmicToneMapping', 'REVISION',
  'Box3', // used to derive walkable space from the room's own furniture
  // --- Image-based lighting: the procedural sky doubles as the reflection probe
  'PMREMGenerator', 'CanvasTexture', 'EquirectangularReflectionMapping',
  'LinearFilter', 'HalfFloatType', 'WebGLRenderTarget', 'RepeatWrapping',
  // --- Window light shafts, floor light pools, screen textures
  'PlaneGeometry', 'MeshBasicMaterial', 'AdditiveBlending', 'DoubleSide',
  // --- Post-processing plumbing used directly by the game
  'Vector2', 'NoToneMapping',
];

// Add-on modules (three/examples/jsm). These are not part of the main entry
// point, so they need their own re-export lines; esbuild tree-shakes them and
// their shared three imports into the same bundle.
const ADDONS = {
  'three/addons/postprocessing/EffectComposer.js': ['EffectComposer'],
  'three/addons/postprocessing/RenderPass.js': ['RenderPass'],
  'three/addons/postprocessing/ShaderPass.js': ['ShaderPass'],
  'three/addons/postprocessing/OutputPass.js': ['OutputPass'],
  'three/addons/postprocessing/UnrealBloomPass.js': ['UnrealBloomPass'],
  // GTAOPass was evaluated and removed. It is the most expensive pass available —
  // an extra full scene render for normals, 16 occlusion samples per pixel, then a
  // Poisson denoise — and it produced a completely unoccluded (pure white) AO
  // buffer here under every combination of radius, scene clip box and depth range
  // that was tried, with the normal prepass verifiably correct throughout.
  //
  // The suspected cause is depth-texture sampling, which cannot be confirmed:
  // the only browser available to this repo's tooling is headless Chromium on
  // SwiftShader, so a depth-buffer effect can be neither verified nor ruled out
  // here. Shipping the chain's costliest pass on the strength of hoping it behaves
  // differently on real hardware is the wrong trade, so it is out until it can be
  // tested on a GPU. Re-add this entry and the 'ao' tier flag to reinstate it.
};
const ADDON_SYMBOLS = Object.values(ADDONS).flat();
const TOTAL_SYMBOLS = EXPORTS.length + ADDON_SYMBOLS.length;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'three-build-'));
const run = (cmd, args) => execFileSync(cmd, args, { cwd: tmp, stdio: ['ignore', 'pipe', 'inherit'] }).toString();

console.log(`installing three@${VERSION} …`);
fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'three-build', private: true, type: 'module' }));
run('npm', ['install', '--no-save', '--silent', `three@${VERSION}`]);

const entry = [
  '// Generated by tools/build-three.mjs — do not edit.',
  `export {\n  ${EXPORTS.join(',\n  ')},\n} from 'three';`,
  ...Object.entries(ADDONS).map(([mod, syms]) => `export { ${syms.join(', ')} } from '${mod}';`),
].join('\n') + '\n';
fs.writeFileSync(path.join(tmp, 'entry.js'), entry);

console.log('bundling …');
run('npx', ['--yes', 'esbuild', 'entry.js', '--bundle', '--format=esm', '--minify',
  '--target=es2020', '--legal-comments=none', `--outfile=three.slim.js`]);

const bundle = fs.readFileSync(path.join(tmp, 'three.slim.js'), 'utf8');
// Read the revision from the package rather than the bundle: minification renames
// the REVISION binding, so grepping the output silently yields '?'.
const pkgVersion = JSON.parse(fs.readFileSync(path.join(tmp, 'node_modules', 'three', 'package.json'), 'utf8')).version;
const rev = pkgVersion.split('.')[1];
if (!/^\d+$/.test(rev)) throw new Error(`could not derive a revision from three@${pkgVersion}`);

const banner = `/**
 * Three.js r${rev} (npm three@${VERSION}) — tree-shaken to the ${TOTAL_SYMBOLS} symbols this game
 * uses (${EXPORTS.length} from the core entry point, ${ADDON_SYMBOLS.length} post-processing add-ons).
 * Generated by tools/build-three.mjs. Do not edit by hand; re-run that script.
 * @license MIT — Copyright 2010-present Three.js Authors
 * https://github.com/mrdoob/three.js
 */
`;
fs.writeFileSync(OUT, banner + bundle);

const raw = fs.statSync(OUT).size;
const gz = zlib.gzipSync(fs.readFileSync(OUT)).length;
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n✓ wrote vendor/three.module.js`);
console.log(`  revision : r${rev}`);
console.log(`  raw      : ${(raw / 1024).toFixed(0)} KB`);
console.log(`  gzipped  : ${(gz / 1024).toFixed(0)} KB`);
console.log(`\nNext: bump VERSION in sw.js, then compare renders with tools/shot-stages.mjs.`);
