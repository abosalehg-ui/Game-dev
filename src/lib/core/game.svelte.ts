// طبقة أفعال اللعبة: كل ما يغيّر الحالة يمر من هنا.
// المعادلات نفسها تعيش في sim.ts نقية، وهذه الوحدة توصلها بالحالة والواجهة.

import { S, ui, replaceState } from './state.svelte';
import { initialState, type Contract, type Project, type ReviewResult } from './model';
import { BALANCE } from './balance';
import {
  computeScore, computeSales, devCost, initRivals, marketShares, rollMarketTaste,
  salaryOf, skillBonuses, stepRivals, genreById, synergyFor,
} from './sim';
import { detectTopic, randomGameName } from './topic';
import { GENRES } from '../data/genres';
import { topicById, REAL_TOPICS } from '../data/topics';
import {
  STAGES, DIFFICULTY, EMP_ROLES, EMP_LEVELS, EMP_NAMES, ENGINE_VERSIONS,
  RESEARCH, PUBLISHERS, LOAN_INTEREST, CONVENTIONS, MARKETING_TIERS, QA_MODES,
  DLC_MAX, type DifficultyId,
} from '../data/world';
import { EVENTS, EGGS, ACHIEVEMENTS } from '../data/events';
import { saveToStorage, clearStorage } from './save';
import { sfx } from './audio';

export function toast(icon: string, text: string): void {
  ui.toast = { icon, text };
  setTimeout(() => { if (ui.toast?.text === text) ui.toast = null; }, 3000);
}

function persist(): void {
  saveToStorage(S);
}

// ---- بدء اللعب --------------------------------------------------------------

export function startNewRun(difficulty: DifficultyId, prestigeLevel = 0, runs = 0): void {
  const st = initialState(difficulty, DIFFICULTY[difficulty].startMoney);
  st.started = true;
  st.rivals = initRivals();
  st.marketTaste = rollMarketTaste(1);
  st.prestige = { level: prestigeLevel, runs };
  replaceState(st);
  ui.showGameOver = false;
  ui.tab = 'studio';
  persist();
}

// ---- المشروع: الإعداد -------------------------------------------------------

export interface ProjectDraft {
  genre: string;
  name: string;
  topicOverride: string | null;
  platforms: string[];
  sliders: { design: number; code: number; sound: number };
  marketing: string;
  qa: string;
  parentIP: number | null;
}

export function draftCost(d: ProjectDraft): { dev: number; marketing: number; qa: number; total: number } {
  const dev = devCost({
    stage: S.stage,
    sliders: d.sliders,
    platforms: d.platforms,
    difficulty: S.difficulty,
    engineVersion: S.engineVersion,
    research: S.research,
    parentIP: d.parentIP != null,
    eventStrike: S.eventMod === 'strike',
  });
  const marketing = MARKETING_TIERS.find((m) => m.id === d.marketing)?.cost ?? 0;
  const qaRatio = QA_MODES.find((q) => q.id === d.qa)?.costRatio ?? 0;
  const qa = Math.round(dev * qaRatio);
  return { dev, marketing, qa, total: dev + marketing + qa };
}

export function startProject(d: ProjectDraft): boolean {
  if (S.project) return false;
  const cost = draftCost(d);
  if (S.money < cost.total) return false;
  const name = d.name.trim().slice(0, 60) || randomGameName();
  const det = detectTopic(name);
  const parent = d.parentIP != null ? S.ips.find((i) => i.id === d.parentIP) : null;
  // الجزء التالي يرث موضوع سلسلته مهما تغير الاسم.
  const topic = parent ? parent.topic : (d.topicOverride ?? det.id);

  S.money -= cost.total;
  if (S.eventMod === 'strike') S.eventMod = null;
  S.project = {
    name,
    genre: parent ? parent.genre : d.genre,
    topic,
    topicWord: det.word,
    topicLocked: !!parent || d.topicOverride != null,
    platforms: [...d.platforms],
    sliders: { ...d.sliders },
    marketing: d.marketing,
    qa: d.qa,
    cost: cost.total,
    progress: 0,
    midDecision: 'pending',
    scoreBonus: 0,
    parentIP: parent ? parent.id : null,
    onContract: !!S.contract && (parent ? parent.genre : d.genre) === S.contract.genre,
  };
  sfx('start');
  persist();
  return true;
}

