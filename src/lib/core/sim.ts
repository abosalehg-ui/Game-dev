// محرك المحاكاة النقي: كل معادلات التقييم والمبيعات والسوق.
// وحدة بلا حالة وبلا Svelte — تأخذ مدخلاتها صراحة وتعيد نتائجها،
// فتبقى قابلة للاختبار وحدها.

import { BALANCE } from './balance';
import { GENRES, SYN, type Genre } from '../data/genres';
import { REAL_TOPICS } from '../data/topics';
import {
  PLATFORMS, PLATFORM_SATURATION, STAGES, DIFFICULTY, EMP_ROLES, EMP_LEVELS,
  ENGINE_VERSIONS, RIVAL_DEFS, type DifficultyId,
} from '../data/world';
import type { Employee, MarketTaste, Rival } from './model';

export const genreById = (id: string): Genre => GENRES.find((g) => g.id === id) ?? GENRES[0];

// ---- ذوق السوق السنوي ----------------------------------------------------
// التوزيع المثالي ثابت في GENRES، فلولا الانحراف السنوي لصار الجواب الأمثل
// محفوظاً بعد أول جولات. كل سنة يتحرك الهدف وتصبح 3 مواضيع «رائجة».

export function rollMarketTaste(year: number): MarketTaste {
  const pool = REAL_TOPICS.map((t) => t.id);
  const hot: string[] = [];
  for (let i = 0; i < BALANCE.taste.hotCount && pool.length; i++) {
    hot.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
  }
  const r = () => Math.round((Math.random() * 2 - 1) * BALANCE.taste.shift);
  return { year: Math.max(1, year | 0), design: r(), code: r(), hot };
}

/** التوزيع المثالي للنوع بعد انحراف السنة، منسوباً إلى 100 وبأرضية 5 نقاط لكل محور */
export function idealFor(genre: Genre, taste: MarketTaste): [number, number, number] {
  let a = [
    genre.ideal[0] + (taste.design || 0),
    genre.ideal[1] + (taste.code || 0),
    genre.ideal[2] - (taste.design || 0) - (taste.code || 0),
  ];
  a = a.map((v) => Math.max(5, v));
  const sum = a[0] + a[1] + a[2];
  return [a[0] / sum * 100, a[1] / sum * 100, a[2] / sum * 100];
}

export function synergyFor(genreId: string, topicId: string, taste: MarketTaste): number {
  const base = SYN[genreId]?.[topicId] ?? 0;
  const hot = taste.hot.includes(topicId) ? BALANCE.taste.hotBonus : 0;
  return base + hot;
}

// ---- الموظفون --------------------------------------------------------------

export interface SkillBonuses {
  design: number;
  code: number;
  sound: number;
  marketing: number;
}

/** مجموع قوة الفريق لكل محور، مرجحاً بمستوى الموظف ومعنويات الاستوديو */
export function skillBonuses(employees: Employee[], morale: number): SkillBonuses {
  const out: SkillBonuses = { design: 0, code: 0, sound: 0, marketing: 0 };
  const moraleMult = 0.5 + Math.max(0, Math.min(100, morale)) / 100;
  for (const e of employees) {
    const role = EMP_ROLES.find((r) => r.id === e.role);
    if (!role) continue;
    out[role.skill] += (EMP_LEVELS[e.level]?.mult ?? 1) * moraleMult;
  }
  return out;
}

export function salaryOf(e: Employee): number {
  const role = EMP_ROLES.find((r) => r.id === e.role);
  return Math.round((role?.baseSalary ?? 1500) * (EMP_LEVELS[e.level]?.salMult ?? 1));
}

// ---- تكلفة التطوير ---------------------------------------------------------

export interface CostInput {
  stage: number;
  sliders: { design: number; code: number; sound: number };
  platforms: string[];
  difficulty: DifficultyId;
  engineVersion: number;
  research: string[];
  parentIP: boolean;
  eventStrike: boolean;
}

