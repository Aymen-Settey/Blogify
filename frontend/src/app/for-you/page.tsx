"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PostCard } from "@/components/PostCard";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Post } from "@/lib/types";
import { RefreshCw } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

export default function ForYouPage() {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await apiFetch<Post[]>("/api/recommendations/for-you?limit=24");
      setPosts(data);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reindex = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await apiFetch("/api/recommendations/reindex/me", { method: "POST" });
      // Give the worker a beat, then reload
      setTimeout(load, 1200);
    } catch {
      // silent
    } finally {
      setTimeout(() => setRefreshing(false), 1200);
    }
  };

  if (authLoading) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14">
      <SectionHeader
        kicker="Personalized · AI curator"
        title="For you"
        description={
          user
            ? "Research picked to match your reading history and taste. The aurora mark on a card means our recommender surfaced it — hover for why."
            : "A warm-up edit of what's moving across the platform. Sign in to personalize."
        }
        size="lg"
        action={
          user ? (
            <Button
              onClick={reindex}
              loading={refreshing}
              variant="secondary"
              size="sm"
              leadingIcon={
                <RefreshCw
                  className={cn("h-4 w-4", refreshing && "animate-spin")}
                />
              }
            >
              Refresh
            </Button>
          ) : undefined
        }
      />

      <div className="mt-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-3 p-12 text-center bg-paper-1">
            <p className="font-display text-lg italic text-ink-7">
              Nothing to recommend yet — read a few posts and check back.
            </p>
            <Link
              href="/feed"
              className="mt-3 inline-block text-sm text-brand-600 font-medium hover:text-brand-700"
            >
              Browse all posts →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
