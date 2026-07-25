/**
 * Long-run playthrough regression test for "من الغرفة للقمة".
 *
 * Drives ~26 consecutive releases in a real browser, handling every modal the game
 * can put on screen, and asserts the run never stalls.
 *
 * Why this exists: the post-release flow used to be five independently maintained
 * copies of "then check for an upgrade, then reopen the panel" (nextGame,
 * closeEvent, JoinConv, SkipConv, cancelUpgrade). Replacing them with a single
 * ordered POST_GAME pipeline is a behavioural change that a one-release smoke test
 * cannot cover — a mis-ordered step only shows up as a dead end several games in,
 * after a year rolls over or an award ceremony fires. This walks far enough to hit
 * the year rollover, Game of the Year, a stage upgrade, conventions and contracts.
 *
 * It plays semi-randomly on purpose: any genre/topic, always proceed. That makes it
 * a liveness test (the game must always offer a way forward) rather than a balance
 * test — tools/balance-sim.mjs covers pacing.
 *
 * Run: `npm run test:play`. Set CHROME_PATH to override the browser binary.
 */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const GAMES=Number(process.env.PLAYTHROUGH_GAMES||26);
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const fp=path.join(ROOT,p);
  if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){r.writeHead(404);r.end('nf');return;}
  r.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'});r.end(fs.readFileSync(fp));});
await new Promise(r=>server.listen(0,r));
const b=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});
const pg=await b.newPage();
const errs=[];
pg.on('pageerror',e=>errs.push('pageerror: '+e.message));
pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR/i.test(m.text()))errs.push('console: '+m.text());});
pg.on('dialog',async d=>{await d.dismiss()});
await pg.goto(`http://localhost:${server.address().port}/index.html`,{waitUntil:'domcontentloaded'});
await pg.evaluate(()=>localStorage.removeItem('gd_save'));
await pg.reload({waitUntil:'domcontentloaded'});
await pg.waitForTimeout(1200);
await pg.click('#bst'); await pg.waitForTimeout(600);

const topModal=()=>pg.evaluate(()=>{const e=document.querySelector('.os.show:not(#sp)');return e?e.id:null});
const seen=new Set(); const log=[];

async function handle(id){
  seen.add(id);
  if(id==='prodModal')      await pg.locator('#prodOpts button:not([disabled])').first().click();
  else if(id==='mktModal')  await pg.evaluate(()=>window.ChooseMkt('none'));
  else if(id==='qaModal')   await pg.locator('#qaModal .qa-opt:not([disabled])').first().click();
  else if(id==='sr2')       await pg.evaluate(()=>window.nextGame());
  else if(id==='se')        await pg.evaluate(()=>window.closeEvent());
  else if(id==='su')        await pg.evaluate(()=>window.doUpgrade());
  else if(id==='conventionModal') await pg.evaluate(()=>window.SkipConv());
  else if(id==='contractModal')   await pg.evaluate(()=>window.AcceptContract());
  else if(id==='loanModal') await pg.evaluate(()=>window.TakeLoan(0.5));
  else if(id==='sg2')       await pg.evaluate(()=>window.restartGame());
  else await pg.evaluate(x=>document.getElementById(x).classList.remove('show'),id);
  await pg.waitForTimeout(180);
}
// Wait until the review closes and the panel is usable again, handling everything on the way.
async function settle(budgetMs){
  const t0=Date.now();
  while(Date.now()-t0<budgetMs){
    const id=await topModal();
    if(id){ await handle(id); continue; }
    const devving=await pg.evaluate(()=>document.getElementById('sp').classList.contains('show'));
    if(devving){ await pg.waitForTimeout(150); continue; }
    const panel=await pg.evaluate(()=>document.getElementById('mp').classList.contains('open'));
    if(panel)return true;
    await pg.waitForTimeout(150);
  }
  return false;
}

