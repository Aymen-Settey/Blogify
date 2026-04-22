"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { PostListResponse } from "@/lib/types";
import { PostCard } from "@/components/PostCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";

export default function BookmarksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<PostListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth/login?next=/bookmarks");
      return;
    }
    apiFetch<PostListResponse>("/api/bookmarks?page=1&page_size=50")
      .then((d) => setData(d))
      .catch((e) => setError(e?.detail || "Failed to load bookmarks"))
      .finally(() => setLoading(false));
  }, [authLoading, user, router]);

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
      <SectionHeader
        kicker="Your library"
        title="Saved posts"
        description="A quiet shelf of things to return to — reading order is up to you."
        size="lg"
      />

      <div className="mt-10">
        {loading && (
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </div>
        )}

        {error && (
          <div role="alert" aria-live="assertive" className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {data && data.posts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-3 bg-paper-1 p-12 text-center">
            <Bookmark className="mx-auto h-10 w-10 text-ink-4 mb-3" />
            <p className="font-display text-lg italic text-ink-8">
              Your shelf is empty
            </p>
            <p className="text-sm text-ink-5 mt-1">
              Tap the bookmark icon on any post to save it for later.
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
