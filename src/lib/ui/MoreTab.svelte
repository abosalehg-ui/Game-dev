<script lang="ts">
  import { S, ui, settings } from '../core/state.svelte';
  import { fmt, makeDlc, toast, resetAll } from '../core/game.svelte';
  import { exportSave, importSave, saveToStorage } from '../core/save';
  import { replaceState } from '../core/state.svelte';
  import { GENRES } from '../data/genres';
  import { topicById } from '../data/topics';
  import { ACHIEVEMENTS, EGGS } from '../data/events';
  import { DLC_MAX, STAGES, DIFFICULTY } from '../data/world';
  import { BALANCE } from '../core/balance';
  import { sfx } from '../core/audio';

  let view = $state<'ips' | 'history' | 'achs' | 'settings'>('ips');
  let importText = $state('');
  let confirmReset = $state(false);

  const dlcCost = $derived(Math.round(STAGES[S.stage].devCost * BALANCE.dlc.costRatio * DIFFICULTY[S.difficulty].costMult));

  function startSequel(ipId: number) {
    ui.pendingSequel = ipId;
    ui.tab = 'dev';
    sfx('tap');
  }

  function doExport() {
    saveToStorage(S);
    const code = exportSave(S);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(
        () => toast('📋', 'نُسخ رمز الحفظ للحافظة'),
        () => { importText = code; toast('💾', 'انسخ الرمز من الحقل'); },
      );
    } else {
      importText = code;
      toast('💾', 'انسخ الرمز من الحقل');
    }
  }

  function doImport() {
    const s = importSave(importText);
    if (s) {
      replaceState(s);
      S.started = true;
      saveToStorage(S);
      toast('✅', 'استُورد الحفظ بنجاح');
      importText = '';
    } else {
      toast('❌', 'رمز حفظ غير صالح — حالتك الحالية لم تتأثر');
    }
  }
</script>

<div class="stack">
  <div class="row seg">
    <button class:sel={view === 'ips'} onclick={() => (view = 'ips')}>📦 سلاسل</button>
    <button class:sel={view === 'history'} onclick={() => (view = 'history')}>📜 سجل</button>
    <button class:sel={view === 'achs'} onclick={() => (view = 'achs')}>🏆 إنجازات</button>
    <button class:sel={view === 'settings'} onclick={() => (view = 'settings')}>⚙️</button>
  </div>

  {#if view === 'ips'}
    {#if !S.ips.length}
      <div class="card muted">📦 ألعابك بتقييم ≥ 7 تصبح سلاسل (IPs) — تبني عليها أجزاء تالية وDLC</div>
    {/if}
    {#each S.ips as ip (ip.id)}
      <div class="card stack">
        <div class="spread">
          <b>{GENRES.find((g) => g.id === ip.genre)?.icon} {ip.name}</b>
          <span class="gold">★ {ip.bestScore.toFixed(1)}</span>
        </div>
        <span class="muted">
          {topicById(ip.topic).icon} {topicById(ip.topic).name}
          • أجزاء: {ip.sequels} • DLC: {ip.dlcs}/{DLC_MAX}
          {#if ip.sequels >= 3}• ⚠️ إرهاق سلسلة{/if}
        </span>
        <div class="row">
          <button style="flex:1" disabled={!!S.project} onclick={() => startSequel(ip.id)}>
            ▶️ جزء جديد (نصف التكلفة)
          </button>
          <button style="flex:1" disabled={!!S.project || ip.dlcs >= DLC_MAX || S.money < dlcCost}
            onclick={() => makeDlc(ip.id)}>
            🧩 DLC ({fmt(dlcCost)})
          </button>
        </div>
      </div>
    {/each}
  {:else if view === 'history'}
    {#if !S.games.length}
      <div class="card muted">لم تُطلق أي لعبة بعد</div>
    {/if}
    {#each [...S.games].reverse() as g, i (S.games.length - i)}
      <div class="card spread">
        <div>
          <b>{GENRES.find((x) => x.id === g.genre)?.icon} {g.name}</b>
          <div class="muted">{topicById(g.topic).icon} {topicById(g.topic).name} • سنة {g.year}{g.sequelOf != null ? ' • جزء تالٍ' : ''}</div>
        </div>
        <div style="text-align:left">
          <b class={g.score >= 8 ? 'gold' : g.score >= 6 ? 'good' : 'bad'}>★ {g.score.toFixed(1)}</b>
          <div class="muted">{fmt(g.revenue)}</div>
        </div>
      </div>
    {/each}
  {:else if view === 'achs'}
    <div class="muted" style="text-align:center">{S.achievements.length} / {ACHIEVEMENTS.length}</div>
    {#each ACHIEVEMENTS as a (a.id)}
      {@const got = S.achievements.includes(a.id)}
      <div class="card row" class:dim={!got}>
        <span style="font-size:22px">{got ? a.icon : '🔒'}</span>
        <div>
          <b>{a.name}</b>
          <div class="muted">{a.desc}</div>
        </div>
      </div>
    {/each}
    {#if S.eggsFound.length}
      <h3>🥚 بيض الفصح ({S.eggsFound.length})</h3>
      <div class="wrap">
        {#each S.eggsFound as k (k)}
          <span class="chip">{EGGS[k]?.emoji} {k}</span>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="card stack">
      <h3>⚙️ الإعدادات</h3>
      <label class="spread">
        <span>🔊 الصوت</span>
        <input type="checkbox" bind:checked={settings.sound} />
      </label>
      <label class="spread">
        <span>📳 الاهتزاز</span>
        <input type="checkbox" bind:checked={settings.haptics} />
      </label>
      <label class="spread">
        <span>🌗 الوضع الفاتح</span>
        <input type="checkbox" checked={settings.theme === 'light'}
          onchange={(e) => (settings.theme = (e.currentTarget as HTMLInputElement).checked ? 'light' : 'dark')} />
      </label>
    </div>

    <div class="card stack">
      <h3>💾 النسخ الاحتياطي</h3>
      <button onclick={doExport}>📤 تصدير الحفظ (نسخ رمز)</button>
      <textarea rows="3" placeholder="الصق رمز الحفظ هنا للاستيراد" bind:value={importText}></textarea>
      <button disabled={!importText.trim()} onclick={doImport}>📥 استيراد</button>
    </div>

    <div class="card stack">
      <h3>⚠️ منطقة الخطر</h3>
      {#if confirmReset}
        <span class="bad">متأكد؟ سيُمسح كل تقدمك نهائياً!</span>
        <div class="row">
          <button class="btn-danger" style="flex:1" onclick={resetAll}>نعم، امسح كل شيء</button>
          <button style="flex:1" onclick={() => (confirmReset = false)}>تراجع</button>
        </div>
      {:else}
        <button class="btn-danger" onclick={() => (confirmReset = true)}>🗑️ مسح الحفظ والبدء من الصفر</button>
      {/if}
    </div>

    <span class="muted" style="text-align:center">
      من الغرفة للقمة v2.0 • Prestige {S.prestige.level} • جولة {S.prestige.runs + 1}
    </span>
  {/if}
</div>

<style>
  .seg button { flex: 1; padding: 10px 6px; font-size: 13px; }
  .seg .sel { border-color: var(--accent); color: var(--accent); background: rgba(34, 211, 238, 0.1); }
  .dim { opacity: 0.5; }
  input[type='checkbox'] { width: 22px; height: 22px; accent-color: var(--accent); }
</style>