let stopped=null,usedTrim=false;
for(let g=1;g<=GAMES;g++){
  if(!await settle(30000)){stopped='settle timeout before game '+g;break;}
  const ready=await pg.evaluate(()=>{
    const gb=[...document.querySelectorAll('#gr .sb2')].filter(x=>!x.disabled);
    const tb=[...document.querySelectorAll('#tr .sb2')].filter(x=>!x.disabled);
    if(!gb.length||!tb.length)return false;
    gb[Math.floor(Math.random()*Math.min(3,gb.length))].click();
    tb[Math.floor(Math.random()*tb.length)].click();
    return true;
  });
  if(!ready){stopped='no selectable genre/topic at game '+g;break;}
  await pg.waitForTimeout(150);
  if(!await pg.locator('#bdev').isEnabled()){
    // Over budget for this scope but not broke: the game must offer a way down.
    if(await pg.locator('#scopeTrim').isVisible()){
      await pg.evaluate(()=>window.trimScope());
      await pg.waitForTimeout(200);
      usedTrim=true;
    }
  }
  if(!await pg.locator('#bdev').isEnabled()){
    if(await pg.locator('#bfree').isVisible()){
      await pg.evaluate(()=>window.freelance());
      if(!await settle(20000)){stopped='freelance never settled at '+g;break;}
      log.push({g,act:'freelance'});continue;
    }
    const dbg=await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gd_save')||'{}');
      return {money:s.money,st:s.st,cost:document.getElementById('dcc').textContent,disabled:document.getElementById('bdev').disabled};});
    stopped='dev disabled, no freelance at game '+g+' '+JSON.stringify(dbg);break;
  }
  await pg.click('#bdev');
  if(!await settle(30000)){stopped='release never settled at game '+g;break;}
  const s=await pg.evaluate(()=>JSON.parse(localStorage.getItem('gd_save')||'{}'));
  log.push({g,gc:s.gc,st:s.st,year:s.year,money:Math.round(s.money)});
}
const fin=await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gd_save')||'{}');
  return {gc:s.gc,st:s.st,year:s.year,money:Math.round(s.money),awards:(s.awards||[]).length,ips:(s.ips||[]).length,
    resPts:(s.research||{}).points,employees:(s.employees||[]).length,loan:!!s.loan,contract:!!s.contract,
    tasteYear:(s.marketTaste||{}).year,stuck:document.querySelector('.os.show:not(#sp)')?document.querySelector('.os.show:not(#sp)').id:null};});

await b.close(); server.close();

const releases=log.filter(e=>e.gc!==undefined).length;
const checks={
  [`ran ${GAMES} turns without stalling`]: stopped===null,
  'every turn produced a release or a freelance job': log.length===GAMES,
  'release count reached the save': fin.gc>=Math.floor(GAMES*0.8),
  'the calendar advanced past year 1': fin.year>=4,
  'at least one office upgrade happened': fin.st>=2,
  'IPs accumulated from good releases': fin.ips>=1,
  'no modal was left stuck on screen': fin.stuck===null,
  'market taste tracked the current year': fin.tasteYear===fin.year,
  'the full modal set was exercised': ['mktModal','qaModal','prodModal','sr2','su'].every(m=>seen.has(m)),
  'no JS runtime errors': errs.length===0,
};
let ok=true;
for(const [name,pass] of Object.entries(checks)){
  console.log(`${pass?'✓':'✗'} ${name}`);
  if(!pass)ok=false;
}
if(usedTrim)console.log('  (the over-budget scope-trim remedy was exercised)');
console.log(`\n  turns=${log.length} releases=${releases} stage=${fin.st} year=${fin.year} money=${fin.money} awards=${fin.awards} ips=${fin.ips}`);
console.log('  modals exercised: '+[...seen].sort().join(', '));
if(stopped)console.log('  stopped: '+stopped);
if(errs.length)console.log('\nJS errors:\n'+errs.slice(0,6).join('\n'));
console.log('\n'+(ok?'PLAYTHROUGH PASS':'PLAYTHROUGH FAIL'));
process.exit(ok?0:1);
