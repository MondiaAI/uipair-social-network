export const GIG_CATEGORIES = [
  "tutoring",
  "notes",
  "coding",
  "research",
  "design",
  "writing",
  "translation",
  "proofreading",
  "video_editing",
  "data_analysis",
  "presentations",
  "language_practice",
  "music",
  "photography",
  "marketing",
  "other",
] as const;

export type GigCategory = (typeof GIG_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<GigCategory, string> = {
  tutoring: "Tutoring",
  notes: "Notes",
  coding: "Coding",
  research: "Pair-research",
  design: "Design",
  writing: "Writing",
  translation: "Translation",
  proofreading: "Proofreading",
  video_editing: "Video editing",
  data_analysis: "Data analysis",
  presentations: "Presentations",
  language_practice: "Language practice",
  music: "Music",
  photography: "Photography",
  marketing: "Marketing",
  other: "Other",
};

export function gigCategoryLabel(category: GigCategory, customCategory?: string | null) {
  if (category === "other" && customCategory && customCategory.trim()) return customCategory.trim();
  return CATEGORY_LABEL[category];
}

export function gigCategoryChip(category: GigCategory) {
  return CATEGORY_CHIP[category];
}

export const CATEGORY_CHIP: Record<GigCategory, string> = {
  tutoring: "bg-blue-100 text-blue-700 border-blue-200",
  notes: "bg-amber-100 text-amber-700 border-amber-200",
  research: "bg-purple-100 text-purple-700 border-purple-200",
  coding: "bg-emerald-100 text-emerald-700 border-emerald-200",
  design: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  writing: "bg-orange-100 text-orange-700 border-orange-200",
  translation: "bg-cyan-100 text-cyan-700 border-cyan-200",
  proofreading: "bg-rose-100 text-rose-700 border-rose-200",
  video_editing: "bg-red-100 text-red-700 border-red-200",
  data_analysis: "bg-indigo-100 text-indigo-700 border-indigo-200",
  presentations: "bg-yellow-100 text-yellow-700 border-yellow-200",
  language_practice: "bg-teal-100 text-teal-700 border-teal-200",
  music: "bg-violet-100 text-violet-700 border-violet-200",
  photography: "bg-stone-100 text-stone-700 border-stone-200",
  marketing: "bg-lime-100 text-lime-700 border-lime-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

const COUNTRY_FLAGS: Record<string, string> = {
  Kenya: "🇰🇪", Nigeria: "🇳🇬", Ghana: "🇬🇭", "South Africa": "🇿🇦", Egypt: "🇪🇬",
  India: "🇮🇳", Pakistan: "🇵🇰", Bangladesh: "🇧🇩", China: "🇨🇳", Japan: "🇯🇵",
  Singapore: "🇸🇬", Malaysia: "🇲🇾", Indonesia: "🇮🇩", Philippines: "🇵🇭", Vietnam: "🇻🇳",
  "United States": "🇺🇸", USA: "🇺🇸", Canada: "🇨🇦", Mexico: "🇲🇽", Brazil: "🇧🇷",
  Argentina: "🇦🇷", Chile: "🇨🇱", "United Kingdom": "🇬🇧", UK: "🇬🇧", Ireland: "🇮🇪",
  France: "🇫🇷", Germany: "🇩🇪", Spain: "🇪🇸", Italy: "🇮🇹", Netherlands: "🇳🇱",
  Sweden: "🇸🇪", Norway: "🇳🇴", Poland: "🇵🇱", Turkey: "🇹🇷", UAE: "🇦🇪",
  "Saudi Arabia": "🇸🇦", Australia: "🇦🇺", "New Zealand": "🇳🇿",
};

export function countryFlag(country?: string | null) {
  if (!country) return "";
  return COUNTRY_FLAGS[country] ?? "🌍";
}


export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
