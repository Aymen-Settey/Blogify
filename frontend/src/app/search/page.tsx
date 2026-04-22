"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, Users, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { PostCard } from "@/components/PostCard";
import type { PostListResponse } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";

type Tab = "posts" | "people";

type MiniUser = {
  id: string;
  username: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  affiliations?: string | null;
};

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const initialTab = (searchParams.get("tab") as Tab) || "posts";

  const [input, setInput] = useState(initialQ);
  const [query, setQuery] = useState(initialQ);
  const [tab, setTab] = useState<Tab>(initialTab);

  const [postsData, setPostsData] = useState<PostListResponse | null>(null);
  const [peopleData, setPeopleData] = useState<MiniUser[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce input -> query, sync URL
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(input.trim());
      const params = new URLSearchParams();
      if (input.trim()) params.set("q", input.trim());
      if (tab !== "posts") params.set("tab", tab);
      router.replace(`/search${params.toString() ? `?${params}` : ""}`, {
        scroll: false,
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, tab]);

  // Fetch results when query or tab changes
  useEffect(() => {
    if (!query) {
      setPostsData(null);
      setPeopleData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchFn =
      tab === "posts"
        ? apiFetch<PostListResponse>(
            `/api/posts/search/semantic?q=${encodeURIComponent(query)}&limit=20`,
          )
            .catch(() =>
              apiFetch<PostListResponse>(
                `/api/posts?search=${encodeURIComponent(query)}&page_size=20`,
              ),
            )
            .then((d) => !cancelled && setPostsData(d))
        : apiFetch<MiniUser[]>(
            `/api/users/search?q=${encodeURIComponent(query)}&page_size=20`,
          ).then((d) => !cancelled && setPeopleData(d));

    fetchFn
      .catch(
        (e: { detail?: string }) =>
          !cancelled && setError(e?.detail || "Search failed"),
      )
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [query, tab]);

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
      <p className="kicker mb-3">Everything in print</p>
      <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-tight text-ink-9 mb-6">
        Search
      </h1>

      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-4" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search posts, topics, or people…"
          autoFocus
          className="w-full rounded-xl border border-ink-2 bg-paper-0 pl-12 pr-4 py-4 text-base font-display placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand-400/60 focus:border-brand-500 transition-all"
        />
      </div>
      <div className="mt-2 text-sm text-ink-5">
        Looking for an image?{" "}
        <Link
          href="/search/images"
          className="text-brand-600 hover:text-brand-700 underline-offset-4 hover:underline"
        >
          Try image search
        </Link>
      </div>

      <div className="flex gap-1 border-b border-ink-2 mt-8 mb-8">
        <TabButton
          active={tab === "posts"}
          onClick={() => setTab("posts")}
          icon={<FileText className="h-4 w-4" />}
          label="Posts"
          count={postsData?.total}
        />
        <TabButton
          active={tab === "people"}
          onClick={() => setTab("people")}
          icon={<Users className="h-4 w-4" />}
          label="People"
          count={peopleData?.length}
        />
      </div>

      {!query && (
        <div className="rounded-2xl border border-dashed border-ink-3 bg-paper-1 p-12 text-center">
          <SearchIcon className="mx-auto h-10 w-10 text-ink-4 mb-3" />
          <p className="font-display text-lg italic text-ink-8">
            Start typing to search
          </p>
          <p className="text-sm text-ink-5 mt-1">
            Try topics like &quot;NLP&quot;, &quot;transformers&quot;, or author names.
          </p>
        </div>
      )}

      {query && loading && <SkeletonList />}

      {query && error && (
        <div role="alert" aria-live="assertive" className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {query && !loading && !error && tab === "posts" && postsData && (
        <>
          {postsData.posts.length === 0 ? (
            <EmptyState message={`No posts found for "${query}".`} />
          ) : (
            <div className="grid gap-6">
              {postsData.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </>
      )}

      {query && !loading && !error && tab === "people" && peopleData && (
        <>
          {peopleData.length === 0 ? (
            <EmptyState message={`No people found for "${query}".`} />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {peopleData.map((u) => (
                <UserCard key={u.id} user={u} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-ink-9 text-ink-9"
          : "border-transparent text-ink-5 hover:text-ink-8",
      )}
    >
      {icon}
      {label}
      {typeof count === "number" && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs",
            active ? "bg-ink-9 text-paper-0" : "bg-paper-2 text-ink-5",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function UserCard({ user }: { user: MiniUser }) {
  return (
    <Link
      href={`/profile/${user.username}`}
      className="flex items-start gap-3 rounded-xl border border-ink-2 bg-paper-0 p-4 hover:border-ink-3 hover:shadow-sm transition-all"
    >
      <Avatar
        src={user.avatar_url ?? undefined}
        name={user.display_name}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-medium text-ink-9 truncate">
          {user.display_name}
        </p>
        <p className="text-sm text-ink-5 truncate">@{user.username}</p>
        {user.bio && (
          <p className="text-sm text-ink-6 mt-1 line-clamp-2">{user.bio}</p>
        )}
      </div>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-3 bg-paper-1 p-12 text-center">
      <p className="font-display italic text-ink-7">{message}</p>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="grid gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-ink-2 bg-paper-0 p-6 animate-pulse"
        >
          <div className="h-5 w-3/4 bg-paper-2 rounded mb-3" />
          <div className="h-4 w-full bg-paper-2 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SkeletonList />}>
      <SearchContent />
    </Suspense>
  );
}
