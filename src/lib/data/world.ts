// بيانات العالم الثابتة: المنصات، المراحل، الصعوبة، الأبحاث، المحرك،
// الموظفون، المنافسون، الناشرون، المعارض.

export interface Platform {
  id: string;
  name: string;
  icon: string;
  costMult: number;
  audMult: number;
  /** الأنواع التي تتفوق فيها المنصة (+) أو تضعف (-) */
  fit: Record<string, number>;
}

export const PLATFORMS: Platform[] = [
  { id: 'pc', name: 'PC', icon: '💻', costMult: 1.0, audMult: 1.0, fit: { strategy: 0.2, sim: 0.15, mmo: 0.15, puzzle: -0.1 } },
  { id: 'mobile', name: 'موبايل', icon: '📱', costMult: 0.6, audMult: 1.5, fit: { puzzle: 0.25, sim: 0.1, strategy: -0.15, vr: -0.3 } },
  { id: 'console', name: 'كونسول', icon: '🎮', costMult: 1.3, audMult: 1.3, fit: { action: 0.2, racing: 0.2, sports: 0.15, strategy: -0.15 } },
  { id: 'web', name: 'ويب', icon: '🌐', costMult: 0.4, audMult: 0.7, fit: { puzzle: 0.15, mmo: 0.1, vr: -0.4, racing: -0.1 } },
];

/** تشبع الجمهور: كل منصة إضافية تصل لشريحة أصغر */
export const PLATFORM_SATURATION = [1, 0.85, 0.7, 0.6];

export interface StageDef {
  name: string;
  icon: string;
  devCost: number;
  maxPts: number;
  upgCost: number;
  /** سعة الموظفين في هذه المرحلة */
  empCap: number;
}

// منحنى اقتصادي بمعامل ~×2.5 ثابت بين المراحل — مضبوط بمحاكاة موازنة النسخة الأولى.
export const STAGES: StageDef[] = [
  { name: 'غرفة النوم', icon: '🛏️', devCost: 5000, maxPts: 10, upgCost: 70000, empCap: 0 },
  { name: 'الكراج', icon: '🔧', devCost: 10000, maxPts: 12, upgCost: 230000, empCap: 2 },
  { name: 'مكتب صغير', icon: '🏢', devCost: 22000, maxPts: 14, upgCost: 1100000, empCap: 4 },
  { name: 'استوديو', icon: '🎬', devCost: 60000, maxPts: 17, upgCost: 3800000, empCap: 7 },
  { name: 'شركة', icon: '🏬', devCost: 160000, maxPts: 20, upgCost: 7500000, empCap: 12 },
  { name: 'ناطحة سحاب', icon: '🏙️', devCost: 420000, maxPts: 24, upgCost: Infinity, empCap: 18 },
];

export const DIFFICULTY = {
  easy: { name: 'مبتدئ', icon: '🌱', costMult: 0.7, rewardMult: 1.3, startMoney: 15000, desc: 'بداية مريحة ومكافآت أكبر' },
  normal: { name: 'عادي', icon: '⚖️', costMult: 1.0, rewardMult: 1.0, startMoney: 10000, desc: 'التجربة المتوازنة' },
  hard: { name: 'صعب', icon: '🔥', costMult: 1.3, rewardMult: 0.75, startMoney: 7000, desc: 'لعشاق التحدي الحقيقي' },
} as const;

export type DifficultyId = keyof typeof DIFFICULTY;

export interface ResearchNode {
  id: string;
  name: string;
  icon: string;
  cost: number;
  desc: string;
}

export const RESEARCH: ResearchNode[] = [
  { id: 'mmo', name: 'فتح MMO', icon: '🌐', cost: 5, desc: 'يفتح نوع MMO' },
  { id: 'br', name: 'فتح باتل رويال', icon: '🎯', cost: 5, desc: 'يفتح نوع باتل رويال' },
  { id: 'vr', name: 'فتح VR', icon: '🥽', cost: 8, desc: 'يفتح نوع الواقع الافتراضي' },
  { id: 'engine', name: 'محرك ألعاب خاص', icon: '⚙️', cost: 10, desc: '‎-20% تكلفة التطوير دائماً' },
  { id: 'hd', name: 'رسومات HD', icon: '🖼️', cost: 6, desc: '‎+0.5 تقييم تلقائي لكل لعبة' },
  { id: 'sound', name: 'صوت 3D متقدم', icon: '🔊', cost: 4, desc: 'محور الصوت +30% فعالية' },
  { id: 'design', name: 'أدوات تصميم احترافية', icon: '🎨', cost: 4, desc: 'محور التصميم +30% فعالية' },
  { id: 'code', name: 'مكتبات برمجية متقدمة', icon: '💻', cost: 4, desc: 'محور البرمجة +30% فعالية' },
  { id: 'crossplat', name: 'لعب عبر المنصات', icon: '🔗', cost: 7, desc: '‎+15% مبيعات لكل منصة إضافية' },
  { id: 'analytics', name: 'تحليلات سوقية', icon: '📊', cost: 6, desc: '‎+25% فعالية حملات التسويق' },
  { id: 'community', name: 'إدارة مجتمع', icon: '👥', cost: 5, desc: '‎+50% معجبين من النجاحات' },
  { id: 'esports', name: 'رياضات إلكترونية', icon: '🏆', cost: 9, desc: '‎+1 تقييم لألعاب الأكشن والسباق' },
  { id: 'modding', name: 'دعم Modding', icon: '🧩', cost: 5, desc: '‎+30% معجبين من RPG والمحاكاة' },
  { id: 'cloud', name: 'حفظ سحابي', icon: '☁️', cost: 3, desc: '‎+10% بقاء المعجبين' },
  { id: 'aiart', name: 'فن AI مساعد', icon: '✨', cost: 8, desc: '‎-15% تكلفة + 0.3 تقييم' },
];

