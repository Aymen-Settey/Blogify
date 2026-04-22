import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "aurora" | "warn" | "success" | "danger";
type Size = "xs" | "sm";

const tones: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-7 border-ink-2",
  brand: "bg-brand-50 text-brand-700 border-brand-200",
  aurora:
    "bg-aurora-tint text-aurora-ink border-transparent shadow-[0_0_0_1px_rgb(var(--color-aurora-from)/0.3)]",
  warn: "bg-warn/10 text-warn border-warn/30",
  success: "bg-success/10 text-success border-success/30",
  danger: "bg-danger/10 text-danger border-danger/30",
};

const sizes: Record<Size, string> = {
  xs: "text-[10px] px-1.5 py-0.5 gap-1",
  sm: "text-xs px-2 py-0.5 gap-1",
};

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  size?: Size;
  asDot?: boolean;
};

export function Badge({
  className,
  tone = "neutral",
  size = "sm",
  asDot,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium border rounded-full whitespace-nowrap font-sans",
        tones[tone],
        sizes[size],
        className,
      )}
      {...props}
    >
      {asDot ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      ) : null}
      {children}
    </span>
  );
}
