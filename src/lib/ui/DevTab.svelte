<script lang="ts">
  import { S, ui } from '../core/state.svelte';
  import { fmt, draftCost, startProject, type ProjectDraft } from '../core/game.svelte';
  import { detectTopic, randomGameName } from '../core/topic';
  import { GENRES, type Genre } from '../data/genres';
  import { TOPICS, REAL_TOPICS, topicById } from '../data/topics';
  import { PLATFORMS, STAGES, MARKETING_TIERS, QA_MODES } from '../data/world';
  import { idealFor, synergyFor } from '../core/sim';
  import { sfx, haptic } from '../core/audio';

  let genreId = $state('action');
  let name = $state('');
  let topicOverride = $state<string | null>(null);
  let platforms = $state<string[]>(['pc']);
  let sliders = $state({ design: 3, code: 4, sound: 2 });
  let marketing = $state('none');
  let qa = $state('normal');
  let showTopicPicker = $state(false);
  const sequelIp = $derived(S.project ? null : S.ips.find((i) => i.id === ui.pendingSequel) ?? null);

  const genre = $derived(GENRES.find((g) => g.id === (sequelIp ? sequelIp.genre : genreId)) as Genre);
  const det = $derived(detectTopic(name));
  const topicId = $derived(sequelIp ? sequelIp.topic : (topicOverride ?? det.id));
  const topic = $derived(topicById(topicId));
  const maxPts = $derived(STAGES[S.stage].maxPts);
  const usedPts = $derived(sliders.design + sliders.code + sliders.sound);
  const ideal = $derived(idealFor(genre, S.marketTaste));
  const syn = $derived(synergyFor(genre.id, topicId, S.marketTaste));

  const draft = $derived<ProjectDraft>({
    genre: genre.id, name, topicOverride: sequelIp ? null : topicOverride,
    platforms, sliders, marketing, qa, parentIP: sequelIp?.id ?? null,
  });
  const cost = $derived(draftCost(draft));
  const canAfford = $derived(S.money >= cost.total);

  const synLabel = $derived(
    syn >= 2 ? { t: 'مثالية ⭐', c: 'gold' } : syn >= 1 ? { t: 'جيدة 👍', c: 'good' }
    : syn <= -1 ? { t: 'سيئة ⚠️', c: 'bad' } : { t: 'عادية', c: 'muted' },
  );

  // دقة التوزيع مقابل مثالي هذه السنة
  const balHint = $derived.by(() => {
    if (!usedPts) return { t: '—', c: 'muted' };
    const pct = [sliders.design, sliders.code, sliders.sound].map((v) => (v / usedPts) * 100);
    const dev = Math.abs(pct[0] - ideal[0]) + Math.abs(pct[1] - ideal[1]) + Math.abs(pct[2] - ideal[2]);
    return dev < 25 ? { t: 'ممتاز 🎯', c: 'good' } : dev < 55 ? { t: 'جيد', c: 'muted' } : { t: 'بعيد عن المثالي', c: 'bad' };
  });

  function toggle(pid: string) {
    if (platforms.includes(pid)) {
      if (platforms.length > 1) platforms = platforms.filter((p) => p !== pid);
    } else platforms = [...platforms, pid];
    sfx('tap');
  }

  function platFit(pid: string): string {
    const f = PLATFORMS.find((p) => p.id === pid)?.fit[genre.id] ?? 0;
    return f >= 0.15 ? '🔥' : f <= -0.15 ? '🔻' : '';
  }

  function rollName() {
    name = randomGameName();
    topicOverride = null;
    sfx('tap');
  }

  function pickTopic(id: string | null) {
    topicOverride = id;
    showTopicPicker = false;
    sfx('tap');
  }

  function begin() {
    if (startProject(draft)) {
      haptic(25);
      name = '';
      topicOverride = null;
      ui.pendingSequel = null;
    }
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') showTopicPicker = false; }} />

{#if S.project}
  <!-- التطوير جارٍ -->
  <div class="stack">
    <div class="card stack">
      <h2>🚧 {S.project.name}</h2>
      <span class="muted">
        {GENRES.find((g) => g.id === S.project!.genre)?.icon}
        {GENRES.find((g) => g.id === S.project!.genre)?.name}
        • {topicById(S.project.topic).icon} {topicById(S.project.topic).name}
      </span>
      <div class="bar big"><div style="width: {S.project.progress * 100}%"></div></div>
      <div class="spread muted">
        <span>{S.project.progress < 0.3 ? '📝 التخطيط والتصميم...' : S.project.progress < 0.55 ? '💻 البرمجة على أشدها...' : S.project.progress < 0.85 ? '🎨 الفن والصوت...' : '🔍 اللمسات الأخيرة...'}</span>
        <b class="gold">{Math.round(S.project.progress * 100)}%</b>
      </div>
    </div>
    {#if S.contract && S.project.onContract}
      <div class="card muted">📜 هذه لعبة عقد {S.contract.publisher} — الدفع عند التسليم</div>
    {/if}
  </div>
{:else}
  <div class="stack">
    {#if S.contract}
      <div class="card contract">
        <b>📜 عقد {S.contract.pubIcon} {S.contract.publisher}</b>
        <span class="muted">
          مطلوب: {GENRES.find((g) => g.id === S.contract!.genre)?.name}
          {#if S.contract.topic}بموضوع {topicById(S.contract.topic).icon} {topicById(S.contract.topic).name}{/if}
          • الدفع {fmt(S.contract.pay)} • متبقي {S.contract.deadline} إصدار
        </span>
      </div>
    {/if}

    <!-- ذوق السوق -->
    <div class="card taste">
      <span>📈 سنة {S.year}: السوق يقدّر
        <b class="gold">{S.marketTaste.design > 2 ? 'التصميم' : S.marketTaste.code > 2 ? 'البرمجة' : 'التوازن'}</b>
      </span>
      <span class="muted">🔥 رائج: {S.marketTaste.hot.map((h) => `${topicById(h).icon} ${topicById(h).name}`).join(' • ')}</span>
    </div>

    {#if sequelIp}
      <div class="card contract">
        <b>📦 جزء جديد من «{sequelIp.name}»</b>
        <span class="muted">نصف التكلفة + بونص من الأصل • الموضوع مقفل: {topicById(sequelIp.topic).icon} {topicById(sequelIp.topic).name}</span>
        <button class="btn-ghost" onclick={() => (ui.pendingSequel = null)}>إلغاء الجزء</button>
      </div>
    {:else}
      <!-- النوع -->
      <section>
        <h3>🎯 النوع</h3>
        <div class="wrap">
          {#each GENRES as g (g.id)}
            {@const locked = !!g.research && !S.research.includes(g.research)}
            <button class="chip" class:sel={genreId === g.id} class:locked disabled={locked}
              onclick={() => { genreId = g.id; sfx('tap'); }}>
              {locked ? '🔒' : g.icon} {g.name}
            </button>
          {/each}
        </div>
      </section>
    {/if}

    <!-- الاسم يحدد الموضوع -->
    <section class="stack">
      <h3>🏷️ اسم اللعبة — <span class="gold">الاسم يحدد الموضوع</span></h3>
      <div class="row">
        <input type="text" placeholder="مثال: ملحمة الصحراء" bind:value={name}
          oninput={() => (topicOverride = null)} maxlength="60" />
        <button class="dice" onclick={rollName} aria-label="اسم عشوائي">🎲</button>
      </div>
      <button class="topicline" class:locked-topic={!!sequelIp} onclick={() => !sequelIp && (showTopicPicker = true)}>
        {#if sequelIp}
          🔒 موضوع السلسلة: {topic.icon} {topic.name}
        {:else if topicOverride}
          📌 الموضوع مثبّت: {topic.icon} {topic.name} <small class="muted">(انقر للتغيير)</small>
        {:else if det.word}
          🏷️ الموضوع: <b class="gold">{topic.icon} {topic.name}</b> من «{det.word}»
        {:else}
          🎲 موضوع عام — لا توجد كلمة دالة <small class="muted">(انقر للاختيار يدوياً)</small>
        {/if}
      </button>
    </section>

    <!-- المنصات -->
    <section>
      <h3>📱 المنصات <span class="muted">(🔥 مناسبة للنوع، 🔻 غير مناسبة)</span></h3>
      <div class="wrap">
        {#each PLATFORMS as p (p.id)}
          <button class="chip" class:sel={platforms.includes(p.id)} onclick={() => toggle(p.id)}>
            {p.icon} {p.name} {platFit(p.id)}
          </button>
        {/each}
      </div>
    </section>

    <!-- توزيع النقاط -->
    <section class="stack">
      <div class="spread">
        <h3>⚙️ توزيع نقاط التطوير</h3>
        <b class:gold={usedPts <= maxPts} class:bad={usedPts > maxPts}>{usedPts} / {maxPts}</b>
      </div>
      <div class="axis">
        <div class="spread">
          <span>🎨 تصميم</span>
          <span class="row" style="gap:6px">
            <small class="muted">مثالي ~{Math.round(ideal[0] / 100 * maxPts)}</small>
            <b>{sliders.design}</b>
          </span>
        </div>
        <input type="range" min="0" max={maxPts} bind:value={sliders.design} />
      </div>
      <div class="axis">
        <div class="spread">
          <span>💻 برمجة</span>
          <span class="row" style="gap:6px">
            <small class="muted">مثالي ~{Math.round(ideal[1] / 100 * maxPts)}</small>
            <b>{sliders.code}</b>
          </span>
        </div>
        <input type="range" min="0" max={maxPts} bind:value={sliders.code} />
      </div>
      <div class="axis">
        <div class="spread">
          <span>🔊 صوت</span>
          <span class="row" style="gap:6px">
            <small class="muted">مثالي ~{Math.round(ideal[2] / 100 * maxPts)}</small>
            <b>{sliders.sound}</b>
          </span>
        </div>
        <input type="range" min="0" max={maxPts} bind:value={sliders.sound} />
      </div>
      {#if usedPts > maxPts * 0.7}
        <span class="muted">💸 النقاط فوق {Math.floor(maxPts * 0.7)} ترفع التكلفة 5% لكل نقطة</span>
      {/if}
    </section>

    <!-- خطة الإطلاق -->
    <section class="stack">
      <h3>📢 التسويق</h3>
      <div class="wrap">
        {#each MARKETING_TIERS as m (m.id)}
          <button class="chip" class:sel={marketing === m.id} onclick={() => { marketing = m.id; sfx('tap'); }}>
            {m.icon} {m.name} {m.cost ? `(${fmt(m.cost)})` : ''}
          </button>
        {/each}
      </div>
      <h3>🔍 ضمان الجودة</h3>
      <div class="stack" style="gap:6px">
        {#each QA_MODES as q (q.id)}
          <button class="qa" class:sel={qa === q.id} onclick={() => { qa = q.id; sfx('tap'); }}>
            <b>{q.icon} {q.name}</b>
            <small class="muted">{q.desc}</small>
          </button>
        {/each}
      </div>
    </section>

    <!-- التقييم المسبق -->
    <div class="card verdict">
      <span>التوليفة: <b class={synLabel.c}>{synLabel.t}</b></span>
      <span>التوزيع: <b class={balHint.c}>{balHint.t}</b></span>
    </div>

    <button class="btn-primary launch" disabled={!canAfford || usedPts === 0 || usedPts > maxPts} onclick={begin}>
      🚀 طوّر اللعبة — {fmt(cost.total)}
    </button>
    {#if !canAfford}
      <span class="muted" style="text-align:center">
        رصيدك لا يكفي — جرّب 💼 العمل الحر أو 🏦 قرضاً أو قلّص النطاق
      </span>
    {/if}
  </div>

  {#if showTopicPicker}
    <div class="overlay" onclick={(e) => { if (e.target === e.currentTarget) showTopicPicker = false; }} role="presentation">
      <div class="modal stack" role="dialog" aria-modal="true" aria-label="اختيار الموضوع">
        <h2>اختر الموضوع</h2>
        <span class="muted">أو اكتب اسماً يحمل كلمة دالة — التوافق مع {genre.icon} {genre.name}:</span>
        <div class="wrap">
          <button class="chip" class:sel={topicOverride === null && det.id === 'general'} onclick={() => pickTopic(null)}>
            🎲 من الاسم
          </button>
          {#each REAL_TOPICS as t (t.id)}
            {@const s = synergyFor(genre.id, t.id, S.marketTaste)}
            <button class="chip" class:sel={topicOverride === t.id} onclick={() => pickTopic(t.id)}>
              {t.icon} {t.name}
              <small class={s >= 2 ? 'gold' : s >= 1 ? 'good' : s <= -1 ? 'bad' : 'muted'}>
                {s > 0 ? `+${s}` : s}
              </small>
              {#if S.topicsShipped.includes(t.id)}✓{/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  section { display: flex; flex-direction: column; gap: 8px; }
  .dice { font-size: 20px; padding: 10px 14px; flex-shrink: 0; }
  .topicline {
    text-align: right;
    background: var(--bg-2);
    border: 1.5px dashed var(--line);
    font-size: 14px;
  }
  .topicline.locked-topic { border-style: solid; opacity: 0.8; }
  .axis { display: flex; flex-direction: column; gap: 2px; }
  .qa { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: right; }
  .qa.sel { border-color: var(--accent); background: rgba(34, 211, 238, 0.1); }
  .chip small { font-weight: 800; }
  .verdict { display: flex; justify-content: space-around; font-size: 14px; }
  .launch { font-size: 17px; padding: 16px; }
  .bar.big { height: 16px; }
  .taste { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .contract { display: flex; flex-direction: column; gap: 6px; border-color: var(--gold); }
</style>
