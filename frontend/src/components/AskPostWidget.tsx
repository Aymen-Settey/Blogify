"use client";

import { useState } from "react";
import { MessageCircleQuestion, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Answer = { answer: string; grounded: boolean };

interface Props {
  postId: string;
}

export function AskPostWidget({ postId }: Props) {
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);

  if (!user) return null;

  const ask = async () => {
    const q = question.trim();
    if (q.length < 3) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await apiFetch<Answer>(`/api/ai/ask/${postId}`, {
        method: "POST",
        body: JSON.stringify({ question: q }),
      });
      setAnswer(res);
    } catch (err) {
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail: string }).detail)
          : "Assistant unavailable";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-10 border-t border-slate-100 pt-8">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircleQuestion className="h-4 w-4 text-brand-600" />
        <h2 className="text-lg font-bold text-slate-900">Ask this post</h2>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Answers are grounded only in this article. If it doesn&apos;t cover
        your question, the assistant will say so.
      </p>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) ask();
          }}
          placeholder="What is the main claim of this post?"
          className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm outline-none focus:border-brand-500"
          maxLength={500}
        />
        <button
          type="button"
          onClick={ask}
          disabled={loading || question.trim().length < 3}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {answer && (
        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {answer.answer}
          </p>
          {!answer.grounded && (
            <p className="mt-2 text-xs text-slate-500 italic">
              (The article does not directly cover this.)
            </p>
          )}
        </div>
      )}
    </section>
  );
}
