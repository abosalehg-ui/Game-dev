import { describe, it, expect } from 'vitest';
import {
  computeScore, computeSales, devCost, idealFor, marketShares, platformAudience,
  rollMarketTaste, synergyFor, genreById, skillBonuses,
} from './sim';
import { GENRES } from '../data/genres';
import { REAL_TOPICS } from '../data/topics';
import { STAGES } from '../data/world';
import type { MarketTaste } from './model';

const NEUTRAL: MarketTaste = { year: 1, design: 0, code: 0, hot: [] };

describe('idealFor', () => {
  it('يعيد نسباً مجموعها 100 لكل نوع وكل انحراف', () => {
    for (const g of GENRES) {
      for (let i = 0; i < 10; i++) {
        const t = rollMarketTaste(1);
        const a = idealFor(g, t);
        expect(a[0] + a[1] + a[2]).toBeCloseTo(100, 5);
        a.forEach((v) => expect(v).toBeGreaterThan(0));
      }
    }
  });
});

describe('rollMarketTaste', () => {
  it('المواضيع الرائجة حقيقية وغير مكررة وليست «عام»', () => {
    for (let i = 0; i < 20; i++) {
      const t = rollMarketTaste(i + 1);
      expect(t.hot.length).toBe(3);
      expect(new Set(t.hot).size).toBe(3);
      expect(t.hot.includes('general')).toBe(false);
    }
  });
});

describe('synergyFor', () => {
  it('الموضوع الرائج يكسب +1', () => {
    const base = synergyFor('rpg', 'fantasy', NEUTRAL);
    const hot = synergyFor('rpg', 'fantasy', { ...NEUTRAL, hot: ['fantasy'] });
    expect(hot).toBe(base + 1);
  });
  it('الموضوع «عام» صفر دائماً بلا مكافأة ولا عقوبة', () => {
    for (const g of GENRES) expect(synergyFor(g.id, 'general', NEUTRAL)).toBe(0);
  });
});

describe('devCost', () => {
  const base = {
    stage: 0,
    sliders: { design: 3, code: 3, sound: 1 },
    platforms: ['pc'],
    difficulty: 'normal' as const,
    engineVersion: 0,
    research: [] as string[],
    parentIP: false,
    eventStrike: false,
  };
  it('النطاق فوق 70% يرفع التكلفة', () => {
    const small = devCost(base);
    const big = devCost({ ...base, sliders: { design: 4, code: 4, sound: 2 } });
    expect(big).toBeGreaterThan(small);
  });
  it('الجزء التالي بنصف التكلفة', () => {
    expect(devCost({ ...base, parentIP: true })).toBeLessThanOrEqual(Math.ceil(devCost(base) / 2));
  });
  it('المحرك يخصم', () => {
    expect(devCost({ ...base, engineVersion: 1, research: ['engine'] })).toBeLessThan(devCost(base));
  });
});

describe('computeScore', () => {
  const inp = {
    genreId: 'rpg',
    topicId: 'fantasy',
    sliders: { design: 4, code: 4, sound: 2 },
    stage: 0,
    taste: NEUTRAL,
    employees: [],
    morale: 75,
    research: [] as string[],
    engineVersion: 0,
    qa: 'normal',
    eventMod: null,
    midBonus: 0,
    expectation: 5,
    parentIP: null,
  };
  it('الدرجات ضمن 1..10 والمتوسط متسق', () => {
    for (let i = 0; i < 50; i++) {
      const r = computeScore(inp);
      expect(r.avg).toBeGreaterThanOrEqual(1);
      expect(r.avg).toBeLessThanOrEqual(10);
      expect(r.scores.length).toBe(4);
      const want = Math.round((r.scores.reduce((a, b) => a + b, 0) / 4) * 10) / 10;
      expect(r.avg).toBe(want);
    }
  });
  it('خط التوقعات لا ينخفض أبداً ويلاحق الأداء العالي', () => {
    const r = computeScore({ ...inp, expectation: 2 });
    expect(r.newExpectation).toBeGreaterThanOrEqual(2);
  });
  it('QA الشامل لا يترك بَقّات', () => {
    for (let i = 0; i < 20; i++) expect(computeScore({ ...inp, qa: 'full' }).bugCount).toBe(0);
  });
});

describe('computeSales', () => {
  const inp = {
    avg: 7,
    fans: 1000,
    stage: 1,
    genreId: 'action',
    topicId: 'war',
    platforms: ['pc'],
    marketingBonus: 0,
    hype: 0,
    marketerSkill: 0,
    eggBonus: 1,
    eventMod: null,
    trendTopic: null,
    isSequel: false,
    difficulty: 'normal' as const,
    prestigeLevel: 0,
    playerShare: 0.2,
    research: [] as string[],
  };
  it('التقييم الأعلى يبيع أكثر', () => {
    const low = computeSales({ ...inp, avg: 4 });
    const high = computeSales({ ...inp, avg: 9 });
    expect(high.revenue).toBeGreaterThan(low.revenue);
  });
  it('الترند يضاعف عند موافقة الموضوع فقط', () => {
    const plain = computeSales(inp).revenue;
    const match = computeSales({ ...inp, eventMod: 'trend', trendTopic: 'war' }).revenue;
    const miss = computeSales({ ...inp, eventMod: 'trend', trendTopic: 'space' });
    expect(match).toBeGreaterThan(plain * 1.5);
    expect(miss.clearedEventMod).toBe(false);
  });
  it('تقييم منخفض يخسر معجبين', () => {
    for (let i = 0; i < 10; i++) expect(computeSales({ ...inp, avg: 3 }).fansDelta).toBeLessThan(0);
  });
});

describe('marketShares', () => {
  it('الحصص مجموعها 1', () => {
    const rivals = [
      { id: 'falcon', quality: 5, fans: 3000, games: 0, lastGame: null, bestThisYear: 0, bestName: null },
      { id: 'palm', quality: 5, fans: 5000, games: 0, lastGame: null, bestThisYear: 0, bestName: null },
    ];
    const s = marketShares(2000, rivals);
    expect(s.player + s.rivals.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
});

describe('platformAudience', () => {
  it('كل منصة إضافية تزيد الوصول لكن بتناقص', () => {
    const one = platformAudience('action', ['console']);
    const two = platformAudience('action', ['console', 'pc']);
    expect(two).toBeGreaterThan(one);
  });
});

describe('economy sanity', () => {
  it('لعبة جيدة في كل مرحلة تغطي تكلفتها على الأقل', () => {
    for (let st = 0; st < STAGES.length; st++) {
      const cost = devCost({
        stage: st,
        sliders: { design: 3, code: 4, sound: 2 },
        platforms: ['pc'],
        difficulty: 'normal',
        engineVersion: 0,
        research: [],
        parentIP: false,
        eventStrike: false,
      });
      const sale = computeSales({
        avg: 7.5,
        fans: 500 * Math.pow(4, st),
        stage: st,
        genreId: 'action',
        topicId: 'war',
        platforms: ['pc'],
        marketingBonus: 0,
        hype: 0,
        marketerSkill: 0,
        eggBonus: 1,
        eventMod: null,
        trendTopic: null,
        isSequel: false,
        difficulty: 'normal',
        prestigeLevel: 0,
        playerShare: 0.2,
        research: [],
      });
      expect(sale.revenue, `stage ${st}: cost ${cost} rev ${sale.revenue}`).toBeGreaterThan(cost);
    }
  });
});
