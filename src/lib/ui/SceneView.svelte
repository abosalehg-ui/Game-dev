<script lang="ts">
  import { onMount } from 'svelte';
  import { S, ui } from '../core/state.svelte';
  import { IsoScene } from '../scene/iso';

  let canvas: HTMLCanvasElement;
  const scene = new IsoScene();

  onMount(() => {
    scene.attach(canvas);
    return () => scene.detach();
  });

  $effect(() => {
    scene.update({
      stage: S.stage,
      people: 1 + S.employees.length,
      working: !!S.project,
      dayPhase: ((S.releasesThisYear + (S.project?.progress ?? 0)) / 4) % 1,
      celebrate: ui.showReview && (S.lastReview?.avg ?? 0) >= 8,
    });
  });
</script>

<div class="scene">
  <canvas bind:this={canvas}></canvas>
  {#if S.project}
    <div class="devbar">
      <span class="devname">🚧 {S.project.name}</span>
      <div class="bar"><div style="width: {S.project.progress * 100}%"></div></div>
    </div>
  {/if}
</div>

<style>
  .scene {
    position: relative;
    height: clamp(180px, 30dvh, 320px);
    flex-shrink: 0;
  }
  canvas { width: 100%; height: 100%; display: block; }
  .devbar {
    position: absolute;
    bottom: 8px;
    right: 12px;
    left: 12px;
    background: color-mix(in srgb, var(--bg) 75%, transparent);
    backdrop-filter: blur(8px);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .devname { font-size: 13px; font-weight: 800; }
</style>