export interface EngineVersion {
  v: number;
  cost: number;
  res: number;
  costDisc: number;
  score: number;
}

export const ENGINE_VERSIONS: EngineVersion[] = [
  { v: 1, cost: 0, res: 0, costDisc: 0.8, score: 0 },
  { v: 2, cost: 150000, res: 4, costDisc: 0.75, score: 0.2 },
  { v: 3, cost: 600000, res: 6, costDisc: 0.7, score: 0.4 },
  { v: 4, cost: 2500000, res: 8, costDisc: 0.65, score: 0.6 },
];

export interface EmpRole {
  id: string;
  name: string;
  icon: string;
  skill: 'design' | 'code' | 'sound' | 'marketing';
  baseSalary: number;
}

export const EMP_ROLES: EmpRole[] = [
  { id: 'designer', name: 'مصمم', icon: '🎨', skill: 'design', baseSalary: 1500 },
  { id: 'coder', name: 'مبرمج', icon: '💻', skill: 'code', baseSalary: 2000 },
  { id: 'artist', name: 'فنان', icon: '🖼️', skill: 'design', baseSalary: 1700 },
  { id: 'composer', name: 'ملحّن', icon: '🎵', skill: 'sound', baseSalary: 1300 },
  { id: 'marketer', name: 'مسوّق', icon: '📢', skill: 'marketing', baseSalary: 1800 },
];

export const EMP_LEVELS = [
  { name: 'Junior', mult: 1.0, salMult: 1.0 },
  { name: 'Mid', mult: 1.3, salMult: 1.5 },
  { name: 'Senior', mult: 1.7, salMult: 2.2 },
  { name: 'Lead', mult: 2.2, salMult: 3.0 },
];

export const EMP_NAMES = ['أحمد', 'سالم', 'عبدالله', 'محمد', 'خالد', 'فيصل', 'سعد', 'نواف', 'ماجد', 'سلطان', 'نورة', 'ريم', 'هند', 'سارة', 'جواهر', 'منى', 'أمل', 'لمى', 'طلال', 'بدر', 'غادة', 'دانة'];

export const RIVAL_DEFS = [
  { id: 'falcon', name: 'استوديو الصقر', icon: '🦅' },
  { id: 'palm', name: 'ألعاب النخلة', icon: '🌴' },
  { id: 'mirage', name: 'استوديوهات السراب', icon: '🏜️' },
  { id: 'bolt', name: 'فريق البرق', icon: '⚡' },
];

export const PUBLISHERS = [
  { name: 'ناشر الخليج', icon: '🏢' },
  { name: 'أوميغا غيمز', icon: '🎯' },
  { name: 'شركة الأفق', icon: '🌅' },
  { name: 'بكسل ستار', icon: '⭐' },
];

export const LOAN_INTEREST: Record<DifficultyId, number> = { easy: 0.1, normal: 0.15, hard: 0.2 };

export interface ConventionOption {
  name: string;
  cost: number;
  fans: number;
  money: number;
  research?: number;
}

export interface Convention {
  id: string;
  name: string;
  icon: string;
  desc: string;
  options: ConventionOption[];
}

export const CONVENTIONS: Convention[] = [
  {
    id: 'e3', name: 'E3', icon: '🎪', desc: 'أكبر معرض ألعاب عالمي',
    options: [
      { name: 'عرض صغير', cost: 20000, fans: 300, money: 5000 },
      { name: 'عرض كبير', cost: 80000, fans: 1500, money: 30000 },
      { name: 'كشف لعبة جديدة', cost: 200000, fans: 5000, money: 100000 },
    ],
  },
  {
    id: 'gdc', name: 'GDC العربي', icon: '🎓', desc: 'مؤتمر مطوري الألعاب العربي',
    options: [
      { name: 'حضور فقط', cost: 5000, fans: 100, money: 2000, research: 1 },
      { name: 'محاضرة', cost: 15000, fans: 400, money: 5000, research: 3 },
    ],
  },
  {
    id: 'gex', name: 'معرض الألعاب السعودي', icon: '🏟️', desc: 'أكبر معرض في المنطقة',
    options: [
      { name: 'جناح صغير', cost: 30000, fans: 600, money: 15000 },
      { name: 'جناح كبير', cost: 100000, fans: 2500, money: 60000 },
    ],
  },
];

export const MARKETING_TIERS = [
  { id: 'none', name: 'بدون حملة', icon: '🚫', cost: 0, bonus: 0, hype: 0 },
  { id: 'small', name: 'حملة صغيرة', icon: '📣', cost: 5000, bonus: 0.15, hype: 20 },
  { id: 'medium', name: 'حملة متوسطة', icon: '📺', cost: 25000, bonus: 0.35, hype: 50 },
  { id: 'large', name: 'حملة كبيرة', icon: '🛰️', cost: 100000, bonus: 0.6, hype: 100 },
] as const;

export const QA_MODES = [
  { id: 'quick', name: 'إطلاق سريع', icon: '⚡', costRatio: 0, desc: 'مجاناً — لكن خطر بَقّات يخفض التقييم' },
  { id: 'normal', name: 'اختبار عادي', icon: '⚙️', costRatio: 0.1, desc: '10% من التكلفة — بَقّات أقل' },
  { id: 'full', name: 'اختبار شامل', icon: '🛡️', costRatio: 0.25, desc: '25% من التكلفة + بونص تقييم' },
] as const;

export const DLC_MAX = 3;
