<script lang="ts">
  import { onMount } from 'svelte';
  import { S, ui, settings, replaceState } from './lib/core/state.svelte';
  import { devTick } from './lib/core/game.svelte';
  import { loadFromStorage, saveToStorage } from './lib/core/save';
  import { setSoundEnabled } from './lib/core/audio';
  import StartScreen from './lib/ui/StartScreen.svelte';
  import Hud from './lib/ui/Hud.svelte';
  import SceneView from './lib/ui/SceneView.svelte';
  import BottomNav from './lib/ui/BottomNav.svelte';
  import StudioTab from './lib/ui/StudioTab.svelte';
  import DevTab from './lib/ui/DevTab.svelte';
  import TeamTab from './lib/ui/TeamTab.svelte';
  import MarketTab from './lib/ui/MarketTab.svelte';
  import MoreTab from './lib/ui/MoreTab.svelte';
  import Modals from './lib/ui/Modals.svelte';

  let hasSave = $state(false);

  onMount(() => {
    const saved = loadFromStorage();
    if (saved) {
      hasSave = true;
      replaceState(saved);
      S.started = false; // شاشة البداية تعرض «متابعة» وتعيد التشغيل عند الاختيار
    }
    try {
      const st = localStorage.getItem('rtt2.settings');
      if (st) Object.assign(settings, JSON.parse(st));
    } catch { /* ignore */ }

    // حلقة التطوير
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (S.started && S.project) devTick(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onHide = () => saveToStorage(S);
    document.addEventListener('visibilitychange', onHide);
    addEventListener('pagehide', onHide);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onHide);
      removeEventListener('pagehide', onHide);
    };
  });

  $effect(() => {
    setSoundEnabled(settings.sound);
    document.documentElement.dataset.theme = settings.theme;
    try { localStorage.setItem('rtt2.settings', JSON.stringify({ ...settings })); } catch { /* ignore */ }
  });
</script>

{#if !S.started}
  <StartScreen {hasSave} />
{:else}
  <Hud />
  <SceneView />
  <main class="content">
    {#if ui.tab === 'studio'}<StudioTab />
    {:else if ui.tab === 'dev'}<DevTab />
    {:else if ui.tab === 'team'}<TeamTab />
    {:else if ui.tab === 'market'}<MarketTab />
    {:else}<MoreTab />{/if}
  </main>
  <BottomNav />
  <Modals />
{/if}

<style>
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 12px calc(var(--nav-h) + 16px + env(safe-area-inset-bottom));
    -webkit-overflow-scrolling: touch;
  }
</style>
