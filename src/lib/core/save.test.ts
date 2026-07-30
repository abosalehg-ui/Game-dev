import { describe, it, expect } from 'vitest';
import { sanitizeSave, exportSave, importSave, serialize } from './save';
import { initialState } from './model';


describe('sanitizeSave', () => {
  it('يعيد حالة صالحة من كائن فارغ', () => {
    const s = sanitizeSave({});
    expect(s.stage).toBe(0);
    expect(s.money).toBeGreaterThan(0);
  });

  it('يرفض القيم الخارجة عن الحدود', () => {
    const s = sanitizeSave({ stage: 99, morale: 500, money: 'كثير', fans: -10 });
    expect(s.stage).toBe(5);
    expect(s.morale).toBe(100);
    expect(typeof s.money).toBe('number');
    expect(s.fans).toBe(0);
  });

  it('يرفض المعرفات غير المعروفة في القوائم', () => {
    const s = sanitizeSave({
      research: ['hd', 'غير_موجود', 'hd'],
      topicsShipped: ['desert', 'general', 'مزيف'],
      achievements: ['first', 'fake'],
    });
    expect(s.research).toEqual(['hd']);
    expect(s.topicsShipped).toEqual(['desert']);
    expect(s.achievements).toEqual(['first']);
  });

  it('يرفض موظفاً بدور غير معروف ويقبل الصالح', () => {
    const s = sanitizeSave({
      employees: [
        { id: 1, name: 'خالد', role: 'coder', level: 2, xp: 5 },
        { id: 2, name: 'x', role: 'hacker', level: 0, xp: 0 },
      ],
    });
    expect(s.employees.length).toBe(1);
    expect(s.employees[0].role).toBe('coder');
  });

  it('يقصّ نص اسم طويل ولا يمرر كائنات غريبة', () => {
    const s = sanitizeSave({ project: { name: 'أ'.repeat(999), genre: 'action', sliders: {}, platforms: ['pc'] } });
    expect(s.project!.name.length).toBeLessThanOrEqual(120);
    expect(s.project!.qa).toBe('normal');
  });

  it('قرض بلا أقساط متبقية يُهمل', () => {
    expect(sanitizeSave({ loan: { principal: 1000, installment: 100, remaining: 0 } }).loan).toBeNull();
  });
});

describe('export/import roundtrip', () => {
  it('التصدير ثم الاستيراد يعيد نفس الحالة الجوهرية', () => {
    const s = initialState('hard', 7000);
    s.started = true;
    s.money = 123456;
    s.gamesCount = 7;
    s.research = ['hd', 'engine'];
    s.engineVersion = 1;
    s.topicsShipped = ['desert', 'space'];
    const code = exportSave(s);
    const back = importSave(code);
    expect(back).not.toBeNull();
    expect(back!.money).toBe(123456);
    expect(back!.gamesCount).toBe(7);
    expect(back!.difficulty).toBe('hard');
    expect(back!.research).toEqual(['hd', 'engine']);
  });

  it('استيراد نص تالف يعيد null بلا رمي', () => {
    expect(importSave('ليس رمزاً')).toBeNull();
    expect(importSave(btoa('{"broken'))).toBeNull();
  });

  it('lastReview لا يدخل الحفظ', () => {
    const s = initialState('normal', 10000);
    expect(serialize(s).includes('lastReview')).toBe(false);
  });
});
