/**
 * Topic-derivation test for "من الغرفة للقمة".
 *
 * The topic is no longer a chip the player taps — it is derived from the game's
 * name, so detectTopic() is now load-bearing game logic. This drives it directly
 * in the page and asserts the rules it promises:
 *   - Arabic normalisation (diacritics, hamza spellings, ة/ه, ى/ي),
 *   - the ال / و / ب / ل prefixes fusing onto a word,
 *   - plural and nisba forms matching by prefix, but only for long-enough words,
 *   - easter-egg names outranking the dictionary,
 *   - إضافة tie-breaking (the second noun is the subject),
 *   - and an unrecognised name falling back to عام instead of guessing.
 *
 * Run: `npm test`  (requires playwright + a Chromium install).
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  res.end(fs.readFileSync(fp));
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

// [name, expected topic id, what the case is guarding]
const CASES = [
  ['ملحمة الصحراء',    'desert',   'إضافة: the second noun is the subject'],
  ['حصار المجرة',      'space',    'إضافة over a strong first word'],
  ['حرب النجوم',       'space',    'إضافة beats an exact match on the head noun'],
  ['صحراء الظلام',     'desert',   'single match in the head position'],
  ['الصحراء الكبرى',   'desert',   'ال prefix stripped'],
  ['والقراصنة',        'pirates',  'وال prefix stripped'],
  ['بالحرب',           'war',      'بال prefix stripped'],
  ['بحر الظلام',       'pirates',  'short word keeps its ب (بحر is not حر)'],
  ['صحراوي',           'desert',   'nisba matches its stem by prefix'],
  ['روبوتات المستقبل', 'robots',   'plural listed explicitly'],
  ['قَافِلَة الرِّحيل',      'bedouin',  'diacritics ignored'],
  ['اساطير الخلود',    'fantasy',  'bare alef == أ'],
  ['أساطير الخلود',    'fantasy',  'hamza form == bare alef'],
  ['سقوط الخلافة',     'islamic',  'dictionary word in second position'],
  ['مدينة',            'city',     'single-word name'],
  ['زومبي',            'zombies',  'single-word name'],
  ['فيفا 2030',        'sports',   'easter egg outranks the dictionary'],
  ['ماريو',            'fantasy',  'easter egg with no dictionary word at all'],
  ['حرب فيفا',         'sports',   'easter egg beats a real dictionary match'],
  ['رحلة الأمل',       'general',  'no topic word → neutral fallback'],
  ['',                 'general',  'empty name → neutral fallback'],
  ['<img src=x>',      'general',  'markup is not a topic'],
  // Dialect, place names and synonyms added when the dictionary was widened.
  ['ليالي الدرعية',    'heritage', 'Gulf place name'],
  ['غوص اللؤلؤ',       'heritage', 'pearl diving reads as heritage, not piracy'],
  ['شوارع جدة',        'city',     'city name, not the grandmother sense of جدة'],
  ['نفود الظلام',      'desert',   'named sand sea'],
  ['قرطبة الخالدة',    'islamic',  'Andalusian city'],
  ['هجن الشمال',       'bedouin',  'racing camels'],
  ['ليوة الفجر',       'folklore', 'Gulf dance form'],
  ['مذنب الشتاء',      'space',    'comet'],
  ['منجنيق الحصار',    'war',      'siege engine is a weapon; حصار decides it'],
  ['تعويذة الملك',     'medieval', 'إضافة: ملك decides over تعويذة'],
];

const results = [];
let bootError = null;
const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
const browser = await chromium.launch(launchOpts);
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof window.detectTopic === 'function', { timeout: 15000 });

  for (const [name, expected, why] of CASES) {
    const got = await page.evaluate(n => window.detectTopic(n), name);
    results.push({ name, expected, why, got: got.id, word: got.word });
  }

  // A generated name must always resolve to a real topic — that guarantee is what
  // lets the game seed an untouched name field and still record a truthful topic.
  const generated = await page.evaluate(() => {
    const out = [];
    for (let i = 0; i < 60; i++) {
      const ids = Object.keys(window.TOPIC_WORDS);
      const ws = window.TOPIC_WORDS[ids[i % ids.length]];
      const n = ws[i % ws.length] + ' الأبطال';
      out.push(window.detectTopic(n).id);
    }
    return out;
  });
  results.generalCount = generated.filter(id => id === 'general').length;

  // Collision guard. detectTopic scores per topic, so a word listed under two of
  // them would make the winner depend on object key order instead of on the name —
  // a silent, position-dependent bug. Cheaper to forbid than to debug.
  results.collisions = await page.evaluate(() => {
    const seen = new Map(), bad = [];
    for (const [id, ws] of Object.entries(window.TOPIC_WORDS)) {
      const local = new Set();
      for (const w of ws) {
        const n = window.normAr(w);
        if (local.has(n)) bad.push(`"${w}" listed twice under ${id}`);
        local.add(n);
        if (seen.has(n) && seen.get(n) !== id) bad.push(`"${w}" in both ${seen.get(n)} and ${id}`);
        else seen.set(n, id);
      }
    }
    return bad;
  });
} catch (e) {
  bootError = e.message;
} finally {
  await browser.close();
  server.close();
}

let failed = 0;
if (bootError) { console.log('✗ could not drive the page: ' + bootError); failed++; }
for (const r of results) {
  const ok = r.got === r.expected;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} "${r.name}" → ${r.got}${r.word ? ` («${r.word}»)` : ''}${ok ? '' : ` — expected ${r.expected}`}   [${r.why}]`);
}
const genOk = results.generalCount === 0;
if (!genOk) failed++;
console.log(`${genOk ? '✓' : '✗'} every keyword-built name resolves to a real topic${genOk ? '' : ` — ${results.generalCount}/60 fell back to عام`}`);

const collisions = results.collisions || [];
if (collisions.length) failed++;
console.log(`${collisions.length ? '✗' : '✓'} no word appears under two topics${collisions.length ? ':\n    ' + collisions.join('\n    ') : ''}`);

console.log(failed ? `\n${failed} topic-detection check(s) failed` : '\nAll topic-detection checks passed');
process.exit(failed ? 1 : 0);
