"use client";

import { Sparkles } from "lucide-react";
import { AuroraChip } from "@/components/ui/AuroraChip";

interface Props {
  explanation?: Record<string, number> | null;
}

/**
 * Legacy adapter — retained so existing call sites keep working.
 * Internally renders the new `AuroraChip` using the same signal shape.
 * New code should import `AuroraChip` directly.
 */
export function ExplanationChip({ explanation }: Props) {
  if (!explanation || Object.keys(explanation).length === 0) return null;

  const priority = ["rerank", "rrf", "dense", "bm25", "freshness", "quality"];
  const headlineKey = priority.find(
    (k) => explanation[k] !== undefined && explanation[k] !== 0,
  );
  if (!headlineKey) return null;

  const headlineLabel: Record<string, string> = {
    dense: "Semantic match",
    bm25: "Keyword match",
    rerank: "Top rerank",
    rrf: "Hybrid match",
    freshness: "Fresh",
    quality: "Popular",
  };

  return (
    <AuroraChip
      label={headlineLabel[headlineKey] ?? "Why this?"}
      signals={explanation}
    />
  );
}

// Keep the icon export path stable for anything that imported it directly.
export { Sparkles };