// ---- المشروع: التقدم --------------------------------------------------------

/** مدة التطوير الكلية بالثواني الحقيقية */
const DEV_SECONDS = 16;

/** يتقدم التطوير؛ يعيد true إن أطلقت اللعبة في هذه النبضة */
export function devTick(dt: number): boolean {
  const p = S.project;
  if (!p || ui.showMidDecision || ui.showReview) return false;
  const speed = 1 + S.employees.length * 0.04; // الفريق يسرّع العمل قليلاً (شكلياً)
  p.progress = Math.min(1, p.progress + (dt / DEV_SECONDS) * speed);
  S.week += dt / 2.2 > 1 ? 1 : 0; // الأسابيع تتقدم مع العمل
  if (p.midDecision === 'pending' && p.progress >= 0.55) {
    p.midDecision = 'shown';
    ui.showMidDecision = true;
    sfx('event');
    return false;
  }
  if (p.progress >= 1) {
    launch();
    return true;
  }
  return false;
}

export type MidChoice = 'extend' | 'crunch' | 'keep';

export function resolveMidDecision(choice: MidChoice): void {
  const p = S.project;
  if (!p) return;
  const extendCost = Math.round(p.cost * 0.15);
  if (choice === 'extend' && S.money >= extendCost) {
    S.money -= extendCost;
    p.scoreBonus += 0.35;
    toast('⏳', `تمديد الجدول: -${fmt(extendCost)} و+0.35 تقييم`);
  } else if (choice === 'crunch') {
    S.morale = Math.max(0, S.morale + BALANCE.morale.crunch * 2);
    p.scoreBonus += 0.35;
    toast('🔥', 'Crunch! المعنويات انخفضت مقابل جودة أعلى');
  }
  p.midDecision = 'done';
  ui.showMidDecision = false;
  persist();
}

// ---- الإطلاق ----------------------------------------------------------------

function fmt(n: number): string {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}

function reviewerNotes(avg: number, syn: number, bal: number, scope: number, bugCount: number): string[] {
  const notes: string[] = [];
  notes.push(syn >= 2 ? 'توليفة النوع والموضوع ممتازة!' : syn >= 1 ? 'توليفة جيدة بين النوع والموضوع.' : syn <= -1 ? 'النوع والموضوع لا يتناسبان.' : 'توليفة عادية.');
  notes.push(bal >= 0.75 ? 'توزيع نقاط قريب من المثالي.' : bal >= 0.45 ? 'توزيع النقاط مقبول.' : 'توزيع النقاط بعيد عن حاجة النوع.');
  if (scope < 0.6) notes.push('حجم المشروع صغير على طموح السوق.');
  if (bugCount > 2) notes.push(`أطلقت وفيها ${bugCount} بَقّات واضحة!`);
  else if (bugCount === 0 && avg >= 7) notes.push('إطلاق نظيف بلا مشاكل تقنية.');
  return notes;
}

