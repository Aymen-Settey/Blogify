"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Eye, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { PostListResponse, Post } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/cn";

const FIELDS = [
  { label: "All", value: "" },
  { label: "CS", value: "Computer Science" },
  { label: "Biology", value: "Biology" },
  { label: "Physics", value: "Physics" },
  { label: "Chemistry", value: "Chemistry" },
  { label: "Math", value: "Mathematics" },
  { label: "Medicine", value: "Medicine" },
  { label: "Psychology", value: "Psychology" },
  { label: "Economics", value: "Economics" },
  { label: "Engineering", value: "Engineering" },
];

const WINDOWS = [
  { label: "Today", value: 1 },
  { label: "Week", value: 7 },
  { label: "Month", value: 30 },
];

export default function TrendingPage() {
  const [data, setData] = useState<PostListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string>("");
  const [windowDays, setWindowDays] = useState<number>(7);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      window_days: String(windowDays),
      page_size: "25",
    });
    if (field) params.set("field", field);

    apiFetch<PostListResponse>(`/api/posts/trending?${params.toString()}`)
      .then((d) => !cancelled && setData(d))
      .catch(
        (e: { detail?: string }) =>
          !cancelled && setError(e?.detail || "Failed to load trending posts"),
      )
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [field, windowDays]);

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
      <SectionHeader
        kicker="The leaderboard"
        title="Trending"
        description="The most engaging research being discussed across Blogify right now. Ranked, not recommended — no personalization."
        size="lg"
      />

      {/* Time window tabs — segmented */}
      <div
        role="radiogroup"
        aria-label="Time window"
        className="mt-8 inline-flex rounded-full border border-ink-2 bg-paper-1 p-1"
      >
        {WINDOWS.map((w) => (
          <button
            key={w.value}
            role="radio"
            aria-checked={windowDays === w.value}
            onClick={() => setWindowDays(w.value)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              windowDays === w.value
                ? "bg-ink-9 text-paper-0 shadow-sm"
                : "text-ink-6 hover:text-ink-9",
            )}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* Field filter chips */}
      <div className="flex gap-1.5 mt-4 mb-10 flex-wrap">
        {FIELDS.map((f) => (
          <button
            key={f.value || "all"}
            onClick={() => setField(f.value)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors",
              field === f.value
                ? "bg-brand-600 text-white border border-brand-600"
                : "bg-paper-0 border border-ink-2 text-ink-6 hover:border-ink-3 hover:text-ink-9",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <SkeletonList />}

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {data && data.posts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-ink-3 p-12 text-center bg-paper-1">
          <TrendingUp className="mx-auto h-10 w-10 text-ink-4 mb-3" />
          <p className="font-display text-lg italic text-ink-8">
            No trending posts yet
          </p>
          <p className="text-sm text-ink-5 mt-1">
            Try a longer time window or a different field.
          </p>
        </div>
      )}

      {data && data.posts.length > 0 && (
        <ol className="space-y-3">
          {data.posts.map((post, idx) => (
            <TrendingRow key={post.id} post={post} rank={idx + 1} />
          ))}
        </ol>
      )}
    </main>
  );
}

function TrendingRow({ post, rank }: { post: Post; rank: number }) {
  const date = post.published_at || post.created_at;
  const isTopThree = rank <= 3;
  return (
    <li>
      <Link
        href={`/post/${post.slug}`}
        className="group flex items-start gap-5 rounded-2xl border border-ink-2 bg-paper-0 p-5 hover:border-ink-3 hover:shadow-editorial transition-all"
      >
        <div
          className={cn(
            "shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-display text-xl font-medium",
            isTopThree
              ? "bg-aurora-gradient text-paper-0 shadow-glow-aurora"
              : "bg-paper-2 text-ink-6",
          )}
        >
          {rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {post.field && <span className="kicker">{post.field}</span>}
            {post.field && (
              <span className="h-1 w-1 rounded-full bg-ink-3" aria-hidden />
            )}
            <span className="text-xs text-ink-5">
              {new Date(date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
            {post.author && (
              <>
                <span className="h-1 w-1 rounded-full bg-ink-3" aria-hidden />
                <span className="text-xs text-ink-5">
                  by {post.author.display_name || post.author.username}
                </span>
              </>
            )}
          </div>
          <h2 className="font-display text-lg sm:text-xl font-medium leading-snug text-ink-9 group-hover:text-brand-700 transition-colors line-clamp-2 mb-1.5">
            {post.title}
          </h2>
          {post.summary && (
            <p className="text-sm text-ink-6 line-clamp-2 mb-3 leading-relaxed">
              {post.summary}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-ink-5">
            <Stat icon={<Eye className="h-3.5 w-3.5" />} count={post.view_count} />
            <Stat icon={<Heart className="h-3.5 w-3.5" />} count={post.like_count} />
            <Stat
              icon={<MessageCircle className="h-3.5 w-3.5" />}
              count={post.comment_count}
            />
            <Stat
              icon={<Repeat2 className="h-3.5 w-3.5" />}
              count={post.repost_count}
            />
          </div>
        </div>
      </Link>
    </li>
  );
}

function Stat({ icon, count }: { icon: React.ReactNode; count: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      {count}
    </span>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex gap-5 rounded-2xl border border-ink-2 bg-paper-0 p-5 animate-pulse"
        >
          <div className="h-12 w-12 rounded-xl bg-paper-2 shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-3 w-24 bg-paper-2 rounded" />
            <div className="h-5 w-3/4 bg-paper-2 rounded" />
            <div className="h-4 w-full bg-paper-2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
