<script lang="ts">
  import { ui, S } from '../core/state.svelte';
  import { sfx, haptic } from '../core/audio';

  const tabs = [
    { id: 'studio', icon: '🏠', name: 'الاستوديو' },
    { id: 'dev', icon: '🚀', name: 'تطوير' },
    { id: 'team', icon: '👥', name: 'الفريق' },
    { id: 'market', icon: '📊', name: 'السوق' },
    { id: 'more', icon: '📦', name: 'المزيد' },
  ] as const;

  function go(id: (typeof tabs)[number]['id']) {
    ui.tab = id;
    sfx('tap');
    haptic(10);
  }
</script>

<nav>
  {#each tabs as t (t.id)}
    <button class="tab" class:active={ui.tab === t.id} onclick={() => go(t.id)}>
      <span class="icon">{t.icon}</span>
      <span class="name">{t.name}</span>
      {#if t.id === 'dev' && S.project}<span class="dot"></span>{/if}
    </button>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    bottom: 0;
    right: 0;
    left: 0;
    height: calc(var(--nav-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    display: flex;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(14px);
    border-top: 1px solid var(--line);
    z-index: 20;
  }
  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: none;
    border: none;
    border-radius: 0;
    color: var(--muted);
    position: relative;
    padding: 6px 0;
    min-height: 0;
  }
  .tab.active { color: var(--accent); }
  .tab.active .icon { transform: translateY(-2px) scale(1.15); }
  .icon { font-size: 22px; transition: transform 0.15s ease; }
  .name { font-size: 11px; font-weight: 700; }
  .dot {
    position: absolute;
    top: 8px;
    inset-inline-end: 26%;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--gold);
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse { 50% { opacity: 0.4; } }
</style>
