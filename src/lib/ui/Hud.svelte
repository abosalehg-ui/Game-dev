<script lang="ts">
  import { S } from '../core/state.svelte';
  import { fmt } from '../core/game.svelte';
  import { STAGES } from '../data/world';
</script>

<header class="hud">
  <span class="stat gold">💰 {fmt(S.money)}</span>
  <span class="stat">👥 {fmt(S.fans)}</span>
  <span class="stage">{STAGES[S.stage].icon} {STAGES[S.stage].name}</span>
  <span class="stat">🔬 {S.researchPoints}</span>
  <span class="stat muted">سنة {S.year}</span>
</header>

<style>
  .hud {
    height: var(--hud-h);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 12px;
    padding-top: env(safe-area-inset-top);
    background: color-mix(in srgb, var(--bg) 80%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
    z-index: 10;
  }
  .stage {
    background: var(--card);
    border: 1px solid var(--gold);
    color: var(--gold);
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
