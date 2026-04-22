"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
  /** `icon` = single toggle button; `segmented` = 3-way segmented control. */
  variant?: "icon" | "segmented";
};

export function ThemeToggle({ className, variant = "icon" }: Props) {
  const { preference, resolved, setPreference, toggle } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (variant === "segmented") {
    const options: Array<{ value: ThemePreference; icon: React.ReactNode; label: string }> = [
      { value: "light", icon: <Sun className="h-3.5 w-3.5" />, label: "Light" },
      { value: "system", icon: <Monitor className="h-3.5 w-3.5" />, label: "System" },
      { value: "dark", icon: <Moon className="h-3.5 w-3.5" />, label: "Dark" },
    ];
    return (
      <div
        role="radiogroup"
        aria-label="Theme"
        className={cn(
          "inline-flex items-center rounded-full border border-ink-2 bg-paper-1 p-0.5",
          className,
        )}
      >
        {options.map((opt) => {
          const active = mounted && preference === opt.value;
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={active}
              type="button"
              onClick={() => setPreference(opt.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-paper-0 text-ink-9 shadow-sm"
                  : "text-ink-5 hover:text-ink-8",
              )}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-6 hover:text-ink-9 hover:bg-paper-2 transition-colors",
        className,
      )}
    >
      {mounted && resolved === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
