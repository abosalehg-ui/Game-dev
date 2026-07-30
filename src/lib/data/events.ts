// الأحداث العشوائية وبيض الفصح والإنجازات.

export interface GameEvent {
  icon: string;
  title: string;
  desc: string;
  good: boolean;
  type: string;
}

export const EVENTS: GameEvent[] = [
  { icon: '📈', title: 'ترند ساخن!', desc: 'ألعاب {topic} رائجة! مبيعات لعبتك القادمة ×2 إن وافقت الموضوع', good: true, type: 'trend' },
  { icon: '📉', title: 'أزمة اقتصادية!', desc: 'الركود يضرب السوق. مبيعات اللعبة القادمة -40%', good: false, type: 'recession' },
  { icon: '😂', title: 'تعليق فيروسي!', desc: '«مسوي نفسه EA» 😂 المبيعات القادمة -40%', good: false, type: 'recession' },
  { icon: '🎪', title: 'مهرجان الألعاب!', desc: 'تقييم إضافي +1 للعبتك القادمة', good: true, type: 'festival' },
  { icon: '😡', title: 'منافس شرس!', desc: 'منافسك أصدر لعبة ضخمة! -15% معجبين', good: false, type: 'competitor' },
  { icon: '📦', title: 'عرض ناشر!', desc: 'ناشر كبير يدعم لعبتك القادمة! مبيعات +50%', good: true, type: 'publisher' },
  { icon: '🏆', title: 'جائزة أفضل مطور!', desc: '‎+500 معجب جديد!', good: true, type: 'award' },
  { icon: '🔓', title: 'اختراق أمني!', desc: 'هاكر اخترق خوادمك! تكلفة إصلاح 20% من رصيدك', good: false, type: 'hack' },
  { icon: '💼', title: 'عرض استحواذ!', desc: 'شركة كبيرة اشترت حقوق لعبتك الأخيرة! مكافأة مالية', good: true, type: 'buyout' },
  { icon: '🚪', title: 'موظف يستقيل!', desc: 'أحد المطورين رحل! تقييم اللعبة القادمة -0.5', good: false, type: 'quit' },
  { icon: '🏴‍☠️', title: 'قرصنة!', desc: 'لعبتك انتشرت مقرصنة! مبيعات اللعبة القادمة -30%', good: false, type: 'piracy' },
  { icon: '🎁', title: 'هدية من معجب!', desc: 'معجب ثري أرسل تبرعاً! ‎+15,000 💰', good: true, type: 'gift' },
  { icon: '📱', title: 'انتشار فيروسي!', desc: 'لعبتك صارت ترند! ‎+800 معجب', good: true, type: 'viral' },
  { icon: '🎥', title: 'يوتيوبر مشهور!', desc: 'يوتيوبر لعب لعبتك على الهواء! ‎+1,200 معجب', good: true, type: 'youtuber' },
  { icon: '🔥', title: 'احترق الكمبيوتر!', desc: 'كروت الشاشة احترقت! تكلفة لعبتك القادمة ×2', good: false, type: 'strike' },
  { icon: '🌙', title: 'موسم رمضان!', desc: 'الناس مشغولون بالعبادة. مبيعات اللعبة القادمة -30%', good: false, type: 'recession' },
  { icon: '🎉', title: 'موسم الرياض!', desc: 'موسم الرياض رفع الحماس! مبيعات اللعبة القادمة +60%', good: true, type: 'publisher' },
  { icon: '🕌', title: 'احتفال العيد!', desc: 'العيد كرم! ‎+500 معجب جديد', good: true, type: 'award' },
  { icon: '💻', title: 'انقطاع كهرباء!', desc: 'انقطع الكهرباء أسبوعاً كاملاً. تكلفة إصلاح', good: false, type: 'hack' },
  { icon: '☕', title: 'استراحة قهوة!', desc: 'فريقك مرتاح وأبدع! ‎+1.5 تقييم للعبة القادمة', good: true, type: 'festival' },
  { icon: '📡', title: 'مشكلة سيرفر!', desc: 'تكلفة استعادة 15% من الرصيد', good: false, type: 'hack' },
  { icon: '😤', title: 'إحباط في الفريق!', desc: 'ضغط العمل أرهق الفريق. المعنويات -12', good: false, type: 'moraleDown' },
  { icon: '🎂', title: 'عيد ميلاد في المكتب!', desc: 'كيكة وقهوة للجميع! المعنويات +10', good: true, type: 'moraleUp' },
];

export interface Egg {
  emoji: string;
  desc: string;
  bonus: number;
  topic: string;
}