export function devCost(inp: CostInput): number {
  const stg = STAGES[inp.stage];
  let cost = stg.devCost;
  const platMult = inp.platforms.reduce(
    (a, id) => a + (PLATFORMS.find((p) => p.id === id)?.costMult ?? 1), 0,
  );
  cost *= Math.max(0.4, platMult);
  // النقاط فوق 70% من السقف ترفع التكلفة 5% لكل نقطة — النطاق قرار حقيقي.
  const pts = inp.sliders.design + inp.sliders.code + inp.sliders.sound;
  const softCap = stg.maxPts * BALANCE.scope.softCapRatio;
  if (pts > softCap) cost *= 1 + (pts - softCap) * BALANCE.scope.overCostPerPoint;
  const eng = ENGINE_VERSIONS[inp.engineVersion - 1];
  if (inp.research.includes('engine') && eng) cost *= eng.costDisc;
  if (inp.research.includes('aiart')) cost *= 0.85;
  if (inp.parentIP) cost *= 0.5;
  cost *= DIFFICULTY[inp.difficulty].costMult;
  if (inp.eventStrike) cost *= 2;
  return Math.round(cost);
}

// ---- التقييم ---------------------------------------------------------------

/** جودة توزيع النقاط مقابل المثالي: 1 مطابق، 0 بعيد كلياً */
export function axisBalance(
  sliders: { design: number; code: number; sound: number },
  genre: Genre,
  taste: MarketTaste,
  bonus: SkillBonuses,
  research: string[],
): number {
  const boost = (id: string, v: number) => (research.includes(id) ? v * 1.3 : v);
  const eff = [
    boost('design', sliders.design * (1 + bonus.design * 0.06)),
    boost('code', sliders.code * (1 + bonus.code * 0.06)),
    boost('sound', sliders.sound * (1 + bonus.sound * 0.06)),
  ];
  const total = eff[0] + eff[1] + eff[2];
  if (!total) return 0;
  const pct = eff.map((v) => (v / total) * 100);
  const ideal = idealFor(genre, taste);
  const dev = Math.abs(pct[0] - ideal[0]) + Math.abs(pct[1] - ideal[1]) + Math.abs(pct[2] - ideal[2]);
  return Math.max(0, 1 - dev / BALANCE.score.balanceTolerance);
}

export interface ScoreInput {
  genreId: string;
  topicId: string;
  sliders: { design: number; code: number; sound: number };
  stage: number;
  taste: MarketTaste;
  employees: Employee[];
  morale: number;
  research: string[];
  engineVersion: number;
  qa: string;
  eventMod: string | null;
  midBonus: number;
  expectation: number;
  parentIP: { bestScore: number; sequels: number } | null;
}

export interface ScoreResult {
  raw: number;
  scores: number[];
  avg: number;
  bugCount: number;
  syn: number;
  bal: number;
  scope: number;
  newExpectation: number;
  bonus: SkillBonuses;
  clearedEventMod: boolean;
}

