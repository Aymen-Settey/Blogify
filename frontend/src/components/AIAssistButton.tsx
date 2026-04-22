"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

type DraftResponse = {
  title: string | null;
  excerpt: string | null;
  tags: string[];
};

function extractText(node: unknown): string {
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (typeof node === "object") {
    const n = node as Record<string, unknown>;
    const ownText = typeof n.text === "string" ? (n.text as string) : "";
    const children = n.content ? extractText(n.content) : "";
    return `${ownText} ${children}`.trim();
  }
  return "";
}

interface Props {
  content: Record<string, unknown>;
  currentTitle: string;
  onApply: (patch: { title?: string; tags?: string[] }) => void;
}

export function AIAssistButton({ content, currentTitle, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResponse | null>(null);

  const run = async () => {
    const text = extractText(content).replace(/\s+/g, " ").trim();
    if (text.length < 50) {
      setError("Write at least a few sentences first, then try again.");
      setOpen(true);
      return;
    }
    setOpen(true);
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const res = await apiFetch<DraftResponse>("/api/ai/draft", {
        method: "POST",
        body: JSON.stringify({
          content: text.slice(0, 8000),
          current_title: currentTitle || null,
        }),
      });
      setDraft(res);
    } catch (err) {
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail: string }).detail)
          : "AI assistant unavailable";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={run}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 transition"
        title="Suggest title, excerpt and tags from your content"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        AI suggest
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-brand-600" />
              <h3 className="text-lg font-bold text-slate-900">AI suggestions</h3>
            </div>

            {loading && (
              <div className="py-10 text-center text-slate-500 text-sm">
                Generating…
              </div>
            )}

            {error && !loading && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {draft && !loading && (
              <div className="space-y-4">
                {draft.title && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1">
                      Title
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900">
                      {draft.title}
                    </div>
                    <button
                      type="button"
                      className="mt-1 text-xs text-brand-700 hover:underline"
                      onClick={() => onApply({ title: draft.title || undefined })}
                    >
                      Use this title
                    </button>
                  </div>
                )}
                {draft.excerpt && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1">
                      Excerpt
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      {draft.excerpt}
                    </div>
                  </div>
                )}
                {draft.tags.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1">
                      Tags
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {draft.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-brand-50 border border-brand-100 text-brand-700 px-2 py-0.5 text-xs"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="mt-1 text-xs text-brand-700 hover:underline"
                      onClick={() => onApply({ tags: draft.tags })}
                    >
                      Use these tags
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