export function launch(): void {
  const p = S.project;
  if (!p) return;

  const parent = p.parentIP != null ? S.ips.find((i) => i.id === p.parentIP) ?? null : null;
  const eggKey = Object.keys(EGGS).find((k) => p.name.includes(k)) ?? null;
  const egg = eggKey ? EGGS[eggKey] : null;

  const q = computeScore({
    genreId: p.genre,
    topicId: p.topic,
    sliders: p.sliders,
    stage: S.stage,
    taste: S.marketTaste,
    employees: S.employees,
    morale: S.morale,
    research: S.research,
    engineVersion: S.engineVersion,
    qa: p.qa,
    eventMod: S.eventMod,
    midBonus: p.scoreBonus,
    expectation: S.expectation,
    parentIP: parent ? { bestScore: parent.bestScore, sequels: parent.sequels } : null,
  });
  if (q.clearedEventMod) S.eventMod = null;
  S.expectation = q.newExpectation;

  const shares = marketShares(S.fans, S.rivals);
  const mkt = MARKETING_TIERS.find((m) => m.id === p.marketing) ?? MARKETING_TIERS[0];
  const sales = computeSales({
    avg: q.avg,
    fans: S.fans,
    stage: S.stage,
    genreId: p.genre,
    topicId: p.topic,
    platforms: p.platforms,
    marketingBonus: mkt.bonus,
    hype: mkt.hype,
    marketerSkill: q.bonus.marketing,
    eggBonus: egg?.bonus ?? 1,
    eventMod: S.eventMod,
    trendTopic: S.trendTopic,
    isSequel: !!parent,
    difficulty: S.difficulty,
    prestigeLevel: S.prestige.level,
    playerShare: shares.player,
    research: S.research,
  });
  if (sales.clearedEventMod) S.eventMod = null;

  // تسوية عقد الناشر: لعبة العقد تُدفع بسعره لا بسعر السوق، وبلا IP.
  let contractResult: ReviewResult['contractResult'] = null;
  let revenue = sales.revenue;
  if (p.onContract && S.contract) {
    const c = S.contract;
    const topicOk = !c.topic || p.topic === c.topic;
    if (topicOk) {
      let pay = c.pay;
      let label = 'سلّمت العقد';
      if (q.avg >= 8) { pay += c.bonus; label = 'سلّمت العقد بجودة عالية! مكافأة'; }
      else if (q.avg < 6) { pay -= c.penalty; label = 'جودة أقل من المتفق — غرامة'; }
      revenue = Math.max(0, Math.round(pay));
      contractResult = { ok: true, pay: revenue, label };
      S.contract = null;
    } else {
      contractResult = { ok: false, pay: 0, label: `العقد يطلب موضوع ${topicById(c.topic!).name} — لم يُحتسب التسليم` };
    }
  }

  S.money += revenue;
  S.fans = Math.max(0, S.fans + sales.fansDelta);
  S.gamesCount++;
  S.releasesThisYear++;
  if (q.avg > S.bestScore) S.bestScore = q.avg;
  S.streak8 = q.avg >= 8 ? S.streak8 + 1 : 0;
  if (S.money > S.peakMoney) S.peakMoney = S.money;

  // معنويات
  if (q.avg >= 8) S.morale = Math.min(100, S.morale + BALANCE.morale.great);
  else if (q.avg >= 6) S.morale = Math.min(100, S.morale + BALANCE.morale.good);
  else if (q.avg < 4) S.morale = Math.max(0, S.morale + BALANCE.morale.flop);

  // نقاط بحث
  S.researchPoints += BALANCE.research.perGame + (q.avg >= BALANCE.research.highScoreAt ? BALANCE.research.highScoreBonus : 0);

  // خبرة وترقيات
  for (const e of S.employees) {
    e.xp++;
    const need = [3, 8, 15][e.level];
    if (need && e.xp >= need && e.level < EMP_LEVELS.length - 1) {
      e.level++;
      toast('🎖️', `${e.name} ترقّى إلى ${EMP_LEVELS[e.level].name}!`);
    }
  }

  // رواتب
  const salaries = S.employees.reduce((a, e) => a + salaryOf(e), 0);
  if (salaries) S.money -= salaries;

  // قسط القرض
  if (S.loan) {
    S.money -= S.loan.installment;
    S.loan.remaining--;
    if (S.loan.remaining <= 0) {
      S.loan = null;
      S.loansRepaid++;
      toast('🏦', 'سدّدت القرض كاملاً!');
    }
  }

  // استقالات تحت الضغط
  if (S.morale < BALANCE.morale.resignBelow && S.employees.length && Math.random() < BALANCE.morale.resignChance) {
    const i = (Math.random() * S.employees.length) | 0;
    const gone = S.employees.splice(i, 1)[0];
    toast('🚪', `${gone.name} استقال بسبب انهيار المعنويات!`);
  }

  // سجلات
  if (eggKey && !S.eggsFound.includes(eggKey)) S.eggsFound.push(eggKey);
  if (p.topic !== 'general' && !S.topicsShipped.includes(p.topic)) S.topicsShipped.push(p.topic);
  S.games.push({
    name: p.name, genre: p.genre, topic: p.topic, score: q.avg, revenue,
    week: S.week, year: S.year, ...(parent ? { sequelOf: parent.id } : {}),
  });
  if (S.games.length > 300) S.games.splice(0, S.games.length - 300);

  // سلاسل: لعبة ≥7 بلا عقد تصبح IP، والجزء التالي يحدّث سلسلته.
  if (parent) {
    parent.sequels++;
    if (q.avg > parent.bestScore) parent.bestScore = q.avg;
  } else if (q.avg >= 7 && !contractResult) {
    S.ips.push({
      id: S.nextIpId++, name: p.name, genre: p.genre, topic: p.topic,
      bestScore: q.avg, sequels: 0, dlcs: 0, lastDlcRev: 0,
    });
  }

  // المنافسون يتحركون بعد كل إصدار
  stepRivals(S.rivals, S.stage);

  // نتيجة العرض
  S.lastReview = {
    name: p.name,
    genre: p.genre,
    topic: p.topic,
    scores: q.scores,
    avg: q.avg,
    revenue,
    fansDelta: sales.fansDelta,
    bugCount: q.bugCount,
    eggKey,
    eggDesc: egg?.desc ?? null,
    eggBonus: egg?.bonus ?? 1,
    contractResult,
    notes: reviewerNotes(q.avg, q.syn, q.bal, q.scope, q.bugCount),
    isSequel: !!parent,
  };
  S.project = null;
  ui.showReview = true;
  sfx(q.avg >= 8 ? 'fanfare' : 'release');

  // مهلة العقد تحترق مع كل إصدار لا يسلّمه
  if (S.contract && !contractResult) {
    S.contract.deadline--;
    if (S.contract.deadline <= 0) {
      S.money -= S.contract.penalty;
      toast('📜', `انقضت مهلة العقد! غرامة ${fmt(S.contract.penalty)}`);
      S.contract = null;
    }
  }

  checkAchievements();
  persist();
}

