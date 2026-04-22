"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { UserProfile, User } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ArrowLeft } from "lucide-react";

export default function FollowingPage({
  params,
}: {
  params: { username: string };
}) {
  const { username } = params;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [following, setFollowing] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await apiFetch<UserProfile>(
          `/api/users/by-username/${username}`,
        );
        if (cancelled) return;
        setProfile(p);
        const list = await apiFetch<User[]>(`/api/users/${p.id}/following`);
        if (cancelled) return;
        setFollowing(list);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="h-8 w-48 bg-paper-2 rounded animate-pulse mb-6" />
        <div className="grid sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-paper-2 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="font-display text-2xl text-ink-9">User not found</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
      <Link
        href={`/profile/${username}`}
        className="inline-flex items-center gap-1 text-sm text-ink-5 hover:text-ink-9 mb-3 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {profile.display_name}
      </Link>
      <SectionHeader
        kicker={`@${profile.username}`}
        title="Following"
        description={`Following ${profile.following_count} ${
          profile.following_count === 1 ? "person" : "people"
        }`}
      />

      <div className="mt-10">
        {following.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-3 bg-paper-1 p-12 text-center">
            <p className="font-display italic text-ink-7">
              Not following anyone yet.
            </p>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {following.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/profile/${u.username}`}
                  className="flex items-start gap-3 rounded-xl border border-ink-2 bg-paper-0 p-4 hover:border-ink-3 hover:shadow-sm transition-all"
                >
                  <Avatar
                    src={u.avatar_url ?? undefined}
                    name={u.display_name || u.username}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-medium text-ink-9 truncate">
                      {u.display_name || u.username}
                    </p>
                    <p className="text-sm text-ink-5 truncate">@{u.username}</p>
                    {u.bio && (
                      <p className="text-sm text-ink-6 mt-1 line-clamp-2">
                        {u.bio}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
