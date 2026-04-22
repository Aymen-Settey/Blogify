"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * AuroraChip — first-class AI provenance badge.
 * Replaces the legacy ExplanationChip with a more confident visual language:
 *   - serif "Why this?" label
 *   - aurora ring pulse (animation-once on mount)
 *   - humanized breakdown in tooltip (not raw JSON)
 *
 * Signals prop mirrors the shape used by ExplanationChip but is translated
 * into plain English on render.
 */
export type AuroraSignals = {
  /** Short user-facing one-liner shown on the chip itself. */
  label?: string;
  /** Recommender breakdown. All optional. 0–1 where higher = stronger. */
  breakdown?: {
    dense?: number;
    bm25?: number;
    rerank?: number;
    freshness?: number;
    quality?: number;
    field?: number;
    [k: string]: number | undefined;
  };
};

const READABLE: Record<string, string> = {
  dense: "Semantic similarity",
  bm25: "Keyword match",
  rerank: "Re-ranker confidence",
  freshness: "Freshness",
  quality: "Editorial quality",
  field: "Field match",
};

function humanize(signals?: AuroraSignals["breakdown"]): string[] {
  if (!signals) return [];
  return Object.entries(signals)
    .filter(([, v]) => typeof v === "number" && !Number.isNaN(v))
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 4)
    .map(([k, v]) => `${READABLE[k] ?? k}: ${((v as number) * 100).toFixed(0)}%`);
}

export type AuroraChipProps = {
  label?: string;
  signals?: AuroraSignals["breakdown"];
  size?: "sm" | "md";
  className?: string;
};

export function AuroraChip({
  label = "Why this?",
  signals,
  size = "sm",
  className,
}: AuroraChipProps) {
  const lines = humanize(signals);
  const content =
    lines.length > 0 ? (
      <span className="block text-left max-w-[200px] whitespace-normal leading-snug">
        <span className="block font-medium mb-0.5">Why we picked it</span>
        {lines.map((l) => (
          <span key={l} className="block">
            · {l}
          </span>
        ))}
      </span>
    ) : (
      "Recommended by Blogify’s AI"
    );

  return (
    <Tooltip content={content} side="top">
      <span
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-full border border-aurora-from/30 bg-aurora-tint/60 text-aurora-ink font-medium font-sans overflow-hidden",
          "shadow-[inset_0_0_0_1px_rgb(var(--color-aurora-from)/0.15)]",
          size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1",
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full animate-aurora-chip-sweep",
            "bg-[linear-gradient(110deg,transparent_0%,transparent_35%,rgb(var(--color-aurora-from)/0.28)_50%,transparent_65%,transparent_100%)]",
            "bg-[length:220%_100%]",
            "motion-reduce:hidden",
          )}
        />
        <Sparkles
          className={cn("relative", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")}
          aria-hidden
        />
        <span className="relative font-display italic text-[0.95em] tracking-tight">
          {label}
        </span>
      </span>
    </Tooltip>
  );
}