/** يُستدعى عند إغلاق شاشة التقييم: أحداث السنة والفعاليات والعروض */
export function afterReview(): void {
  ui.showReview = false;

  // نهاية سنة كل 4 إصدارات: جائزة، ذوق جديد، معرض
  if (S.releasesThisYear >= 4) {
    S.releasesThisYear = 0;
    S.year++;
    endOfYear();
  } else {
    maybeEvent();
    maybeContractOffer();
  }
  maybeBankruptcy();
  persist();
}

function endOfYear(): void {
  // جائزة لعبة العام
  const myBest = S.games.filter((g) => g.year === S.year - 1).reduce(
    (best, g) => (g.score > (best?.score ?? 0) ? g : best), null as { name: string; score: number } | null,
  );
  const rivalBest = S.rivals.reduce(
    (best, r) => (r.bestThisYear > (best?.score ?? 0) ? { name: r.bestName ?? 'لعبة منافسة', score: r.bestThisYear, by: r.id } : best),
    null as { name: string; score: number; by: string } | null,
  );
  if (myBest && myBest.score >= 8.5 && myBest.score >= (rivalBest?.score ?? 0)) {
    S.money += 100000;
    S.fans += 2000;
    S.gotyWins++;
    S.awards.push({ year: S.year - 1, name: myBest.name, score: myBest.score });
    ui.showGoty = { won: true, name: myBest.name, score: myBest.score };
    sfx('fanfare');
  } else if (rivalBest && rivalBest.score >= 8.5) {
    ui.showGoty = { won: false, name: rivalBest.name, score: Math.round(rivalBest.score * 10) / 10, by: rivalBest.by };
  }
  for (const r of S.rivals) { r.bestThisYear = 0; r.bestName = null; }

  S.marketTaste = rollMarketTaste(S.year);
  // معرض السنة بالتناوب
  ui.showConvention = CONVENTIONS[(S.year - 2) % CONVENTIONS.length].id;
}

