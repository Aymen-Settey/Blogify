"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastKind = "success" | "error" | "info";
type ToastItem = {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
};

type ToastContextValue = {
  push: (kind: ToastKind, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { id, kind, title, description }]);
      setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      push,
      success: (t, d) => push("success", t, d),
      error: (t, d) => push("error", t, d),
      info: (t, d) => push("info", t, d),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div
              aria-live="polite"
              aria-atomic="true"
              className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
            >
              {items.map((t) => (
                <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onClose,
}: {
  item: ToastItem;
  onClose: () => void;
}) {
  const Icon =
    item.kind === "success"
      ? CheckCircle2
      : item.kind === "error"
        ? AlertCircle
        : Info;
  const tone =
    item.kind === "success"
      ? "text-success"
      : item.kind === "error"
        ? "text-danger"
        : "text-brand-600";
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto min-w-[260px] max-w-sm rounded-xl border border-ink-2 bg-paper-0 shadow-lg p-3.5 flex items-start gap-3 animate-fade-rise",
      )}
    >
      <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", tone)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-9">{item.title}</p>
        {item.description ? (
          <p className="text-xs text-ink-6 mt-0.5">{item.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="text-ink-4 hover:text-ink-8 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    // Fallback silently so components never crash when the provider is
    // missing (e.g. in isolated test harnesses).
    return {
      push: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}