export function computeScore(inp: ScoreInput): ScoreResult {
  const C = BALANCE.score;
  const genre = genreById(inp.genreId);
  const bonus = skillBonuses(inp.employees, inp.morale);
  const syn = synergyFor(inp.genreId, inp.topicId, inp.taste);
  const bal = axisBalance(inp.sliders, genre, inp.taste, bonus, inp.research);
  const pts = inp.sliders.design + inp.sliders.code + inp.sliders.sound;
  const scope = pts / STAGES[inp.stage].maxPts;

  let raw = C.base + bal * C.balanceWeight + syn * C.synergyWeight + scope * C.scopeWeight;
  let clearedEventMod = false;
  if (inp.eventMod === 'festival') { raw += C.festivalBonus; clearedEventMod = true; }
  if (inp.eventMod === 'quit') { raw -= C.quitPenalty; clearedEventMod = true; }
  if (inp.research.includes('hd')) raw += C.hdBonus;
  if (inp.research.includes('aiart')) raw += 0.3;
  if (inp.research.includes('esports') && (inp.genreId === 'action' || inp.genreId === 'racing')) raw += C.esportsBonus;
  const eng = ENGINE_VERSIONS[inp.engineVersion - 1];
  if (inp.research.includes('engine') && eng) raw += eng.score;
  raw += Math.max(-C.moraleSwing, Math.min(C.moraleSwing, (inp.morale - 50) / 100));
  raw += inp.midBonus;

  let bugCount = 0;
  if (inp.qa === 'quick') { bugCount = Math.floor(2 + Math.random() * 4); raw -= bugCount * C.quickBugPenalty; }
  else if (inp.qa === 'normal') { bugCount = Math.floor(Math.random() * 2); raw -= bugCount * C.normalBugPenalty; }
  else if (inp.qa === 'full') raw += C.fullQaBonus;

  if (inp.parentIP) {
    raw += Math.min(C.sequelCap, inp.parentIP.bestScore * C.sequelFromParent);
    if (inp.parentIP.sequels >= 3) raw -= (inp.parentIP.sequels - 2) * C.sequelFatigue;
  }

  // شريط مطاطي: الدرجة نسبية لسجل الاستوديو نفسه، فلا وصفة تتكرر للأبد.
  const d = raw - inp.expectation;
  let fin: number;
  if (d > 1) fin = 9 + Math.random() * 1.2;
  else if (d > 0) fin = 7.5 + Math.random() * 2;
  else if (d > -1) fin = 6 + Math.random() * 2;
  else fin = 3 + Math.random() * 3;
  fin += (Math.random() - 0.5) * C.finalJitter;
  fin = Math.max(1, Math.min(10, Math.round(fin * 10) / 10));
  const newExpectation = raw > inp.expectation
    ? inp.expectation + (raw - inp.expectation) * C.expectationCatchUp
    : inp.expectation;

  const scores: number[] = [];
  for (let i = 0; i < 4; i++) {
    scores.push(Math.max(1, Math.min(10, Math.round((fin + (Math.random() - 0.5) * C.reviewerSpread) * 10) / 10)));
  }
  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / 4) * 10) / 10;
  return { raw, scores, avg, bugCount, syn, bal, scope, newExpectation, bonus, clearedEventMod };
}

// ---- الجمهور والمنصات ------------------------------------------------------

/** وصول الجمهور حسب المنصات المختارة وملاءمتها للنوع، مع تشبع لكل منصة إضافية */
export function platformAudience(genreId: string, platformIds: string[]): number {
  let sum = 0;
  platformIds.forEach((id, i) => {
    const p = PLATFORMS.find((x) => x.id === id);
    if (!p) return;
    const fit = 1 + (p.fit[genreId] ?? 0);
    sum += p.audMult * fit * (PLATFORM_SATURATION[i] ?? 0.6);
  });
  return Math.max(0.3, sum / 1.6);
}

// ---- الحصة السوقية ---------------------------------------------------------

export function marketShares(fans: number, rivals: Rival[]): { player: number; rivals: number[] } {
  const pw = Math.max(100, fans * 1.2 + 100);
  const rw = rivals.map((r) => Math.max(100, r.fans));
  const total = pw + rw.reduce((a, b) => a + b, 0);
  return { player: pw / total, rivals: rw.map((w) => w / total) };
}

// ---- المبيعات --------------------------------------------------------------

export interface SalesInput {
  avg: number;
  fans: number;
  stage: number;
  genreId: string;
  topicId: string;
  platforms: string[];
  marketingBonus: number;
  hype: number;
  marketerSkill: number;
  eggBonus: number;
  eventMod: string | null;
  trendTopic: string | null;
  isSequel: boolean;
  difficulty: DifficultyId;
  prestigeLevel: number;
  playerShare: number;
  research: string[];
}

export interface SalesResult {
  revenue: number;
  fansDelta: number;
  clearedEventMod: boolean;
}