function maybeEvent(): void {
  if (Math.random() >= BALANCE.events.chance) return;
  const ev = EVENTS[(Math.random() * EVENTS.length) | 0];
  let desc = ev.desc;
  switch (ev.type) {
    case 'trend': {
      const t = REAL_TOPICS[(Math.random() * REAL_TOPICS.length) | 0];
      S.trendTopic = t.id;
      S.eventMod = 'trend';
      desc = desc.replace('{topic}', `${t.icon} ${t.name}`);
      break;
    }
    case 'recession': S.eventMod = 'recession'; break;
    case 'publisher': S.eventMod = 'publisher'; break;
    case 'piracy': S.eventMod = 'piracy'; break;
    case 'festival': S.eventMod = 'festival'; break;
    case 'quit': S.eventMod = 'quit'; break;
    case 'strike': S.eventMod = 'strike'; break;
    case 'competitor': S.fans = Math.max(0, Math.floor(S.fans * 0.85)); break;
    case 'hack': S.money -= Math.round(Math.max(0, S.money) * (ev.desc.includes('15%') ? 0.15 : 0.2)); break;
    case 'buyout': {
      const last = S.games[S.games.length - 1];
      const bonus = Math.max(10000, Math.round((last?.revenue ?? 0) * 0.4));
      S.money += bonus;
      desc = `شركة كبيرة اشترت حقوق لعبتك الأخيرة! +${fmt(bonus)} 💰`;
      break;
    }
    case 'gift': S.money += 15000; break;
    case 'viral': S.fans += 800; break;
    case 'youtuber': S.fans += 1200; break;
    case 'award': S.fans += 500; break;
    case 'moraleDown': S.morale = Math.max(0, S.morale - 12); break;
    case 'moraleUp': S.morale = Math.min(100, S.morale + 10); break;
  }
  ui.pendingEvent = { icon: ev.icon, title: ev.title, desc, good: ev.good };
  sfx('event');
}

// ---- عقود الناشرين ----------------------------------------------------------

export function makeContractOffer(): Contract {
  const pub = PUBLISHERS[(Math.random() * PUBLISHERS.length) | 0];
  const unlocked = GENRES.filter((g) => !g.research || S.research.includes(g.research));
  const genre = unlocked[(Math.random() * unlocked.length) | 0];
  // نصف العروض تطلب موضوعاً — يُختار دائماً من المتوافق (توافق ≥ 0) فلا عقد مستحيلاً.
  let topic: string | null = null;
  if (Math.random() < BALANCE.contracts.topicChance) {
    const ok = REAL_TOPICS.filter((t) => synergyFor(genre.id, t.id, S.marketTaste) >= 0);
    if (ok.length) topic = ok[(Math.random() * ok.length) | 0].id;
  }
  let pay = Math.round(STAGES[S.stage].devCost * (1.8 + Math.random() * 0.8));
  if (topic) pay = Math.round(pay * BALANCE.contracts.topicPayBonus);
  return {
    publisher: pub.name,
    pubIcon: pub.icon,
    genre: genre.id,
    topic,
    pay,
    bonus: Math.round(pay * 0.5),
    penalty: Math.round(pay * 0.3),
    deadline: BALANCE.contracts.deadline,
  };
}

function maybeContractOffer(): void {
  if (S.contract || ui.pendingEvent || S.gamesCount < 3) return;
  if (Math.random() >= BALANCE.contracts.chance) return;
  ui.sheet = 'contractOffer';
}

export function acceptContract(c: Contract): void {
  S.contract = c;
  ui.sheet = null;
  toast('📜', `وقّعت عقد ${c.publisher} — سلّم خلال ${c.deadline} إصدارات`);
  persist();
}

// ---- الإفلاس و Prestige -----------------------------------------------------

function maybeBankruptcy(): void {
  if (S.money >= 0) return;
  // قرض إنقاذ أخير إن لم يكن عليه قرض
  if (!S.loan) {
    ui.sheet = 'rescueLoan';
    return;
  }
  ui.showGameOver = true;
  sfx('fail');
}

export function prestigePoints(): number {
  return Math.max(1, Math.floor(S.gamesCount / 5) + Math.floor(S.peakMoney / 1e6) + S.gotyWins);
}

export function prestigeRestart(): void {
  const pts = prestigePoints();
  const level = S.prestige.level + pts;
  const runs = S.prestige.runs + 1;
  const diff = S.difficulty;
  startNewRun(diff, level, runs);
  toast('⭐', `Prestige ${level} — أرباح +${level * 10}%`);
  checkAchievements();
}

// ---- أفعال جانبية -----------------------------------------------------------

