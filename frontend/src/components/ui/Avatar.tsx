import * as React from "react";
import { cn } from "@/lib/cn";

const SIZE_CLASSES = {
  xs: "h-6 w-6 text-[11px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
} as const;

export type AvatarProps = {
  src?: string | null;
  alt?: string;
  name?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
};

/** Deterministic two-letter initials derived from a display name. */
function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Pick one of a handful of editorial gradient presets from the name. */
function gradientOf(name?: string | null): string {
  const seed = (name ?? "blogify").split("").reduce(
    (acc, c) => acc + c.charCodeAt(0),
    0,
  );
  const palettes = [
    "from-brand-500 to-brand-700",
    "from-ink-7 to-ink-9",
    "from-[rgb(var(--color-aurora-from))] to-[rgb(var(--color-aurora-to))]",
    "from-amber-500 to-rose-500",
    "from-emerald-500 to-teal-700",
    "from-fuchsia-500 to-indigo-600",
  ];
  return palettes[seed % palettes.length];
}

export function Avatar({
  src,
  alt,
  name,
  size = "md",
  className,
}: AvatarProps) {
  const sizing = SIZE_CLASSES[size];
  if (src) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt={alt ?? name ?? ""}
        className={cn(
          sizing,
          "rounded-full object-cover border border-ink-2 bg-paper-1",
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-label={alt ?? name ?? "avatar"}
      className={cn(
        sizing,
        "inline-flex items-center justify-center rounded-full font-sans font-semibold text-paper-0",
        "bg-gradient-to-br",
        gradientOf(name),
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
