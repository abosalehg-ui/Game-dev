<script lang="ts">
  import { S, replaceState } from '../core/state.svelte';
  import { startNewRun } from '../core/game.svelte';
  import { loadFromStorage } from '../core/save';
  import { DIFFICULTY, type DifficultyId } from '../data/world';
  import { sfx } from '../core/audio';

  let { hasSave }: { hasSave: boolean } = $props();
  let choosing = $state(false);

  function cont() {
    const saved = loadFromStorage();
    if (saved) {
      replaceState(saved);
      S.started = true;
      sfx('start');
    }
  }

  function pick(d: DifficultyId) {
    startNewRun(d, S.prestige.level, S.prestige.runs);
  }
</script>

<div class="start">
  <div class="logo">🎮</div>
  <h1>من الغرفة للقمة</h1>
  <p class="muted">ابدأ من غرفة نومك.. طوّر ألعاباً، وظّف فريقاً، واهزم المنافسين</p>

  {#if S.prestige.level > 0}
    <div class="chip sel">⭐ Prestige {S.prestige.level} — أرباح +{S.prestige.level * 10}%</div>
  {/if}

  {#if !choosing}
    <div class="stack" style="width: 100%; max-width: 340px;">
      {#if hasSave}
        <button class="btn-primary big" onclick={cont}>▶️ متابعة اللعب</button>
        <button class="big" onclick={() => (choosing = true)}>🆕 لعبة جديدة</button>
      {:else}
        <button class="btn-primary big" onclick={() => (choosing = true)}>🚀 ابدأ رحلتك</button>
      {/if}
    </div>
  {:else}
    <div class="stack" style="width: 100%; max-width: 340px;">
      <h2>اختر الصعوبة</h2>
      {#each Object.entries(DIFFICULTY) as [id, d] (id)}
        <button class="diff" onclick={() => pick(id as DifficultyId)}>
          <span class="dicon">{d.icon}</span>
          <span class="dtext">
            <b>{d.name}</b>
            <small class="muted">{d.desc} — تبدأ بـ {(d.startMoney / 1000)}K</small>
          </span>
        </button>
      {/each}
      <button class="btn-ghost" onclick={() => (choosing = false)}>رجوع</button>
    </div>
  {/if}
</div>

<style>
  .start {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    text-align: center;
    background:
      radial-gradient(ellipse at 20% 10%, rgba(99, 102, 241, 0.25), transparent 50%),
      radial-gradient(ellipse at 80% 90%, rgba(34, 211, 238, 0.18), transparent 50%),
      var(--bg);
  }
  .logo { font-size: 64px; animation: float 3s ease-in-out infinite; }
  @keyframes float { 50% { transform: translateY(-10px); } }
  h1 {
    font-size: 34px;
    font-weight: 900;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .big { font-size: 17px; padding: 16px; }
  .diff { display: flex; align-items: center; gap: 12px; text-align: right; }
  .dicon { font-size: 26px; }
  .dtext { display: flex; flex-direction: column; }
</style>
