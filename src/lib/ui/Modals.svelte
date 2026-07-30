<script lang="ts">
  import { S, ui } from '../core/state.svelte';
  import {
    fmt, afterReview, resolveMidDecision, makeContractOffer, acceptContract,
    attendConvention, takeRescueLoan, declineRescue, prestigeRestart, prestigePoints,
  } from '../core/game.svelte';
  import { GENRES } from '../data/genres';
  import { topicById } from '../data/topics';
  import { CONVENTIONS, RIVAL_DEFS } from '../data/world';
  import { ACHIEVEMENTS } from '../data/events';
  import type { Contract } from '../core/model';

  const rev = $derived(S.lastReview);
  const midExtendCost = $derived(S.project ? Math.round(S.project.cost * 0.15) : 0);
  const conv = $derived(ui.showConvention ? CONVENTIONS.find((c) => c.id === ui.showConvention) ?? null : null);
  const achDef = $derived(ui.pendingAchievement ? ACHIEVEMENTS.find((a) => a.id === ui.pendingAchievement) ?? null : null);

  // عرض العقد يتولد مرة واحدة عند فتح اللوحة
  let offer = $state<Contract | null>(null);
  $effect(() => {
    if (ui.sheet === 'contractOffer' && !offer) offer = makeContractOffer();
    if (ui.sheet !== 'contractOffer' && offer) offer = null;
  });

  function stars(avg: number): string {
    return avg >= 9 ? '🤩' : avg >= 8 ? '😍' : avg >= 6.5 ? '🙂' : avg >= 5 ? '😐' : '😞';
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && ui.pendingEvent) ui.pendingEvent = null; }} />