// اسم البيضة تكريم مقصود، فموضوعها يتقدم على القاموس.
export const EGGS: Record<string, Egg> = {
  'ماريو': { emoji: '🍄', desc: "It's-a me!", bonus: 2, topic: 'fantasy' },
  'زيلدا': { emoji: '🗡️', desc: "It's dangerous to go alone!", bonus: 2, topic: 'fantasy' },
  'ماينكرافت': { emoji: '⛏️', desc: 'Creeper? Aww man...', bonus: 2, topic: 'fantasy' },
  'صب واي': { emoji: '🏃', desc: 'Subway Surfers vibes!', bonus: 1.5, topic: 'city' },
  'فورتنايت': { emoji: '🔫', desc: 'Where we droppin?', bonus: 1.5, topic: 'war' },
  'جي تي أي': { emoji: '🚗', desc: 'Wasted!', bonus: 2, topic: 'city' },
  'فيفا': { emoji: '⚽', desc: 'GOOOAL!', bonus: 1.5, topic: 'sports' },
  'كول أوف ديوتي': { emoji: '🎯', desc: 'Mission accomplished!', bonus: 2, topic: 'war' },
  'بوكيمون': { emoji: '🐱', desc: "Gotta catch 'em all!", bonus: 2, topic: 'animals' },
  'سونيك': { emoji: '💨', desc: 'Gotta go fast!', bonus: 1.5, topic: 'animals' },
  'باك مان': { emoji: '🟡', desc: 'Waka waka waka!', bonus: 1.5, topic: 'city' },
  'تيتريس': { emoji: '🟦', desc: 'Line clear!', bonus: 1.5, topic: 'general' },
  'أمونج أس': { emoji: '🔴', desc: "That's kinda sus...", bonus: 1.5, topic: 'space' },
  'كلاش': { emoji: '⚔️', desc: 'Clash Royale/Clans!', bonus: 1.5, topic: 'medieval' },
  'فطحل': { emoji: '🧠', desc: 'لعبة المعلومات العربية!', bonus: 2, topic: 'general' },
  'صراع العروش': { emoji: '👑', desc: 'وعد قطعته!', bonus: 2, topic: 'medieval' },
  'أنرذد': { emoji: '🏺', desc: 'لعبة عربية أصيلة!', bonus: 2, topic: 'heritage' },
  'دحديح': { emoji: '😎', desc: 'كل سنة ودحديح طيب!', bonus: 1.5, topic: 'folklore' },
  'الفهد': { emoji: '🐆', desc: 'انطلاقة عربية!', bonus: 1.5, topic: 'animals' },
};

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first', name: 'البداية', icon: '🎬', desc: 'أطلق أول لعبة' },
  { id: 'g10', name: '10 ألعاب', icon: '🕹️', desc: 'أطلق 10 ألعاب' },
  { id: 'g20', name: 'غزير الإنتاج', icon: '📀', desc: 'أطلق 20 لعبة' },
  { id: 'g50', name: 'مصنع ألعاب', icon: '🏭', desc: 'أطلق 50 لعبة' },
  { id: 'perfect', name: 'تحفة فنية', icon: '💎', desc: 'حقق تقييم 10/10' },
  { id: 'mill', name: 'مليونير', icon: '💰', desc: 'اجمع مليون' },
  { id: 'mill10', name: 'عشرة ملايين', icon: '🤑', desc: 'اجمع 10 ملايين' },
  { id: 'top', name: 'القمة!', icon: '🏙️', desc: 'اوصل لناطحة السحاب' },
  { id: 'fans1k', name: '1K معجب', icon: '❤️', desc: 'اجمع 1,000 معجب' },
  { id: 'fans10k', name: '10K معجب', icon: '🔥', desc: 'اجمع 10,000 معجب' },
  { id: 'streak5', name: 'سلسلة ذهبية', icon: '🌟', desc: '5 ألعاب متتالية بتقييم ≥ 8' },
  { id: 'eggs3', name: 'صائد البيض', icon: '🥚', desc: 'اكتشف 3 بيضات فصح' },
  { id: 'ip3', name: 'باني السلاسل', icon: '📦', desc: 'امتلك 3 سلاسل (IPs)' },
  { id: 'res5', name: 'باحث', icon: '🔬', desc: 'أنجز 5 أبحاث' },
  { id: 'emp5', name: 'مدير ناجح', icon: '👔', desc: 'وظّف 5 موظفين' },
  { id: 'prestige1', name: 'Prestige أول', icon: '⭐', desc: 'أعد البدء بنقاط Prestige' },
  { id: 'award3', name: '3 جوائز سنوية', icon: '🏆', desc: 'افز بجائزة لعبة العام 3 مرات' },
  { id: 'market25', name: 'متصدر السوق', icon: '📊', desc: 'حصة سوقية 25%' },
  { id: 'goty2', name: 'هزمت المنافسين', icon: '⚔️', desc: 'افز بلعبة العام مرتين' },
  { id: 'loan1', name: 'ذمة نظيفة', icon: '🏦', desc: 'سدّد قرضاً كاملاً' },
  { id: 'eng3', name: 'محرك v3', icon: '⚙️', desc: 'رقِّ محركك للإصدار الثالث' },
  { id: 'lex8', name: 'نصف المعجم', icon: '📖', desc: 'أطلق ألعاباً في 8 مواضيع مختلفة' },
  { id: 'lexAll', name: 'معجم الاستوديو', icon: '📚', desc: 'أطلق لعبة في كل موضوع' },
];