export function freelance(): void {
  if (S.project) return;
  const stg = STAGES[S.stage];
  const raw = stg.devCost * 0.4 * DIFFICULTY[S.difficulty].rewardMult + Math.random() * stg.devCost * 0.2;
  const cap = 15000 + S.stage * 12000;
  const earn = Math.floor(Math.min(raw, cap));
  S.money += earn;
  S.freelanceCount++;
  toast('💼', `عمل حر: +${fmt(earn)}`);
  sfx('coin');
  persist();
}

export function hire(roleId: string): boolean {
  const role = EMP_ROLES.find((r) => r.id === roleId);
  if (!role) return false;
  if (S.employees.length >= STAGES[S.stage].empCap) return false;
  const cost = role.baseSalary * 3;
  if (S.money < cost) return false;
  S.money -= cost;
  S.employees.push({
    id: S.nextEmpId++,
    name: EMP_NAMES[(Math.random() * EMP_NAMES.length) | 0],
    role: roleId,
    level: 0,
    xp: 0,
  });
  sfx('coin');
  persist();
  return true;
}

export function fire(empId: number): void {
  const i = S.employees.findIndex((e) => e.id === empId);
  if (i < 0) return;
  const gone = S.employees.splice(i, 1)[0];
  S.morale = Math.max(0, S.morale - 5);
  toast('👋', `ودّعت ${gone.name} — المعنويات تأثرت`);
  persist();
}

export function throwParty(): boolean {
  const cost = 3000 + S.employees.length * 1500;
  if (S.money < cost) return false;
  S.money -= cost;
  S.morale = Math.min(100, S.morale + 15);
  toast('🎉', 'حفلة للفريق! المعنويات +15');
  sfx('fanfare');
  persist();
  return true;
}

export function giveBonuses(): boolean {
  const cost = S.employees.reduce((a, e) => a + salaryOf(e), 0);
  if (!cost || S.money < cost) return false;
  S.money -= cost;
  S.morale = Math.min(100, S.morale + 8);
  toast('💰', 'مكافآت للجميع! المعنويات +8');
  persist();
  return true;
}

export function doResearch(id: string): boolean {
  const node = RESEARCH.find((r) => r.id === id);
  if (!node || S.research.includes(id) || S.researchPoints < node.cost) return false;
  S.researchPoints -= node.cost;
  S.research.push(id);
  if (id === 'engine') S.engineVersion = 1;
  toast('🔬', `أنجزت بحث: ${node.name}`);
  sfx('research');
  checkAchievements();
  persist();
  return true;
}

export function upgradeEngine(): boolean {
  const next = ENGINE_VERSIONS[S.engineVersion]; // الإصدار التالي (فهرس = الحالي)
  if (!S.research.includes('engine') || !next || S.engineVersion >= ENGINE_VERSIONS.length) return false;
  if (S.money < next.cost || S.researchPoints < next.res) return false;
  S.money -= next.cost;
  S.researchPoints -= next.res;
  S.engineVersion = next.v;
  toast('⚙️', `محركك الآن v${next.v}!`);
  checkAchievements();
  persist();
  return true;
}

export function upgradeStage(): boolean {
  const cost = STAGES[S.stage].upgCost;
  if (S.stage >= STAGES.length - 1 || S.money < cost) return false;
  S.money -= cost;
  S.stage++;
  toast('🏗️', `انتقلت إلى ${STAGES[S.stage].icon} ${STAGES[S.stage].name}!`);
  sfx('fanfare');
  checkAchievements();
  persist();
  return true;
}

export function loanCap(): number {
  return STAGES[S.stage].devCost * 8;
}

export function takeLoan(amount: number): boolean {
  if (S.loan || amount <= 0 || amount > loanCap()) return false;
  const interest = LOAN_INTEREST[S.difficulty];
  const total = amount * (1 + interest);
  S.loan = { principal: amount, installment: Math.ceil(total / 8), remaining: 8 };
  S.money += amount;
  toast('🏦', `قرض ${fmt(amount)} — يُسدد على 8 أقساط`);
  persist();
  return true;
}

