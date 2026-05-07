export const SUBJECTS = [
  "Computer Science",
  "Data Science",
  "AI & Machine Learning",
  "Cybersecurity",
  "Mathematics",
  "Statistics",
  "Physics",
  "Chemistry",
  "Biology",
  "Environmental Science",
  "Engineering",
  "Architecture",
  "Medicine",
  "Nursing",
  "Pharmacy",
  "Public Health",
  "Economics",
  "Finance",
  "Accounting",
  "Business",
  "Marketing",
  "Law",
  "Political Science",
  "Sociology",
  "Psychology",
  "Philosophy",
  "Education",
  "Literature",
  "Linguistics",
  "History",
  "Geography",
  "Languages",
  "Art & Design",
  "Music",
  "Film & Media",
  "Other",
] as const;

export type Subject = (typeof SUBJECTS)[number];

const SUBJECT_COLORS: Record<string, string> = {
  "Computer Science": "bg-blue-100 text-blue-700 border-blue-200",
  Mathematics: "bg-purple-100 text-purple-700 border-purple-200",
  Physics: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Chemistry: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Biology: "bg-green-100 text-green-700 border-green-200",
  Engineering: "bg-orange-100 text-orange-700 border-orange-200",
  Medicine: "bg-rose-100 text-rose-700 border-rose-200",
  Economics: "bg-amber-100 text-amber-700 border-amber-200",
  Business: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Law: "bg-slate-100 text-slate-700 border-slate-200",
  Psychology: "bg-pink-100 text-pink-700 border-pink-200",
  Philosophy: "bg-stone-100 text-stone-700 border-stone-200",
  Literature: "bg-violet-100 text-violet-700 border-violet-200",
  History: "bg-red-100 text-red-700 border-red-200",
  Languages: "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Art & Design": "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  Other: "bg-gray-100 text-gray-700 border-gray-200",
};

export function subjectChipClass(subject: string) {
  return SUBJECT_COLORS[subject] ?? SUBJECT_COLORS.Other;
}

export function subjectLabel(subject: string, customSubject?: string | null) {
  if (subject === "Other" && customSubject && customSubject.trim()) return customSubject.trim();
  return subject;
}