<!-- شاشة التقييم -->
{#if ui.showReview && rev}
  <div class="overlay center">
    <div class="modal stack">
      <div class="revhead">
        <span class="bigscore" class:gold={rev.avg >= 8}>{rev.avg.toFixed(1)}</span>
        <span style="font-size:36px">{stars(rev.avg)}</span>
      </div>
      <h2 style="text-align:center">{rev.name}</h2>
      <span class="muted" style="text-align:center">
        {GENRES.find((g) => g.id === rev.genre)?.icon} {GENRES.find((g) => g.id === rev.genre)?.name}
        • {topicById(rev.topic).icon} {topicById(rev.topic).name}
        {#if rev.isSequel}• 📦 جزء تالٍ{/if}
      </span>

      <div class="scores">
        {#each rev.scores as s, i (i)}
          <div class="rscore">
            <span class="muted">{['🎮 غيمرز', '📰 مجلة', '🎥 يوتيوبر', '⭐ نقاد'][i]}</span>
            <b class={s >= 8 ? 'gold' : s >= 6 ? 'good' : 'bad'}>{s.toFixed(1)}</b>
          </div>
        {/each}
      </div>

      <div class="card stack" style="gap:4px">
        {#each rev.notes as n (n)}<span class="muted">• {n}</span>{/each}
      </div>

      {#if rev.eggKey}
        <div class="card" style="border-color:var(--gold)">
          🥚 <b>{rev.eggKey}!</b> {rev.eggDesc} <span class="gold">(مبيعات ×{rev.eggBonus})</span>
        </div>
      {/if}

      {#if rev.contractResult}
        <div class="card" style="border-color:var(--gold)">
          📜 {rev.contractResult.label}{rev.contractResult.ok ? `: ${fmt(rev.contractResult.pay)}` : ''}
        </div>
      {/if}

      <div class="spread">
        <span>💰 الإيراد</span>
        <b class="gold">+{fmt(rev.revenue)}</b>
      </div>
      <div class="spread">
        <span>👥 المعجبون</span>
        <b class={rev.fansDelta >= 0 ? 'good' : 'bad'}>{rev.fansDelta >= 0 ? '+' : ''}{fmt(rev.fansDelta)}</b>
      </div>

      <button class="btn-primary" onclick={afterReview}>متابعة</button>
    </div>
  </div>
{/if}

<!-- قرار منتصف الإنتاج -->
{#if ui.showMidDecision && S.project}
  <div class="overlay center">
    <div class="modal stack">
      <h2>⏳ قرار منتصف الإنتاج</h2>
      <span class="muted">وصل فريقك منتصف الطريق في «{S.project.name}» — أمامك مقايضة:</span>
      <button class="opt" disabled={S.money < midExtendCost} onclick={() => resolveMidDecision('extend')}>
        <b>💰 تمديد الجدول (-{fmt(midExtendCost)})</b>
        <small class="muted">وقت إضافي = جودة أعلى (+0.35 تقييم)</small>
      </button>
      <button class="opt" onclick={() => resolveMidDecision('crunch')}>
        <b>🔥 Crunch — عمل إضافي</b>
        <small class="muted">جودة أعلى (+0.35) لكن المعنويات تنهار (-8)</small>
      </button>
      <button class="opt" onclick={() => resolveMidDecision('keep')}>
        <b>📅 الالتزام بالخطة</b>
        <small class="muted">لا مخاطرة ولا مكافأة</small>
      </button>
    </div>
  </div>
{/if}

<!-- حدث عشوائي -->
{#if ui.pendingEvent}
  <div class="overlay center" onclick={(e) => { if (e.target === e.currentTarget) ui.pendingEvent = null; }} role="presentation">
    <div class="modal stack" style="text-align:center">
      <span style="font-size:48px">{ui.pendingEvent.icon}</span>
      <h2 class={ui.pendingEvent.good ? 'good' : 'bad'}>{ui.pendingEvent.title}</h2>
      <p>{ui.pendingEvent.desc}</p>
      <button class="btn-primary" onclick={() => (ui.pendingEvent = null)}>حسناً</button>
    </div>
  </div>
{/if}

<!-- عرض عقد ناشر -->
{#if ui.sheet === 'contractOffer' && offer}
  <div class="overlay center">
    <div class="modal stack">
      <h2>{offer.pubIcon} عرض من {offer.publisher}</h2>
      <span class="muted">
        طوّر لعبة <b>{GENRES.find((g) => g.id === offer!.genre)?.name}</b>
        {#if offer.topic} بموضوع <b>{topicById(offer.topic).icon} {topicById(offer.topic).name}</b>{/if}
        خلال {offer.deadline} إصدارات
      </span>
      <div class="card stack" style="gap:4px">
        <span>💰 الدفع الثابت: <b class="gold">{fmt(offer.pay)}</b> (بدل إيراد السوق)</span>
        <span class="good">✨ جودة ≥ 8: مكافأة +{fmt(offer.bonus)}</span>
        <span class="bad">⚠️ جودة &lt; 6 أو تفويت المهلة: غرامة {fmt(offer.penalty)}</span>
        <span class="muted">📦 اللعبة ملك الناشر — لا تصبح IP لك</span>
      </div>
      <div class="row">
        <button class="btn-primary" style="flex:1" onclick={() => acceptContract(offer!)}>✍️ وقّع</button>
        <button style="flex:1" onclick={() => (ui.sheet = null)}>ارفض</button>
      </div>
    </div>
  </div>
{/if}

<!-- معرض السنة -->
{#if conv}
  <div class="overlay center">
    <div class="modal stack">
      <h2>{conv.icon} {conv.name}</h2>
      <span class="muted">{conv.desc} — هل تشارك؟</span>
      {#each conv.options as o, i (o.name)}
        <button class="opt" disabled={S.money < o.cost} onclick={() => attendConvention(conv!.id, i)}>
          <b>{o.name} ({fmt(o.cost)})</b>
          <small class="muted">+{fmt(o.money)} 💰 و+{o.fans} 👥{o.research ? ` و+${o.research} 🔬` : ''}</small>
        </button>
      {/each}
      <button class="btn-ghost" onclick={() => (ui.showConvention = null)}>تخطَّ هذه السنة</button>
    </div>
  </div>
{/if}

<!-- جائزة لعبة العام -->
{#if ui.showGoty}
  <div class="overlay center">
    <div class="modal stack" style="text-align:center">
      {#if ui.showGoty.won}
        <span style="font-size:56px">🏆</span>
        <h2 class="gold">لعبة العام!</h2>
        <p>«{ui.showGoty.name}» (★{ui.showGoty.score}) فازت بجائزة لعبة العام!</p>
        <p class="gold">+100K 💰 و+2000 معجب</p>
      {:else}
        <span style="font-size:56px">😤</span>
        <h2>خطفها المنافس!</h2>
        <p>
          «{ui.showGoty.name}» (★{ui.showGoty.score})
          من {RIVAL_DEFS.find((r) => r.id === ui.showGoty!.by)?.name ?? 'منافس'} فازت بلعبة العام
        </p>
      {/if}
      <button class="btn-primary" onclick={() => (ui.showGoty = null)}>متابعة</button>
    </div>
  </div>
{/if}

<!-- قرض الإنقاذ -->
{#if ui.sheet === 'rescueLoan'}
  <div class="overlay center">
    <div class="modal stack" style="text-align:center">
      <span style="font-size:48px">🏦</span>
      <h2>البنك يعرض قرض إنقاذ!</h2>
      <p class="muted">رصيدك {fmt(S.money)} — قرض أخير بفائدة أعلى، أو أعلن الإفلاس</p>
      <button class="btn-gold" onclick={takeRescueLoan}>💰 اقبل قرض الإنقاذ</button>
      <button class="btn-danger" onclick={declineRescue}>🏳️ أعلن الإفلاس</button>
    </div>
  </div>
{/if}

<!-- نهاية اللعبة + Prestige -->
{#if ui.showGameOver}
  <div class="overlay center">
    <div class="modal stack" style="text-align:center">
      <span style="font-size:48px">💔</span>
      <h2>أفلس الاستوديو!</h2>
      <p class="muted">{S.gamesCount} لعبة • أفضل تقييم ★{S.bestScore.toFixed(1)} • ذروة {fmt(S.peakMoney)}</p>
      <div class="card">
        <b class="gold">⭐ Prestige: +{prestigePoints()} نقطة</b>
        <div class="muted">كل نقطة = أرباح +10% في الجولة القادمة</div>
      </div>
      <button class="btn-primary" onclick={prestigeRestart}>⭐ ابدأ من جديد بقوة</button>
    </div>
  </div>
{/if}

<!-- توست وإنجاز -->
{#if achDef}
  <div class="ach">🏆 <b>{achDef.name}</b> — {achDef.desc}</div>
{/if}
{#if ui.toast}
  <div class="toast">{ui.toast.icon} {ui.toast.text}</div>
{/if}

<style>
  .revhead { display: flex; align-items: center; justify-content: center; gap: 16px; }
  .bigscore { font-size: 52px; font-weight: 900; }
  .scores { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .rscore {
    background: var(--bg-2);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
  }
  .opt { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: right; }
  .toast, .ach {
    position: fixed;
    top: calc(var(--hud-h) + 10px + env(safe-area-inset-top));
    right: 12px;
    left: 12px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 12px 16px;
    z-index: 100;
    box-shadow: var(--shadow);
    animation: slideDown 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.2);
    text-align: center;
    font-size: 14px;
  }
  .ach { border-color: var(--gold); }
  @keyframes slideDown { from { transform: translateY(-30px); opacity: 0; } }
</style>
