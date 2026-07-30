// الحفظ والتحميل والتصدير — مع تعقيم كامل: أي قيمة غير معروفة تُرفض
// قبل أن تلمس الحالة، والاستيراد الفاشل لا يترك اللاعب في حالة نصفية.

import { initialState, type GameState } from './model';
import { GENRES } from '../data/genres';
import { TOPICS } from '../data/topics';
import {
  DIFFICULTY, EMP_ROLES, EMP_LEVELS, PLATFORMS, RESEARCH, RIVAL_DEFS, STAGES,
  ENGINE_VERSIONS, MARKETING_TIERS, QA_MODES, type DifficultyId,
} from '../data/world';
import { ACHIEVEMENTS, EGGS } from '../data/events';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'rtt2.save';

const num = (v: unknown, def: number, min: number, max: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
};
const int = (v: unknown, def: number, min: number, max: number): number =>
  Math.round(num(v, def, min, max));
const str = (v: unknown, def = ''): string => (typeof v === 'string' ? v.slice(0, 120) : def);
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
const oneOf = <T extends string>(v: unknown, valid: readonly T[], def: T): T =>
  valid.includes(v as T) ? (v as T) : def;
const idList = (v: unknown, valid: Set<string>): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && valid.has(x)))] : [];

const GENRE_IDS = new Set(GENRES.map((g) => g.id));
const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));
const PLATFORM_IDS = new Set(PLATFORMS.map((p) => p.id));
const RESEARCH_IDS = new Set(RESEARCH.map((r) => r.id));
const ACH_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));
const EGG_KEYS = new Set(Object.keys(EGGS));
const ROLE_IDS = EMP_ROLES.map((r) => r.id);
const DIFF_IDS = Object.keys(DIFFICULTY) as DifficultyId[];
const MKT_IDS = MARKETING_TIERS.map((m) => m.id);
const QA_IDS = QA_MODES.map((q) => q.id);

