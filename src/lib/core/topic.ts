// اشتقاق الموضوع من اسم اللعبة — منطق لعبة أساسي لا مجرد مساعد واجهة.
// «ملحمة الصحراء» = لعبة صحراء، وفي تركيب الإضافة يفوز الاسم الثاني
// لأنه الموضوع الحقيقي.

import { TOPIC_WORDS, REAL_TOPICS, NAME_TAILS } from '../data/topics';
import { EGGS } from '../data/events';

/**
 * توحيد الكتابة العربية قبل المطابقة: إزالة التشكيل والتطويل،
 * توحيد صور الهمزة والألف، ة→ه، ى→ي.
 */
export function normAr(s: string): string {
  return String(s || '')
    .replace(/[ً-ْـٰ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^ء-يa-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

// أداة التعريف وحروف الجر/العطف الملتصقة. الأطول أولاً، ويُنزع واحد فقط.
const AR_PREFIXES = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال', 'و', 'ب', 'ل', 'ف', 'ك'];

// أقل طول يسمح لكلمة القاموس بالمطابقة كبادئة، حتى لا تبتلع كلمة قصيرة
// مثل «حرب» كلمات لا علاقة لها بها.
const MIN_PREFIX_MATCH = 4;

const TOPIC_WORDS_N: Record<string, { n: string; raw: string }[]> = Object.fromEntries(
  Object.entries(TOPIC_WORDS).map(([id, ws]) => [id, ws.map((w) => ({ n: normAr(w), raw: w }))]),
);

/** كل كلمة تُجرَّب بذاتها وبصيغتها بعد نزع البادئة: بحر تبقى بحر، وبالحرب تصير حرب أيضاً. */
function arTokens(name: string): string[][] {
  return normAr(name)
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      for (const p of AR_PREFIXES) {
        if (w.length > p.length + 2 && w.startsWith(p)) return [w, w.slice(p.length)];
      }
      return [w];
    });
}

export interface TopicMatch {
  id: string;
  /** كلمة القاموس التي حسمت الموضوع — لعرضها للاعب */
  word: string | null;
  /** مواضيع أخرى لمسها الاسم، تُعرض كبدائل بنقرة واحدة */
  alts: string[];
}

export function detectTopic(name: string): TopicMatch {
  const raw = String(name || '').trim();
  if (!raw) return { id: 'general', word: null, alts: [] };

  // اسم بيضة الفصح تكريم مقصود فيتقدم على القاموس.
  const eggKey = Object.keys(EGGS).find((k) => raw.includes(k));
  if (eggKey && EGGS[eggKey].topic) return { id: EGGS[eggKey].topic, word: eggKey, alts: [] };

  const best: Record<string, { score: number; pos: number; word: string }> = {};
  arTokens(raw).forEach((forms, pos) => {
    for (const id in TOPIC_WORDS_N) {
      for (const w of TOPIC_WORDS_N[id]) {
        const sc = forms.includes(w.n)
          ? 3
          : w.n.length >= MIN_PREFIX_MATCH && forms.some((f) => f.length > w.n.length && f.startsWith(w.n))
            ? 2
            : 0;
        // عند التعادل تفوز الكلمة المتأخرة: في الإضافة العربية الاسم الثاني
        // هو الموضوع («حصار المجرة» لعبة فضاء لا حرب).
        if (sc && (!best[id] || sc >= best[id].score)) best[id] = { score: sc, pos, word: w.raw };
      }
    }
  });

  const ranked = Object.entries(best).sort((a, b) => b[1].score - a[1].score || b[1].pos - a[1].pos);
  if (!ranked.length) return { id: 'general', word: null, alts: [] };
  return { id: ranked[0][0], word: ranked[0][1].word, alts: ranked.slice(1).map((r) => r[0]) };
}

// الذيول المحايدة فقط: NAME_TAILS قد تحوي كلمة دالة مستقبلاً، والاسم المولَّد
// لموضوع ما يجب ألا ينقلب لموضوع آخر بسبب ذيله.
const NEUTRAL_TAILS = NAME_TAILS.filter((t) => detectTopic(t).id === 'general');

export function randomGameNameFor(topicId: string): string {
  const words = TOPIC_WORDS[topicId] ?? TOPIC_WORDS[REAL_TOPICS[0].id];
  const w = words[(Math.random() * words.length) | 0];
  const t = NEUTRAL_TAILS[(Math.random() * NEUTRAL_TAILS.length) | 0];
  return `${w} ${t}`;
}

export function randomGameName(): string {
  return randomGameNameFor(REAL_TOPICS[(Math.random() * REAL_TOPICS.length) | 0].id);
}
