export const SUBJECTS = [
  // Computing & IT
  "Computer Science",
  "Business Information Technology",
  "Information Systems",
  "Software Engineering",
  "Data Science",
  "AI & Machine Learning",
  "Cybersecurity",
  "Networking",
  "Cloud Computing",
  // Business & Management
  "Business Administration (BBA)",
  "Business Management",
  "Business and Innovation",
  "Project Management",
  "Entrepreneurship",
  "Supply Chain Management",
  "Human Resource Management",
  "Marketing",
  "Finance",
  "Accounting",
  "Economics",
  "International Business",
  "Hospitality & Tourism",
  // Health & Life Sciences
  "Medicine (MBBS/MD)",
  "Nursing (BSc Nursing)",
  "Pharmacy",
  "Public Health",
  "Community Health",
  "Biomedical Sciences",
  "Biology",
  "Biotechnology",
  "Nutrition & Dietetics",
  "Physiotherapy",
  "Veterinary Medicine",
  // Sciences & Engineering
  "Mathematics",
  "Statistics",
  "Physics",
  "Chemistry",
  "Environmental Science",
  "Agriculture",
  "Civil Engineering",
  "Mechanical Engineering",
  "Electrical Engineering",
  "Electronics & Telecommunications",
  "Chemical Engineering",
  "Industrial Engineering",
  "Architecture",
  "Quantity Surveying",
  // Social Sciences & Humanities
  "Law (LLB)",
  "Political Science",
  "International Relations",
  "Sociology",
  "Psychology",
  "Philosophy",
  "Education (BEd)",
  "Literature",
  "Linguistics",
  "History",
  "Geography",
  "Languages",
  "Journalism & Mass Communication",
  // Arts & Media
  "Art & Design",
  "Graphic Design",
  "Music",
  "Film & Media",
  "Performing Arts",
  // Common postgraduate degrees
  "MBA",
  "MSc (General)",
  "MA (General)",
  "BSc (General)",
  "PhD / Doctoral Studies",
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

// ---------- User-added custom subjects (synced across the app) ----------

const CUSTOM_SUBJECTS_KEY = "peerly.subjects.custom";
export const CUSTOM_SUBJECTS_EVT = "peerly:custom-subjects-changed";

function readCustomSubjects(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_SUBJECTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeCustomSubjects(list: string[]) {
  try {
    localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(list));
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CUSTOM_SUBJECTS_EVT, { detail: list }));
  }
}

/** Add a manually typed subject to the global list (deduped, case-insensitive). */
export function addCustomSubject(value: string) {
  const v = value.trim();
  if (!v) return;
  const lower = v.toLowerCase();
  if ((SUBJECTS as readonly string[]).some((s) => s.toLowerCase() === lower)) return;
  const current = readCustomSubjects();
  if (current.some((s) => s.toLowerCase() === lower)) return;
  writeCustomSubjects([...current, v]);
}

export function getCustomSubjects(): string[] {
  return readCustomSubjects();
}

/** Combined list: built-in SUBJECTS + user-added customs (Other stays last). */
export function getAllSubjects(): string[] {
  const base = SUBJECTS as readonly string[];
  const custom = readCustomSubjects();
  const idx = base.indexOf("Other");
  if (idx === -1) return [...base, ...custom];
  return [...base.slice(0, idx), ...custom, "Other"];
}
