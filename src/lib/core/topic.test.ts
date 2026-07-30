import { describe, it, expect } from 'vitest';
import { detectTopic, normAr, randomGameNameFor } from './topic';
import { TOPIC_WORDS, REAL_TOPICS } from '../data/topics';

describe('normAr', () => {
  it('يوحد صور الهمزة والتاء المربوطة والتشكيل', () => {
    expect(normAr('صَحْرَاء')).toBe(normAr('صحراء'));
    expect(normAr('أسطورة')).toBe(normAr('اسطوره'));
    expect(normAr('مَلْحَمَة')).toBe('ملحمه');
  });
});

describe('detectTopic', () => {
  const cases: [string, string][] = [
    ['ملحمة الصحراء', 'desert'], // الإضافة: الاسم الثاني يفوز
    ['حصار المجرة', 'space'],
    ['قرصان الصحراء', 'desert'],
    ['حرب النجوم', 'space'],
    ['فرسان المملكة', 'medieval'],
    ['غوص اللؤلؤ', 'heritage'],
    ['هجن الشمال', 'bedouin'],
    ['ليوة الفجر', 'folklore'],
    ['ليالي الدرعية', 'heritage'],
    ['بالحرب نحيا', 'war'], // نزع البادئة
    ['رحلة الأمل', 'general'], // لا كلمة دالة
    ['', 'general'],
    ['فتوحات الأندلس', 'islamic'],
    ['زومبي المدينة', 'city'], // المتأخر يفوز عند التعادل
    ['فيفا 2030', 'sports'], // بيضة فصح تحمل موضوعها
    ['صراع العروش', 'medieval'],
  ];
  for (const [name, want] of cases) {
    it(`«${name}» → ${want}`, () => {
      expect(detectTopic(name).id).toBe(want);
    });
  }

  it('يذكر الكلمة الدالة التي حسمت', () => {
    expect(detectTopic('ملحمة الصحراء').word).toBe('صحراء');
  });
});

describe('TOPIC_WORDS', () => {
  it('لا كلمة تنتمي لموضوعين (بعد التوحيد)', () => {
    const seen = new Map<string, string>();
    for (const [topic, words] of Object.entries(TOPIC_WORDS)) {
      for (const w of words) {
        const n = normAr(w);
        expect(seen.has(n), `«${w}» في ${topic} و${seen.get(n)}`).toBe(false);
        seen.set(n, topic);
      }
    }
  });

  it('الاسم المولّد لموضوع ما يُشتق منه نفس الموضوع', () => {
    for (const t of REAL_TOPICS) {
      for (let i = 0; i < 5; i++) {
        expect(detectTopic(randomGameNameFor(t.id)).id).toBe(t.id);
      }
    }
  });
});
