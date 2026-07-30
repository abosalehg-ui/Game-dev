// نموذج حالة اللعبة: الأنواع + الحالة الابتدائية. وحدة نقية بلا Svelte
// حتى تبقى قابلة للاختبار والاستيراد من أي مكان.

import type { DifficultyId } from '../data/world';

export interface Employee {
  id: number;
  name: string;
  role: string; // EmpRole.id
  level: number; // فهرس EMP_LEVELS
  xp: number;
}

export interface IP {
  id: number;
  name: string;
  genre: string;
  topic: string;
  bestScore: number;
  sequels: number;
  dlcs: number;
  lastDlcRev: number;
}

export interface ReleasedGame {
  name: string;
  genre: string;
  topic: string;
  score: number;
  revenue: number;
  week: number;
  year: number;
  sequelOf?: number;
}

export interface Rival {
  id: string;
  quality: number;
  fans: number;
  games: number;
  lastGame: string | null;
  bestThisYear: number;
  bestName: string | null;
}

export interface Contract {
  publisher: string;
  pubIcon: string;
  genre: string;
  topic: string | null;
  pay: number;
  bonus: number;
  penalty: number;
  deadline: number; // إصدارات متبقية
}

export interface Loan {
  principal: number;
  installment: number;
  remaining: number; // أقساط متبقية
}

export interface MarketTaste {
  year: number;
  design: number;
  code: number;
  hot: string[];
}

/** مشروع التطوير النشط */
export interface Project {
  name: string;
  genre: string;
  topic: string;
  topicWord: string | null;
  topicLocked: boolean;
  platforms: string[];
  sliders: { design: number; code: number; sound: number };
  marketing: string; // MARKETING_TIERS id
  qa: string; // QA_MODES id
  cost: number;
  /** تقدم 0..1 */
  progress: number;
  /** هل ظهر قرار منتصف الإنتاج؟ */
  midDecision: 'pending' | 'shown' | 'done';
  /** بونص/خصم قرار منتصف الإنتاج على التقييم */
  scoreBonus: number;
  parentIP: number | null;
  /** عقد ناشر مربوط بهذا المشروع */
  onContract: boolean;
}

export interface ReviewResult {
  name: string;
  genre: string;
  topic: string;
  scores: number[];
  avg: number;
  revenue: number;
  fansDelta: number;
  bugCount: number;
  eggKey: string | null;
  eggDesc: string | null;
  eggBonus: number;
  contractResult: { ok: boolean; pay: number; label: string } | null;
  notes: string[]; // شرح المراجعين: لماذا هذه الدرجة
  isSequel: boolean;
}

export interface GameState {
  started: boolean;
  difficulty: DifficultyId;
  money: number;
  fans: number;
  stage: number;
  week: number;
  year: number;
  releasesThisYear: number;
  gamesCount: number;
  /** خط التوقعات (rubber band) */
  expectation: number;
  bestScore: number;
  peakMoney: number;
  streak8: number;
  morale: number;
  researchPoints: number;
  research: string[];
  engineVersion: number;
  employees: Employee[];
  nextEmpId: number;
  ips: IP[];
  nextIpId: number;
  games: ReleasedGame[];
  rivals: Rival[];
  contract: Contract | null;
  loan: Loan | null;
  loansRepaid: number;
  marketTaste: MarketTaste;
  prestige: { level: number; runs: number };
  achievements: string[];
  eggsFound: string[];
  topicsShipped: string[];
  awards: { year: number; name: string; score: number }[];
  gotyWins: number;
  /** معدّل حدث معلّق يطبَّق على اللعبة القادمة */
  eventMod: string | null;
  trendTopic: string | null;
  freelanceCount: number;
  project: Project | null;
  /** آخر نتيجة إطلاق — تعرضها شاشة التقييم */
  lastReview: ReviewResult | null;
}

export interface Settings {
  sound: boolean;
  theme: 'dark' | 'light';
  haptics: boolean;
}

export function initialState(difficulty: DifficultyId = 'normal', startMoney = 10000): GameState {
  return {
    started: false,
    difficulty,
    money: startMoney,
    fans: 0,
    stage: 0,
    week: 1,
    year: 1,
    releasesThisYear: 0,
    gamesCount: 0,
    expectation: 5,
    bestScore: 0,
    peakMoney: startMoney,
    streak8: 0,
    morale: 75,
    researchPoints: 0,
    research: [],
    engineVersion: 0,
    employees: [],
    nextEmpId: 1,
    ips: [],
    nextIpId: 1,
    games: [],
    rivals: [],
    contract: null,
    loan: null,
    loansRepaid: 0,
    marketTaste: { year: 1, design: 0, code: 0, hot: [] },
    prestige: { level: 0, runs: 0 },
    achievements: [],
    eggsFound: [],
    topicsShipped: [],
    awards: [],
    gotyWins: 0,
    eventMod: null,
    trendTopic: null,
    freelanceCount: 0,
    project: null,
    lastReview: null,
  };
}

