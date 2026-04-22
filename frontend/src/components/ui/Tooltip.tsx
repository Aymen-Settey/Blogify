"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
};

/**
 * Minimal hover / focus tooltip. Uses CSS positioning + portal-less rendering.
 * Not a replacement for a full a11y-perfect solution, but keyboard accessible
 * and respects `prefers-reduced-motion` via the global utility in globals.css.
 */
export function Tooltip({
  content,
  side = "top",
  delay = 150,
  children,
  className,
  ...props
}: Props) {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  const position = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }[side];

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      {...props}
    >
      {children}
      {open ? (
        <span
          role="tooltip"
          className={cn(
            "absolute z-40 pointer-events-none whitespace-nowrap rounded-md bg-ink-9 text-paper-0 text-xs px-2.5 py-1.5 shadow-lg animate-fade-rise",
            position,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