export function computeSales(inp: SalesInput): SalesResult {
  const C = BALANCE.sales;
  const F = BALANCE.fans;
  let sales = Math.pow(inp.avg, C.scoreExponent) * C.unit * (1 + inp.fans * C.fanWeight) * inp.eggBonus;

  let clearedEventMod = false;
  if (inp.eventMod === 'trend' && inp.topicId === inp.trendTopic) { sales *= C.trend; clearedEventMod = true; }
  else if (inp.eventMod === 'recession') { sales *= C.recession; clearedEventMod = true; }
  else if (inp.eventMod === 'publisher') { sales *= C.publisher; clearedEventMod = true; }
  else if (inp.eventMod === 'piracy') { sales *= C.piracy; clearedEventMod = true; }

  if (inp.marketingBonus) sales *= 1 + inp.marketingBonus * (1 + inp.marketerSkill * C.marketerCampaign);
  if (inp.marketerSkill > 0) sales *= 1 + inp.marketerSkill * C.marketerWordOfMouth;

  sales *= platformAudience(inp.genreId, inp.platforms);
  if (inp.research.includes('crossplat') && inp.platforms.length > 1) {
    sales *= 1 + C.crossPlatform * (inp.platforms.length - 1);
  }

  if (inp.isSequel) sales *= C.sequel;
  sales *= DIFFICULTY[inp.difficulty].rewardMult;
  sales *= 1 + inp.prestigeLevel * C.prestigePerLevel;
  sales *= C.shareFloor + inp.playerShare * C.shareRange;

  const revenue = Math.floor(sales * C.stageRevenue(inp.stage));

  const pick = (r: [number, number]) => r[0] + ((Math.random() * r[1]) | 0);
  let fd: number;
  if (inp.avg >= 9) fd = pick(F.great);
  else if (inp.avg >= 7) fd = pick(F.good);
  else if (inp.avg >= 5) fd = pick(F.ok);
  else fd = -(50 + ((Math.random() * 100) | 0));
  if (inp.hype) fd += Math.floor(inp.hype * F.hypePerPoint * (1 + inp.marketerSkill * C.marketerCampaign));
  if (inp.research.includes('community') && fd > 0) fd = Math.floor(fd * F.communityMult);
  if (inp.research.includes('modding') && (inp.genreId === 'rpg' || inp.genreId === 'sim') && fd > 0) {
    fd = Math.floor(fd * F.moddingMult);
  }

  return { revenue, fansDelta: fd, clearedEventMod };
}

// ---- المنافسون -------------------------------------------------------------

export function initRivals(): Rival[] {
  return RIVAL_DEFS.map((r) => ({
    id: r.id,
    quality: 4.5 + Math.random() * 1.5,
    fans: 1500 + Math.floor(Math.random() * 4500),
    games: 0,
    lastGame: null,
    bestThisYear: 0,
    bestName: null,
  }));
}

const RIVAL_GAME_NAMES = ['أسطورة الشمال', 'حراس المدينة', 'طريق النصر', 'ظل الكثبان', 'بوابة النجوم', 'صدى الوادي', 'ليالي الميناء', 'قلعة الرمال', 'همس الغابة', 'نداء العاصفة'];

/** بعد كل إصدار للاعب، كل منافس قد يصدر لعبة ويكسب معجبين وتتحسن جودته ببطء */
export function stepRivals(rivals: Rival[], playerStage: number): void {
  for (const r of rivals) {
    if (Math.random() < 0.55) {
      const score = Math.max(1, Math.min(10, r.quality + (Math.random() * 2 - 1) * 1.6));
      r.games++;
      r.lastGame = RIVAL_GAME_NAMES[(Math.random() * RIVAL_GAME_NAMES.length) | 0];
      r.fans += Math.floor(Math.max(-100, (score - 5) * 120 + Math.random() * 100));
      r.fans = Math.max(200, r.fans);
      if (score > r.bestThisYear) { r.bestThisYear = score; r.bestName = r.lastGame; }
    }
    r.quality = Math.min(9, r.quality + 0.02 + playerStage * 0.008);
  }
}