export function takeRescueLoan(): void {
  const amount = Math.min(loanCap(), Math.abs(S.money) + STAGES[S.stage].devCost * 2);
  const interest = LOAN_INTEREST[S.difficulty] + 0.1; // قرض الإنقاذ أغلى
  S.loan = { principal: amount, installment: Math.ceil((amount * (1 + interest)) / 8), remaining: 8 };
  S.money += amount;
  ui.sheet = null;
  toast('🏦', `قرض إنقاذ ${fmt(amount)} — آخر فرصة!`);
  persist();
}

export function declineRescue(): void {
  ui.sheet = null;
  ui.showGameOver = true;
  sfx('fail');
}

export function makeDlc(ipId: number): boolean {
  const ip = S.ips.find((i) => i.id === ipId);
  if (!ip || ip.dlcs >= DLC_MAX || S.project) return false;
  const D = BALANCE.dlc;
  const cost = Math.round(STAGES[S.stage].devCost * D.costRatio * DIFFICULTY[S.difficulty].costMult);
  if (S.money < cost) return false;
  S.money -= cost;
  let rev = Math.pow(ip.bestScore, D.scoreExponent) * D.unit * (1 + S.fans * D.fanWeight) * D.stageRevenue(S.stage);
  rev *= Math.pow(D.fatigue, ip.dlcs);
  rev *= DIFFICULTY[S.difficulty].rewardMult;
  const revenue = Math.floor(rev);
  S.money += revenue;
  const fans = Math.floor(D.fansBase + ip.bestScore * D.fansPerScore);
  S.fans += fans;
  ip.dlcs++;
  ip.lastDlcRev = revenue;
  toast('🧩', `DLC لـ«${ip.name}»: +${fmt(revenue)} و+${fans} معجب`);
  sfx('coin');
  persist();
  return true;
}

export function attendConvention(convId: string, optIdx: number): boolean {
  const conv = CONVENTIONS.find((c) => c.id === convId);
  const opt = conv?.options[optIdx];
  if (!conv || !opt || S.money < opt.cost) return false;
  S.money -= opt.cost;
  S.money += opt.money;
  S.fans += opt.fans;
  if (opt.research) S.researchPoints += opt.research;
  ui.showConvention = null;
  toast(conv.icon, `${conv.name}: +${fmt(opt.money)} و+${opt.fans} معجب${opt.research ? ` و+${opt.research} بحث` : ''}`);
  persist();
  return true;
}

// ---- الإنجازات --------------------------------------------------------------

const ACH_CHECKS: Record<string, () => boolean> = {
  first: () => S.gamesCount >= 1,
  g10: () => S.gamesCount >= 10,
  g20: () => S.gamesCount >= 20,
  g50: () => S.gamesCount >= 50,
  perfect: () => S.bestScore >= 10,
  mill: () => S.peakMoney >= 1e6,
  mill10: () => S.peakMoney >= 1e7,
  top: () => S.stage >= 5,
  fans1k: () => S.fans >= 1000,
  fans10k: () => S.fans >= 10000,
  streak5: () => S.streak8 >= 5,
  eggs3: () => S.eggsFound.length >= 3,
  ip3: () => S.ips.length >= 3,
  res5: () => S.research.length >= 5,
  emp5: () => S.employees.length >= 5,
  prestige1: () => S.prestige.level >= 1,
  award3: () => S.awards.length >= 3,
  market25: () => S.gamesCount >= 5 && S.rivals.length > 0 && marketShares(S.fans, S.rivals).player >= 0.25,
  goty2: () => S.gotyWins >= 2,
  loan1: () => S.loansRepaid >= 1,
  eng3: () => S.engineVersion >= 3,
  lex8: () => S.topicsShipped.length >= 8,
  lexAll: () => S.topicsShipped.length >= REAL_TOPICS.length,
};

export function checkAchievements(): void {
  for (const a of ACHIEVEMENTS) {
    if (S.achievements.includes(a.id)) continue;
    if (ACH_CHECKS[a.id]?.()) {
      S.achievements.push(a.id);
      ui.pendingAchievement = a.id;
      sfx('achievement');
      setTimeout(() => { if (ui.pendingAchievement === a.id) ui.pendingAchievement = null; }, 3500);
    }
  }
}

export function resetAll(): void {
  clearStorage();
  location.reload();
}

export { fmt };
