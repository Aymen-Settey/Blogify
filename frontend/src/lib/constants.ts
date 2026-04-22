export const RESEARCH_FIELDS = [
  "Computer Science",
  "Biology",
  "Physics",
  "Chemistry",
  "Mathematics",
  "Medicine",
  "Psychology",
  "Economics",
  "Engineering",
  "Social Sciences",
  "Other",
] as const;

export type ResearchField = (typeof RESEARCH_FIELDS)[number];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "zh", label: "Chinese" },
] as const;
