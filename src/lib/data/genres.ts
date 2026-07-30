// أنواع الألعاب + مصفوفة التوافق مع المواضيع.
// الأرقام منقولة من النسخة الأولى بعد ضبطها بمحاكاة الموازنة.

export interface Genre {
  id: string;
  name: string;
  icon: string;
  /** التوزيع المثالي [تصميم، برمجة، صوت] كنسب مئوية */
  ideal: [number, number, number];
  /** بحث مطلوب لفتح النوع */
  research?: string;
}

export const GENRES: Genre[] = [
  { id: 'action', name: 'أكشن', icon: '⚔️', ideal: [30, 50, 20] },
  { id: 'rpg', name: 'RPG', icon: '🧙', ideal: [40, 40, 20] },
  { id: 'sim', name: 'محاكاة', icon: '🏗️', ideal: [20, 60, 20] },
  { id: 'adventure', name: 'مغامرة', icon: '🗺️', ideal: [50, 30, 20] },
  { id: 'strategy', name: 'استراتيجية', icon: '♟️', ideal: [20, 70, 10] },
  { id: 'horror', name: 'رعب', icon: '👻', ideal: [30, 30, 40] },
  { id: 'racing', name: 'سباق', icon: '🏎️', ideal: [25, 55, 20] },
  { id: 'puzzle', name: 'ألغاز', icon: '🧩', ideal: [60, 30, 10] },
  { id: 'mmo', name: 'MMO', icon: '🌐', ideal: [30, 55, 15], research: 'mmo' },
  { id: 'br', name: 'باتل رويال', icon: '🎯', ideal: [25, 55, 20], research: 'br' },
  { id: 'vr', name: 'VR', icon: '🥽', ideal: [35, 40, 25], research: 'vr' },
];

/** توافق نوع × موضوع: من ‎-2 (سيئ) إلى +2 (ممتاز) */
export const SYN: Record<string, Record<string, number>> = {
  action: { space: 1, war: 2, fantasy: 1, sports: 0, zombies: 2, pirates: 1, robots: 2, medieval: 1, city: 0, animals: -1, heritage: 0, desert: 1, folklore: 0, islamic: 1, bedouin: 1 },
  rpg: { space: 0, war: 0, fantasy: 2, sports: -2, zombies: 1, pirates: 1, robots: 0, medieval: 2, city: -1, animals: 1, heritage: 2, desert: 1, folklore: 2, islamic: 2, bedouin: 2 },
  sim: { space: 1, war: 0, fantasy: -1, sports: 2, zombies: -1, pirates: 0, robots: 1, medieval: 0, city: 2, animals: 2, heritage: 1, desert: 1, folklore: 0, islamic: 0, bedouin: 1 },
  adventure: { space: 1, war: 0, fantasy: 2, sports: -1, zombies: 0, pirates: 2, robots: 0, medieval: 1, city: 1, animals: 1, heritage: 2, desert: 2, folklore: 2, islamic: 1, bedouin: 2 },
  strategy: { space: 1, war: 2, fantasy: 1, sports: -1, zombies: 0, pirates: 0, robots: 1, medieval: 2, city: 1, animals: -1, heritage: 1, desert: 0, folklore: 0, islamic: 2, bedouin: 1 },
  horror: { space: 1, war: 0, fantasy: 0, sports: -2, zombies: 2, pirates: 0, robots: 1, medieval: 0, city: 1, animals: 0, heritage: 0, desert: 1, folklore: 1, islamic: -1, bedouin: 0 },
  racing: { space: 1, war: 0, fantasy: 0, sports: 2, zombies: 0, pirates: 0, robots: 1, medieval: -1, city: 2, animals: 0, heritage: -1, desert: 2, folklore: -1, islamic: -2, bedouin: 1 },
  puzzle: { space: 0, war: -1, fantasy: 1, sports: 0, zombies: 0, pirates: 0, robots: 1, medieval: 0, city: 1, animals: 2, heritage: 1, desert: 0, folklore: 2, islamic: 1, bedouin: 0 },
  mmo: { space: 2, war: 1, fantasy: 2, sports: 1, zombies: 1, pirates: 1, robots: 1, medieval: 2, city: 1, animals: 0, heritage: 1, desert: 0, folklore: 1, islamic: 1, bedouin: 0 },
  br: { space: 1, war: 2, fantasy: 0, sports: 0, zombies: 2, pirates: 0, robots: 1, medieval: 0, city: 1, animals: -1, heritage: 0, desert: 1, folklore: -1, islamic: -1, bedouin: 0 },
  vr: { space: 2, war: 0, fantasy: 2, sports: 1, zombies: 1, pirates: 0, robots: 1, medieval: 1, city: 0, animals: 1, heritage: 2, desert: 2, folklore: 2, islamic: 2, bedouin: 1 },
};
