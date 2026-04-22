"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type DropdownItem = {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
};

export type DropdownMenuProps = {
  trigger: React.ReactNode;
  items: Array<DropdownItem | "separator">;
  align?: "start" | "end";
  className?: string;
};

/**
 * Uncontrolled dropdown. Click-outside + Escape close.
 */
export function DropdownMenu({
  trigger,
  items,
  align = "end",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center"
      >
        {trigger}
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute top-[calc(100%+6px)] min-w-[200px] rounded-xl border border-ink-2 bg-paper-0 shadow-lg p-1.5 z-40 animate-fade-rise",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) => {
            if (item === "separator") {
              return (
                <div
                  key={`sep-${i}`}
                  role="separator"
                  className="my-1 h-px bg-ink-2"
                />
              );
            }
            const common = cn(
              "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-sans text-ink-7 text-left",
              "hover:bg-paper-2 hover:text-ink-9 transition-colors",
              item.destructive && "text-danger hover:text-danger",
              item.disabled && "opacity-50 pointer-events-none",
            );
            if (item.href) {
              return (
                <a
                  key={item.key}
                  role="menuitem"
                  href={item.href}
                  className={common}
                  onClick={() => setOpen(false)}
                >
                  {item.icon}
                  {item.label}
                </a>
              );
            }
            return (
              <button
                key={item.key}
                role="menuitem"
                type="button"
                className={common}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
