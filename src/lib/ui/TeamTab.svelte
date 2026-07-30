<script lang="ts">
  import { S } from '../core/state.svelte';
  import { fmt, hire, fire, throwParty, giveBonuses, doResearch, upgradeEngine } from '../core/game.svelte';
  import { EMP_ROLES, EMP_LEVELS, STAGES, RESEARCH, ENGINE_VERSIONS } from '../data/world';
  import { salaryOf } from '../core/sim';

  let view = $state<'team' | 'research'>('team');
  let confirmFire = $state<number | null>(null);

  const cap = $derived(STAGES[S.stage].empCap);
  const totalSalaries = $derived(S.employees.reduce((a, e) => a + salaryOf(e), 0));
  const nextEngine = $derived(
    S.research.includes('engine') && S.engineVersion < ENGINE_VERSIONS.length
      ? ENGINE_VERSIONS[S.engineVersion]
      : null,
  );
  const moraleColor = $derived(S.morale >= 70 ? 'var(--good)' : S.morale >= 40 ? 'var(--gold)' : 'var(--bad)');
</script>

<div class="stack">
  <div class="row seg">
    <button class:sel={view === 'team'} onclick={() => (view = 'team')}>👥 الفريق</button>
    <button class:sel={view === 'research'} onclick={() => (view = 'research')}>🔬 الأبحاث ({S.researchPoints})</button>
  </div>

  {#if view === 'team'}
    <!-- المعنويات -->
    <div class="card stack">
      <div class="spread">
        <h3>{S.morale >= 70 ? '😄' : S.morale >= 40 ? '😐' : '😟'} معنويات الفريق</h3>
        <b style="color:{moraleColor}">{Math.round(S.morale)} / 100</b>
      </div>
      <div class="bar"><div style="width:{S.morale}%; background:{moraleColor}"></div></div>
      {#if S.morale < 30}<span class="bad">⚠️ خطر استقالات! ارفع المعنويات فوراً</span>{/if}
      <div class="row">
        <button style="flex:1" onclick={throwParty} disabled={S.money < 3000 + S.employees.length * 1500}>
          🎉 حفلة ({fmt(3000 + S.employees.length * 1500)})
        </button>
        <button style="flex:1" onclick={giveBonuses} disabled={!S.employees.length || S.money < totalSalaries}>
          💰 مكافآت ({fmt(totalSalaries)})
        </button>
      </div>
    </div>

    <div class="spread">
      <h3>الموظفون ({S.employees.length}/{cap})</h3>
      <span class="muted">رواتب {fmt(totalSalaries)}/إصدار</span>
    </div>

    {#if cap === 0}
      <div class="card muted">🛏️ غرفة النوم تسعك وحدك — رقِّ للكراج لتوظّف</div>
    {/if}

    {#each S.employees as e (e.id)}
      {@const role = EMP_ROLES.find((r) => r.id === e.role)!}
      <div class="card spread">
        <div class="row">
          <span style="font-size:24px">{role.icon}</span>
          <div>
            <b>{e.name}</b>
            <div class="muted">{role.name} • {EMP_LEVELS[e.level].name} • {fmt(salaryOf(e))}/إصدار</div>
          </div>
        </div>
        {#if confirmFire === e.id}
          <div class="row">
            <button class="btn-danger" onclick={() => { fire(e.id); confirmFire = null; }}>تأكيد</button>
            <button class="btn-ghost" onclick={() => (confirmFire = null)}>لا</button>
          </div>
        {:else}
          <button class="btn-ghost" onclick={() => (confirmFire = e.id)} aria-label="فصل {e.name}">👋</button>
        {/if}
      </div>
    {/each}

    {#if S.employees.length < cap}
      <h3>توظيف جديد <span class="muted">(تكلفة التعيين = 3 رواتب)</span></h3>
      <div class="wrap">
        {#each EMP_ROLES as r (r.id)}
          <button class="chip" disabled={S.money < r.baseSalary * 3} onclick={() => hire(r.id)}>
            {r.icon} {r.name} ({fmt(r.baseSalary * 3)})
          </button>
        {/each}
      </div>
    {/if}
  {:else}
    <!-- الأبحاث -->
    {#if nextEngine}
      <div class="card stack" style="border-color: var(--accent)">
        <div class="spread">
          <h3>⚙️ ترقية المحرك إلى v{nextEngine.v}</h3>
          <b class="gold">{fmt(nextEngine.cost)} + {nextEngine.res}🔬</b>
        </div>
        <span class="muted">خصم تكلفة {Math.round((1 - nextEngine.costDisc) * 100)}% وبونص تقييم +{nextEngine.score}</span>
        <button class="btn-primary" disabled={S.money < nextEngine.cost || S.researchPoints < nextEngine.res} onclick={upgradeEngine}>
          رقِّ المحرك
        </button>
      </div>
    {:else if S.engineVersion > 0}
      <div class="card muted">⚙️ محركك v{S.engineVersion} — أقصى إصدار!</div>
    {/if}

    {#each RESEARCH as r (r.id)}
      {@const done = S.research.includes(r.id)}
      <div class="card spread" class:done>
        <div>
          <b>{done ? '✅' : r.icon} {r.name}</b>
          <div class="muted">{r.desc}</div>
        </div>
        {#if !done}
          <button class="chip" disabled={S.researchPoints < r.cost} onclick={() => doResearch(r.id)}>
            {r.cost} 🔬
          </button>
        {/if}
      </div>
    {/each}
    <span class="muted" style="text-align:center">
      نقاط البحث: +1 لكل لعبة، و+2 إضافية لتقييم ≥ 8
    </span>
  {/if}
</div>

<style>
  .seg button { flex: 1; }
  .seg .sel { border-color: var(--accent); color: var(--accent); background: rgba(34, 211, 238, 0.1); }
  .done { opacity: 0.6; }
</style>