/** يبني حالة صالحة من أي كائن مجهول. لا يرمي أبداً — يصلح ما استطاع ويرفض الباقي. */
export function sanitizeSave(raw: unknown): GameState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const difficulty = oneOf(r.difficulty, DIFF_IDS, 'normal');
  const s = initialState(difficulty, DIFFICULTY[difficulty].startMoney);

  s.started = bool(r.started, false);
  s.money = num(r.money, s.money, -1e9, 1e12);
  s.fans = int(r.fans, 0, 0, 1e9);
  s.stage = int(r.stage, 0, 0, STAGES.length - 1);
  s.week = int(r.week, 1, 1, 1e6);
  s.year = int(r.year, 1, 1, 10000);
  s.releasesThisYear = int(r.releasesThisYear, 0, 0, 3);
  s.gamesCount = int(r.gamesCount, 0, 0, 1e6);
  s.expectation = num(r.expectation, 5, 0, 30);
  s.bestScore = num(r.bestScore, 0, 0, 10);
  s.peakMoney = num(r.peakMoney, s.money, 0, 1e12);
  s.streak8 = int(r.streak8, 0, 0, 1e4);
  s.morale = num(r.morale, 75, 0, 100);
  s.researchPoints = int(r.researchPoints, 0, 0, 1e5);
  s.research = idList(r.research, RESEARCH_IDS);
  s.engineVersion = int(r.engineVersion, 0, 0, ENGINE_VERSIONS.length);
  s.loansRepaid = int(r.loansRepaid, 0, 0, 1e4);
  s.gotyWins = int(r.gotyWins, 0, 0, 1e4);
  s.freelanceCount = int(r.freelanceCount, 0, 0, 1e6);
  s.achievements = idList(r.achievements, ACH_IDS);
  s.topicsShipped = idList(r.topicsShipped, TOPIC_IDS).filter((t) => t !== 'general');
  s.eggsFound = idList(r.eggsFound, EGG_KEYS);
  s.eventMod = typeof r.eventMod === 'string' ? str(r.eventMod) : null;
  s.trendTopic = TOPIC_IDS.has(r.trendTopic as string) ? (r.trendTopic as string) : null;

  const taste = (r.marketTaste ?? {}) as Record<string, unknown>;
  s.marketTaste = {
    year: int(taste.year, s.year, 1, 10000),
    design: int(taste.design, 0, -12, 12),
    code: int(taste.code, 0, -12, 12),
    hot: idList(taste.hot, TOPIC_IDS).filter((t) => t !== 'general').slice(0, 3),
  };

  const pr = (r.prestige ?? {}) as Record<string, unknown>;
  s.prestige = { level: int(pr.level, 0, 0, 1000), runs: int(pr.runs, 0, 0, 1000) };

  if (Array.isArray(r.employees)) {
    s.employees = r.employees
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .filter((e) => ROLE_IDS.includes(e.role as string))
      .slice(0, 40)
      .map((e, i) => ({
        id: int(e.id, i + 1, 1, 1e6),
        name: str(e.name, 'موظف'),
        role: e.role as string,
        level: int(e.level, 0, 0, EMP_LEVELS.length - 1),
        xp: int(e.xp, 0, 0, 1e5),
      }));
  }
  s.nextEmpId = int(r.nextEmpId, s.employees.length + 1, 1, 1e7);

  if (Array.isArray(r.ips)) {
    s.ips = r.ips
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .filter((x) => GENRE_IDS.has(x.genre as string) && TOPIC_IDS.has(x.topic as string))
      .slice(0, 200)
      .map((x, i) => ({
        id: int(x.id, i + 1, 1, 1e6),
        name: str(x.name, 'لعبة'),
        genre: x.genre as string,
        topic: x.topic as string,
        bestScore: num(x.bestScore, 7, 1, 10),
        sequels: int(x.sequels, 0, 0, 50),
        dlcs: int(x.dlcs, 0, 0, 50),
        lastDlcRev: num(x.lastDlcRev, 0, 0, 1e12),
      }));
  }
  s.nextIpId = int(r.nextIpId, s.ips.length + 1, 1, 1e7);

  if (Array.isArray(r.games)) {
    s.games = r.games
      .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
      .filter((g) => GENRE_IDS.has(g.genre as string) && TOPIC_IDS.has(g.topic as string))
      .slice(-300)
      .map((g) => ({
        name: str(g.name, 'لعبة'),
        genre: g.genre as string,
        topic: g.topic as string,
        score: num(g.score, 5, 1, 10),
        revenue: num(g.revenue, 0, 0, 1e12),
        week: int(g.week, 1, 1, 1e6),
        year: int(g.year, 1, 1, 10000),
        ...(g.sequelOf != null ? { sequelOf: int(g.sequelOf, 0, 0, 1e6) } : {}),
      }));
  }

  const validRival = new Set(RIVAL_DEFS.map((d) => d.id));
  if (Array.isArray(r.rivals)) {
    s.rivals = r.rivals
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .filter((x) => validRival.has(x.id as string))
      .map((x) => ({
        id: x.id as string,
        quality: num(x.quality, 5, 1, 10),
        fans: int(x.fans, 2000, 0, 1e9),
        games: int(x.games, 0, 0, 1e5),
        lastGame: x.lastGame == null ? null : str(x.lastGame),
        bestThisYear: num(x.bestThisYear, 0, 0, 10),
        bestName: x.bestName == null ? null : str(x.bestName),
      }));
  }

  const c = r.contract as Record<string, unknown> | null | undefined;
  if (c && typeof c === 'object' && GENRE_IDS.has(c.genre as string)) {
    s.contract = {
      publisher: str(c.publisher, 'ناشر'),
      pubIcon: str(c.pubIcon, '🏢'),
      genre: c.genre as string,
      topic: TOPIC_IDS.has(c.topic as string) ? (c.topic as string) : null,
      pay: num(c.pay, 0, 0, 1e10),
      bonus: num(c.bonus, 0, 0, 1e10),
      penalty: num(c.penalty, 0, 0, 1e10),
      deadline: int(c.deadline, 2, 0, 10),
    };
  }

  const l = r.loan as Record<string, unknown> | null | undefined;
  if (l && typeof l === 'object' && Number(l.remaining) > 0) {
    s.loan = {
      principal: num(l.principal, 0, 0, 1e10),
      installment: num(l.installment, 0, 0, 1e10),
      remaining: int(l.remaining, 0, 0, 8),
    };
  }

  if (Array.isArray(r.awards)) {
    s.awards = r.awards
      .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
      .slice(0, 200)
      .map((a) => ({
        year: int(a.year, 1, 1, 10000),
        name: str(a.name, 'لعبة'),
        score: num(a.score, 8.5, 0, 10),
      }));
  }

  const p = r.project as Record<string, unknown> | null | undefined;
  if (p && typeof p === 'object' && GENRE_IDS.has(p.genre as string)) {
    const sl = (p.sliders ?? {}) as Record<string, unknown>;
    const maxPts = STAGES[s.stage].maxPts;
    s.project = {
      name: str(p.name, 'لعبة'),
      genre: p.genre as string,
      topic: TOPIC_IDS.has(p.topic as string) ? (p.topic as string) : 'general',
      topicWord: p.topicWord == null ? null : str(p.topicWord),
      topicLocked: bool(p.topicLocked, false),
      platforms: idList(p.platforms, PLATFORM_IDS),
      sliders: {
        design: int(sl.design, 1, 0, maxPts),
        code: int(sl.code, 1, 0, maxPts),
        sound: int(sl.sound, 1, 0, maxPts),
      },
      marketing: oneOf(p.marketing, MKT_IDS, 'none'),
      qa: oneOf(p.qa, QA_IDS, 'normal'),
      cost: num(p.cost, 0, 0, 1e10),
      progress: num(p.progress, 0, 0, 1),
      midDecision: oneOf(p.midDecision, ['pending', 'shown', 'done'] as const, 'pending'),
      scoreBonus: num(p.scoreBonus, 0, -3, 3),
      parentIP: p.parentIP == null ? null : int(p.parentIP, 0, 0, 1e6),
      onContract: bool(p.onContract, false),
    };
    if (!s.project.platforms.length) s.project.platforms = ['pc'];
  }

  // lastReview عرضية — لا تنجو من الحفظ عمداً.
  return s;
}

export function serialize(s: GameState): string {
  const { lastReview, ...rest } = s;
  return JSON.stringify({ v: SAVE_VERSION, ...rest });
}

export function saveToStorage(s: GameState): void {
  if (!s.started) return; // لا نكتب فوق حفظ حقيقي بحالة افتراضية
  try {
    localStorage.setItem(SAVE_KEY, serialize(s));
  } catch { /* التخزين ممتلئ أو محظور — نتجاهل بصمت */ }
}

export function loadFromStorage(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const s = sanitizeSave(parsed);
    return s.started ? s : null;
  } catch {
    return null;
  }
}

export function clearStorage(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

// تصدير/استيراد يدوي بـ Base64 (يدعم يونيكود).
export function exportSave(s: GameState): string {
  const json = serialize(s);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}

export function importSave(b64: string): GameState | null {
  try {
    const bytes = Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object') return null;
    const s = sanitizeSave(parsed);
    return s.started ? s : null;
  } catch {
    return null;
  }
}
