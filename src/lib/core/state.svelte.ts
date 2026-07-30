// الحالة الحية — كائن $state واحد عميق التفاعلية تشترك فيه كل الواجهة.

import { initialState, type GameState, type Settings } from './model';

/** الحالة الحية — كائن واحد تستبدل خصائصه ولا يُستبدل هو */
export const S = $state<GameState>(initialState());

export const settings = $state<Settings>({ sound: true, theme: 'dark', haptics: true });

/** واجهة عرض عابرة (ليست جزءاً من الحفظ) */
export const ui = $state({
  tab: 'studio' as 'studio' | 'dev' | 'team' | 'market' | 'more',
  sheet: null as string | null,
  toast: null as { icon: string; text: string } | null,
  pendingEvent: null as { icon: string; title: string; desc: string; good: boolean } | null,
  pendingAchievement: null as string | null,
  showReview: false,
  showMidDecision: false,
  showConvention: null as string | null,
  showGameOver: false,
  showGoty: null as { won: boolean; name: string; score: number; by?: string } | null,
  /** سلسلة اختارها اللاعب لبدء جزء تالٍ منها */
  pendingSequel: null as number | null,
});

export function replaceState(next: GameState) {
  // إبقاء نفس المرجع حفاظاً على التفاعلية في كل المكونات
  Object.assign(S, next);
}
