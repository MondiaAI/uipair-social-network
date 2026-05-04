export const PROJECT_CATEGORIES = ["hackathon", "research", "startup", "course", "other"] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PROJECT_ROLES = ["designer", "coder", "researcher", "writer", "other"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const CATEGORY_LABEL: Record<ProjectCategory, string> = {
  hackathon: "Hackathons",
  research: "Research",
  startup: "Startup",
  course: "Course Projects",
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
  { value: "research", label: "Research" },
  { value: "startup", label: "Startup" },
  { value: "course", label: "Course Projects" },
];
