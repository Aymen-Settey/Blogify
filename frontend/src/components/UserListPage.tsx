"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, UserCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User, UserProfile } from "@/lib/types";

type Variant = "followers" | "following";

export function UserListPage({
  username,
  variant,
}: {
  username: string;
  variant: Variant;
}) {
  const { user: viewer } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Track which users the viewer is following (client-side)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await apiFetch<UserProfile>(
          `/api/users/by-username/${username}`
        );
        if (cancelled) return;
        setProfile(p);
        const list = await apiFetch<User[]>(
          `/api/users/${p.id}/${variant}?page_size=100`
        );
        if (cancelled) return;
        setUsers(list);
      } catch (e) {
        if (!cancelled)
          setError((e as { detail?: string })?.detail || "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username, variant]);

  const toggleFollow = async (userId: string) => {
    if (!viewer) {
      router.push("/auth/login");
      return;
    }
    if (busyId) return;
    setBusyId(userId);
    const wasFollowing = followingIds.has(userId);
    const next = new Set(followingIds);
    if (wasFollowing) next.delete(userId);
    else next.add(userId);
    setFollowingIds(next);
    try {
      await apiFetch<{ following: boolean }>(`/api/users/${userId}/follow`, {
        method: "POST",
      });
    } catch {
      const rollback = new Set(followingIds);
      if (wasFollowing) rollback.add(userId);
      else rollback.delete(userId);
      setFollowingIds(rollback);
    } finally {
      setBusyId(null);
    }
  };

  const title = variant === "followers" ? "Followers" : "Following";

  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <Link
          href={`/profile/${username}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          {title}
        </h1>
        {profile && (
          <p className="text-slate-600 mt-1">
            {variant === "followers"
              ? `People following @${profile.username}`
              : `People @${profile.username} follows`}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!users && !error && <SkeletonList />}

      {users && users.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-600">
            {variant === "followers"
              ? "No followers yet."
              : "Not following anyone yet."}
          </p>
        </div>
      )}

      {users && users.length > 0 && (
        <ul className="grid gap-3">
          {users.map((u) => {
            const isViewer = viewer?.id === u.id;
            const isFollowing = followingIds.has(u.id);
            return (
              <li key={u.id}>
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <Link
                    href={`/profile/${u.username}`}
                    className="h-12 w-12 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-slate-500 font-semibold"
                  >
                    {u.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.avatar_url}
                        alt={u.display_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      u.display_name.charAt(0).toUpperCase()
                    )}
                  </Link>
                  <Link
                    href={`/profile/${u.username}`}
                    className="min-w-0 flex-1 hover:opacity-80"
                  >
                    <p className="font-semibold text-slate-900 truncate">
                      {u.display_name}
                    </p>
                    <p className="text-sm text-slate-500 truncate">
                      @{u.username}
                    </p>
                    {u.bio && (
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                        {u.bio}
                      </p>
                    )}
                  </Link>
                  {!isViewer && viewer && (
                    <button
                      onClick={() => toggleFollow(u.id)}
                      disabled={busyId === u.id}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                        isFollowing
                          ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          : "bg-brand-600 text-white hover:bg-brand-700"
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="h-4 w-4" />
                          Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          Follow
                        </>
                      )}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function SkeletonList() {
  return (
    <div className="grid gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-20 rounded-xl border border-slate-200 bg-white animate-pulse"
        />
      ))}
    </div>
  );
}
