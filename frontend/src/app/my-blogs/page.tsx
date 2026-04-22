"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Post, PostListResponse } from "@/lib/types";
import { PostCard } from "@/components/PostCard";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";

type StatusFilter = "all" | "published" | "draft";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
];

export default function MyBlogsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);

  const fetchPosts = useCallback(
    async (filter: StatusFilter) => {
      setLoading(true);
      setError(null);
      try {
        const qs = filter === "all" ? "" : `&status=${filter}`;
        const data = await apiFetch<PostListResponse>(
          `/api/posts/mine?page=1&page_size=50${qs}`
        );
        setPosts(data.posts);
        setTotal(data.total);
      } catch (e: unknown) {
        const err = e as { detail?: string } | undefined;
        setError(err?.detail || "Failed to load your blogs");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth/login?next=/my-blogs");
      return;
    }
    fetchPosts(statusFilter);
  }, [authLoading, user, router, statusFilter, fetchPosts]);

  const handleDelete = async (post: Post) => {
    setDeletingId(post.id);
    try {
      await apiFetch(`/api/posts/${post.id}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setTotal((prev) => prev - 1);
    } catch (e: unknown) {
      const err = e as { detail?: string } | undefined;
      setError(err?.detail || "Failed to delete post");
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
      <SectionHeader
        kicker="Your writing"
        title="My blogs"
        description="Everything you've written — drafts, published, all in one place."
        size="lg"
      />

      {/* Status filter tabs */}
      <div className="mt-8 flex gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? "bg-ink-9 text-paper-0 dark:bg-paper-0 dark:text-ink-9"
                : "bg-paper-2 text-ink-6 hover:bg-paper-3 hover:text-ink-8"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading && (
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-3 bg-paper-1 p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-ink-4 mb-3" />
            <p className="font-display text-lg italic text-ink-8">
              {statusFilter === "draft"
                ? "No drafts yet"
                : statusFilter === "published"
                  ? "Nothing published yet"
                  : "You haven't written anything yet"}
            </p>
            <p className="text-sm text-ink-5 mt-1">
              Start writing your first blog post to see it here.
            </p>
          </div>
        )}

        {!loading && posts.length > 0 && (
          <div className="grid gap-6">
            {posts.map((post) => (
              <div key={post.id} className="relative group">
                <PostCard post={post} />

                {/* Status badge + Delete button */}
                <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {post.status === "draft" && (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 text-xs font-medium">
                      Draft
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteTarget(post);
                    }}
                    disabled={deletingId === post.id}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-paper-0/80 dark:bg-paper-2/80 backdrop-blur text-ink-5 hover:text-danger hover:bg-danger/10 transition-colors shadow-sm border border-ink-2/50 disabled:opacity-50"
                    title="Delete post"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && total > 0 && (
          <p className="mt-6 text-center text-xs text-ink-5">
            Showing {posts.length} of {total} post{total !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget!)}
        title={deleteTarget?.title ?? ""}
      />
    </main>
  );
}
