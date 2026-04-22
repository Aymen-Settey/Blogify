"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PostCard } from "@/components/PostCard";
import type { Post, UserProfile } from "@/lib/types";
import { UserPlus, UserCheck, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function ProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const { username } = params;
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, list] = await Promise.all([
          apiFetch<UserProfile>(`/api/users/by-username/${username}`),
          apiFetch<Post[]>(`/api/users/by-username/${username}/posts`),
        ]);
        if (cancelled) return;
        setProfile(p);
        setPosts(list);
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

  const toggleFollow = async () => {
    if (!user || !profile) return;
    setFollowBusy(true);
    try {
      const res = await apiFetch<{ following: boolean }>(
        `/api/users/${profile.id}/follow`,
        { method: "POST" },
      );
      setProfile({
        ...profile,
        is_following: res.following,
        follower_count: profile.follower_count + (res.following ? 1 : -1),
      });
    } catch {
      // silent
    } finally {
      setFollowBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-paper-2 rounded-2xl" />
          <div className="h-6 bg-paper-2 rounded w-1/3" />
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-24 text-center">
        <p className="kicker mb-3">404</p>
        <h1 className="font-display text-3xl font-medium text-ink-9">
          User not found
        </h1>
        <Link
          href="/feed"
          className="mt-4 inline-block text-brand-600 font-medium hover:text-brand-700 underline-offset-4 hover:underline"
        >
          ← Back to feed
        </Link>
      </main>
    );
  }

  const isMe = user?.id === profile.id;
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
      {/* Editorial masthead */}
      <header className="relative overflow-hidden rounded-3xl border border-ink-2 bg-paper-0 p-8 md:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-aurora-mesh opacity-40"
        />
        <div className="relative flex flex-col sm:flex-row items-start gap-6">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="h-24 w-24 rounded-full object-cover ring-4 ring-paper-0 shadow-editorial"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-aurora-gradient flex items-center justify-center text-paper-0 font-display text-3xl font-medium ring-4 ring-paper-0 shadow-editorial">
              {profile.username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <p className="kicker mb-1.5">Contributor</p>
                <h1 className="font-display text-3xl sm:text-4xl font-medium text-ink-9 tracking-tight">
                  {profile.display_name}
                </h1>
                <p className="text-sm text-ink-5 mt-1">@{profile.username}</p>
              </div>
              {isMe ? (
                <Link
                  href="/settings"
                  className="shrink-0 rounded-full border border-ink-2 bg-paper-0 px-4 py-1.5 text-sm font-medium text-ink-7 hover:bg-paper-2 hover:text-ink-9 transition-colors"
                >
                  Edit profile
                </Link>
              ) : user ? (
                <Button
                  onClick={toggleFollow}
                  disabled={followBusy}
                  loading={followBusy}
                  variant={profile.is_following ? "secondary" : "primary"}
                  size="sm"
                  leadingIcon={
                    profile.is_following ? (
                      <UserCheck className="h-4 w-4" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )
                  }
                >
                  {profile.is_following ? "Following" : "Follow"}
                </Button>
              ) : null}
            </div>

            {profile.bio && (
              <p className="mt-4 text-ink-7 whitespace-pre-wrap leading-relaxed">
                {profile.bio}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-ink-5">
              {profile.affiliations && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {profile.affiliations}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Joined {joined}
              </span>
            </div>

            {profile.research_interests &&
              profile.research_interests.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.research_interests.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-paper-2 text-ink-7 border border-ink-2 px-2.5 py-0.5 text-xs font-medium"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

            <div className="mt-6 flex gap-8 text-sm border-t border-ink-2 pt-4">
              <span>
                <span className="font-display text-lg font-medium text-ink-9">
                  {profile.post_count}
                </span>{" "}
                <span className="text-ink-5">posts</span>
              </span>
              <Link
                href={`/profile/${profile.username}/followers`}
                className="hover:opacity-70 transition-opacity"
              >
                <span className="font-display text-lg font-medium text-ink-9">
                  {profile.follower_count}
                </span>{" "}
                <span className="text-ink-5">followers</span>
              </Link>
              <Link
                href={`/profile/${profile.username}/following`}
                className="hover:opacity-70 transition-opacity"
              >
                <span className="font-display text-lg font-medium text-ink-9">
                  {profile.following_count}
                </span>{" "}
                <span className="text-ink-5">following</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Posts */}
      <section className="mt-14">
        <SectionHeader kicker="Published" title="Posts" size="md" />
        <div className="mt-8">
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-3 bg-paper-1 p-12 text-center">
              <p className="font-display italic text-ink-7">No posts yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}