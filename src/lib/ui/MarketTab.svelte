<script lang="ts">
  import { S, ui } from '../core/state.svelte';
  import { fmt, loanCap, takeLoan } from '../core/game.svelte';
  import { marketShares } from '../core/sim';
  import { RIVAL_DEFS } from '../data/world';
  import { GENRES } from '../data/genres';
  import { topicById } from '../data/topics';

  const shares = $derived(marketShares(S.fans, S.rivals));
  const ranking = $derived(
    [
      { name: 'استوديوك', icon: '⭐', fans: S.fans, share: shares.player, last: S.games[S.games.length - 1]?.name ?? null, me: true },
      ...S.rivals.map((r, i) => {
        const def = RIVAL_DEFS.find((d) => d.id === r.id)!;
        return { name: def.name, icon: def.icon, fans: r.fans, share: shares.rivals[i], last: r.lastGame, me: false };
      }),
    ].sort((a, b) => b.share - a.share),
  );

  let loanAmount = $state(0);
  const cap = $derived(loanCap());
</script>

<div class="stack">
  <div class="card stack">
    <h3>📈 ذوق السوق — سنة {S.year}</h3>
    <span class="muted">
      السوق يميل هذه السنة نحو
      <b class="gold">{S.marketTaste.design > 2 ? 'التصميم' : S.marketTaste.code > 2 ? 'البرمجة' : S.marketTaste.design < -2 || S.marketTaste.code < -2 ? 'الصوت' : 'التوازن'}</b>
    </span>
    <div class="wrap">
      {#each S.marketTaste.hot as h (h)}
        <span class="chip">🔥 {topicById(h).icon} {topicById(h).name}</span>
      {/each}
    </div>
  </div>

  <h3>🏁 ترتيب السوق</h3>
  {#each ranking as r, i (r.name)}
    <div class="card spread" class:me={r.me}>
      <div class="row">
        <b class="rank">{i + 1}</b>
        <span style="font-size:22px">{r.icon}</span>
        <div>
          <b>{r.name}</b>
          <div class="muted">
            {fmt(r.fans)} معجب{r.last ? ` • آخر لعبة: ${r.last}` : ''}
          </div>
        </div>
      </div>
      <b class:gold={r.me}>{(r.share * 100).toFixed(0)}%</b>
    </div>
  {/each}
  <span class="muted">حصتك تؤثر على مبيعاتك (×0.9 حتى ×1.3) — نافس على المعجبين!</span>

  <!-- العقد النشط -->
  {#if S.contract}
    <div class="card stack" style="border-color: var(--gold)">
      <h3>📜 عقدك مع {S.contract.pubIcon} {S.contract.publisher}</h3>
      <span class="muted">
        سلّم لعبة {GENRES.find((g) => g.id === S.contract!.genre)?.name}
        {#if S.contract.topic}بموضوع {topicById(S.contract.topic).icon} {topicById(S.contract.topic).name}{/if}
        خلال {S.contract.deadline} إصدار
      </span>
      <div class="spread muted">
        <span>💰 الدفع: {fmt(S.contract.pay)}</span>
        <span class="good">جودة ≥8: +{fmt(S.contract.bonus)}</span>
        <span class="bad">غرامة: {fmt(S.contract.penalty)}</span>
      </div>
    </div>
  {/if}

  <!-- القروض -->
  <div class="card stack">
    <h3>🏦 البنك</h3>
    {#if S.loan}
      <span class="muted">قرض نشط: {fmt(S.loan.installment)} × {S.loan.remaining} أقساط متبقية (يُخصم مع كل إصدار)</span>
      <div class="bar"><div style="width:{(1 - S.loan.remaining / 8) * 100}%"></div></div>
    {:else}
      <span class="muted">سقفك الحالي {fmt(cap)} — يُسدد على 8 أقساط مع كل إصدار</span>
      <div class="row">
        {#each [0.25, 0.5, 1] as f (f)}
          <button style="flex:1" class:sel-loan={loanAmount === Math.round(cap * f)}
            onclick={() => (loanAmount = Math.round(cap * f))}>
            {fmt(cap * f)}
          </button>
        {/each}
      </div>
      <button class="btn-gold" disabled={!loanAmount} onclick={() => { takeLoan(loanAmount); loanAmount = 0; }}>
        خذ القرض
      </button>
    {/if}
  </div>
</div>

<style>
  .me { border-color: var(--accent); background: rgba(34, 211, 238, 0.07); }
  .rank { width: 22px; text-align: center; color: var(--muted); }
  .sel-loan { border-color: var(--gold); color: var(--gold); }
</style>
