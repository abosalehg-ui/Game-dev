<script lang="ts">
  import { S, ui } from '../core/state.svelte';
  import { fmt, freelance, upgradeStage, prestigePoints } from '../core/game.svelte';
  import { STAGES } from '../data/world';
  import { marketShares } from '../core/sim';

  const next = $derived(S.stage < STAGES.length - 1 ? STAGES[S.stage + 1] : null);
  const share = $derived(S.rivals.length ? marketShares(S.fans, S.rivals).player : 0);
  const moraleIcon = $derived(S.morale >= 70 ? '😄' : S.morale >= 40 ? '😐' : '😟');
</script>

<div class="stack">
  <div class="card spread">
    <div>
      <h3>{STAGES[S.stage].icon} {STAGES[S.stage].name}</h3>
      <span class="muted">المرحلة {S.stage + 1} من {STAGES.length}</span>
    </div>
    <div class="stats">
      <span class="muted">🎮 {S.gamesCount} لعبة</span>
      <span class="muted">{moraleIcon} معنويات {Math.round(S.morale)}</span>
      {#if S.gamesCount >= 5}<span class="muted">📊 حصة {(share * 100).toFixed(0)}%</span>{/if}
    </div>
  </div>

  {#if next}
    <div class="card stack">
      <div class="spread">
        <h3>الترقية القادمة: {next.icon} {next.name}</h3>
        <b class="gold">{fmt(STAGES[S.stage].upgCost)}</b>
      </div>
      <span class="muted">مساحة أكبر: {next.maxPts} نقطة تطوير و{next.empCap} موظفين</span>
      <div class="bar"><div style="width: {Math.min(100, (S.money / STAGES[S.stage].upgCost) * 100)}%"></div></div>
      <button class="btn-gold" disabled={S.money < STAGES[S.stage].upgCost || !!S.project} onclick={upgradeStage}>
        🏗️ رقِّ مكتبك
      </button>
    </div>
  {:else}
    <div class="card"><h3>🏙️ وصلت القمة!</h3><span class="muted">أعلى مرحلة في اللعبة — حافظ على الصدارة</span></div>
  {/if}

  {#if !S.project}
    <button class="btn-primary" onclick={() => (ui.tab = 'dev')}>🚀 طوّر لعبة جديدة</button>
    <button onclick={freelance}>💼 عمل حر سريع <span class="muted">(دخل بسيط للطوارئ)</span></button>
  {:else}
    <div class="card row">
      <span>🚧</span>
      <div style="flex:1">
        <b>{S.project.name}</b>
        <div class="bar" style="margin-top:6px"><div style="width: {S.project.progress * 100}%"></div></div>
      </div>
      <b class="gold">{Math.round(S.project.progress * 100)}%</b>
    </div>
  {/if}

  {#if S.eventMod}
    <div class="card muted">⚡ أثر حدث نشط سيُطبق على لعبتك القادمة</div>
  {/if}

  {#if S.prestige.level > 0}
    <div class="card muted">⭐ Prestige {S.prestige.level}: أرباح +{S.prestige.level * 10}% • إعادة البدء الآن تعطيك {prestigePoints()} نقطة</div>
  {/if}
</div>

<style>
  .stats { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; font-size: 12px; }
</style>
