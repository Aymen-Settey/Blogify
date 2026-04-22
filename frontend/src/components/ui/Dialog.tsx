"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Max-width class, e.g. `max-w-lg`. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Hides the close icon; parent must provide its own dismiss. */
  hideClose?: boolean;
};

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
} as const;

/**
 * Lightweight modal. Focus trapping is a minimal implementation:
 * we cycle Tab / Shift-Tab across focusable descendants and
 * close on Escape. Good enough for the handful of dialogs we use.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  hideClose,
}: DialogProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Scroll-lock while the dialog is mounted.
  React.useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Focus trap + escape.
  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = contentRef.current;
    if (!node) return;
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "dialog-title" : undefined}
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-ink-9/20 backdrop-blur-sm animate-fade-rise"
      />
      <div
        ref={contentRef}
        className={cn(
          "relative w-full rounded-2xl bg-paper-0 border border-ink-2 shadow-xl animate-fade-rise",
          sizes[size],
        )}
      >
        {!hideClose ? (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-ink-5 hover:text-ink-9 hover:bg-paper-2 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        {(title || description) && (
          <div className="px-6 pt-6 pb-3">
            {title ? (
              <h2
                id="dialog-title"
                className="font-display text-2xl font-medium text-ink-9"
              >
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-sm text-ink-6 mt-1">{description}</p>
            ) : null}
          </div>
        )}
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
