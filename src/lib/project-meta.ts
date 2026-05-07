export const PROJECT_CATEGORIES = [
  "hackathon",
  "research",
  "startup",
  "course",
  "open_source",
  "thesis",
  "competition",
  "club",
  "nonprofit",
  "other",
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PROJECT_ROLES = ["designer", "coder", "researcher", "writer", "other"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const CATEGORY_LABEL: Record<ProjectCategory, string> = {
  hackathon: "Hackathons",
  research: "Pair-research",
  startup: "Startup",
  course: "Course Projects",
  open_source: "Open source",
  thesis: "Thesis",
  competition: "Competition",
  club: "Student club",
  nonprofit: "Nonprofit",
  other: "Other",
};

export const ROLE_CHIP: Record<ProjectRole, string> = {
  designer: "bg-pink-100 text-pink-700 border-pink-200",
  coder: "bg-blue-100 text-blue-700 border-blue-200",
  researcher: "bg-purple-100 text-purple-700 border-purple-200",
  writer: "bg-amber-100 text-amber-700 border-amber-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

export const ROLE_LABEL: Record<ProjectRole, string> = {
  designer: "Designer",
  coder: "Coder",
  researcher: "Researcher",
  writer: "Writer",
  other: "Other",
};

export const CATEGORY_FILTERS: { value: ProjectCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "hackathon", label: "Hackathons" },
  { value: "research", label: "Pair-research" },
  { value: "startup", label: "Startup" },
  { value: "course", label: "Course Projects" },
  { value: "open_source", label: "Open source" },
  { value: "thesis", label: "Thesis" },
  { value: "competition", label: "Competition" },
  { value: "club", label: "Student club" },
  { value: "nonprofit", label: "Nonprofit" },
];

export function projectCategoryLabel(category: ProjectCategory, customCategory?: string | null) {
  if (category === "other" && customCategory && customCategory.trim()) return customCategory.trim();
  return CATEGORY_LABEL[category];
}
