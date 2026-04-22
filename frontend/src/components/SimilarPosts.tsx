"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Post } from "@/lib/types";
import { Sparkles } from "lucide-react";

interface SimilarPostsProps {
  postId: string;
}

export function SimilarPosts({ postId }: SimilarPostsProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<Post[]>(
          `/api/recommendations/similar/${postId}?limit=4`
        );
        if (!cancelled) setPosts(data);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) return null;

  return (
    <section className="mt-14 border-t border-slate-100 pt-10">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-brand-600" />
        <h2 className="text-xl font-bold text-slate-900">Similar reads</h2>
      </div>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
        {posts.map((p) => (
          <li key={p.id}>
            <Link
              href={`/post/${p.slug}`}
              className="flex items-start gap-4 px-4 py-4 hover:bg-slate-50 transition"
            >
              {p.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.cover_image_url}
                  alt=""
                  className="h-16 w-24 rounded-md object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {p.field && (
                    <span className="rounded-full bg-brand-50 text-brand-700 border border-brand-100 px-2 py-0.5 font-medium">
                      {p.field}
                    </span>
                  )}
                  <span>{p.reading_time_minutes ?? 1} min</span>
                </div>
                <h3 className="mt-1 font-semibold text-slate-900 leading-snug line-clamp-2">
                  {p.title}
                </h3>
                {p.summary && (
                  <p className="mt-1 text-sm text-slate-600 line-clamp-2">{p.summary}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
