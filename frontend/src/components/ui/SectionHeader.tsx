import * as React from "react";
import { cn } from "@/lib/cn";

export type SectionHeaderProps = {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  align?: "start" | "center";
  size?: "md" | "lg" | "xl";
  as?: "h1" | "h2" | "h3";
  className?: string;
};

const titleSize = {
  md: "text-3xl sm:text-4xl",
  lg: "text-display-md",
  xl: "text-display-lg",
} as const;

export function SectionHeader({
  kicker,
  title,
  description,
  action,
  align = "start",
  size = "lg",
  as: Tag = "h2",
  className,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-2 max-w-3xl",
          align === "center" && "items-center text-center mx-auto",
        )}
      >
        {kicker ? <span className="kicker">{kicker}</span> : null}
        <Tag
          className={cn(
            "font-display font-medium tracking-tight text-ink-9",
            titleSize[size],
          )}
        >
          {title}
        </Tag>
        {description ? (
          <p className="text-ink-6 leading-relaxed text-[0.975rem] sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="shrink-0 flex items-center gap-2">{action}</div>
      ) : null}
    </header>
  );
}
