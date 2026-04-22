"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { PostListResponse } from "@/lib/types";
import { PostCard } from "@/components/PostCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";

function FeedContent() {
  const searchParams = useSearchParams();
  const field = searchParams.get("field") || "";

  const [data, setData] = useState<PostListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: "1", page_size: "20" });
    if (field) params.set("field", field);
    apiFetch<PostListResponse>(`/api/posts?${params.toString()}`)
      .then((d) => !cancelled && setData(d))
      .catch(
        (e: { detail?: string }) =>
          !cancelled && setError(e?.detail || "Failed to load feed"),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [field]);

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
      <SectionHeader
        kicker={field ? "Field" : "The front page"}
        title={field ? field : "Your feed"}
        description={
          field
            ? `Latest research and essays tagged ${field}.`
            : "Fresh work from across every field we publish."
        }
        size="lg"
      />

      {field && (
        <Link
          href="/feed"
          className="mt-4 inline-flex items-center gap-1 rounded-full border border-ink-2 bg-paper-0 hover:bg-paper-2 px-3 py-1 text-xs font-medium text-ink-7"
        >
          <X className="h-3 w-3" />
          Clear filter
        </Link>
      )}

      <div className="mt-10">
        {loading && <SkeletonFeed />}

        {error && (
          <div role="alert" aria-live="assertive" className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {data && data.posts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-3 p-12 text-center bg-paper-1">
            <p className="font-display text-lg italic text-ink-7">
              {field
                ? `No posts in ${field} yet.`
                : "The press is quiet. Be the first to publish."}
            </p>
          </div>
        )}

        {data && data.posts.length > 0 && (
          <div className="grid gap-6">
            {data.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<SkeletonFeed />}>
      <FeedContent />
    </Suspense>
  );
}

function SkeletonFeed() {
  return (
    <div className="grid gap-6">
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} index={i} />
      ))}
    </div>
  );
}
