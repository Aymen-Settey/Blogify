"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Compass,
  TrendingUp,
  BookOpen,
  ArrowRight,
  Cpu,
  Dna,
  Atom,
  FlaskConical,
  Sigma,
  Stethoscope,
  Brain,
  LineChart,
  Wrench,
  Users,
  MoreHorizontal,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { PostListResponse, Post } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/cn";

type FieldCard = {
  name: string;
  slug: string;
  icon: React.ElementType;
  description: string;
};

const FIELDS: FieldCard[] = [
  { name: "Computer Science", slug: "Computer Science", icon: Cpu, description: "AI, ML, systems, theory" },
  { name: "Biology", slug: "Biology", icon: Dna, description: "Genetics, ecology, biotech" },
  { name: "Physics", slug: "Physics", icon: Atom, description: "Quantum, cosmology, matter" },
  { name: "Chemistry", slug: "Chemistry", icon: FlaskConical, description: "Organic, materials, catalysis" },
  { name: "Mathematics", slug: "Mathematics", icon: Sigma, description: "Pure, applied, theory" },
  { name: "Medicine", slug: "Medicine", icon: Stethoscope, description: "Clinical, public health" },
  { name: "Psychology", slug: "Psychology", icon: Brain, description: "Cognition, behavior, neuro" },
  { name: "Economics", slug: "Economics", icon: LineChart, description: "Markets, policy, finance" },
  { name: "Engineering", slug: "Engineering", icon: Wrench, description: "Mechanical, civil, electrical" },
  { name: "Social Sciences", slug: "Social Sciences", icon: Users, description: "Sociology, anthropology" },
  { name: "Other", slug: "Other", icon: MoreHorizontal, description: "Everything else" },
];

export default function ExplorePage() {
  const [trending, setTrending] = useState<Post[] | null>(null);
  const [latest, setLatest] = useState<Post[] | null>(null);

  useEffect(() => {
    apiFetch<PostListResponse>("/api/posts/trending?window_days=7&page_size=5")
      .then((d) => setTrending(d.posts))
      .catch(() => setTrending([]));
    apiFetch<PostListResponse>("/api/posts?page_size=6")
      .then((d) => setLatest(d.posts))
      .catch(() => setLatest([]));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14">
      <SectionHeader
        kicker="The atlas"
        title="Explore"
        description="Discover research across every field, meet the minds behind it, and follow what's trending this week."
        size="lg"
      />

      {/* Fields grid */}
      <section className="mt-14">
        <div className="flex items-end justify-between mb-5">
          <h2 className="font-display text-2xl font-medium text-ink-9">
            Browse by field
          </h2>
          <Compass className="h-5 w-5 text-ink-4" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-ink-2 border border-ink-2 rounded-2xl overflow-hidden">
          {FIELDS.map((f) => {
            const Icon = f.icon;
            return (
              <Link
                key={f.slug}
                href={`/feed?field=${encodeURIComponent(f.slug)}`}
                className="group relative bg-paper-0 p-5 hover:bg-paper-1 transition-colors"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 text-ink-8 mb-3 group-hover:bg-aurora-gradient group-hover:text-paper-0 transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-medium text-ink-9 mb-0.5">
                  {f.name}
                </h3>
                <p className="text-xs text-ink-5 line-clamp-1">
                  {f.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Trending this week */}
      <section className="mt-16">
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="kicker mb-1">This week</p>
            <h2 className="font-display text-2xl font-medium text-ink-9">
              Most discussed
            </h2>
          </div>
          <Link
            href="/trending"
            className="inline-flex items-center gap-1 text-sm font-medium text-ink-7 hover:text-ink-9"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {!trending && <TrendingSkeleton />}

        {trending && trending.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-3 bg-paper-1 p-8 text-center text-sm text-ink-5">
            No trending posts in the last week.
          </div>
        )}

        {trending && trending.length > 0 && (
          <ol className="space-y-2">
            {trending.map((post, idx) => (
              <li key={post.id}>
                <Link
                  href={`/post/${post.slug}`}
                  className="group flex items-center gap-4 rounded-xl border border-ink-2 bg-paper-0 p-4 hover:border-ink-3 hover:shadow-sm transition-all"
                >
                  <div
                    className={cn(
                      "shrink-0 h-9 w-9 rounded-lg flex items-center justify-center font-display text-lg font-medium",
                      idx < 3
                        ? "bg-aurora-gradient text-paper-0"
                        : "bg-paper-2 text-ink-6",
                    )}
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-medium text-ink-9 truncate group-hover:text-brand-700 transition-colors">
                      {post.title}
                    </p>
                    <p className="text-xs text-ink-5 truncate">
                      {post.author?.display_name || post.author?.username}
                      {post.field ? ` · ${post.field}` : ""}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 text-xs text-ink-5">
                    <span>{post.view_count} views</span>
                    <span>{post.like_count} likes</span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Latest posts */}
      <section className="mt-16">
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="kicker mb-1">Fresh ink</p>
            <h2 className="font-display text-2xl font-medium text-ink-9 inline-flex items-center gap-2">
              Latest posts
              <BookOpen className="h-5 w-5 text-ink-4" />
            </h2>
          </div>
          <Link
            href="/feed"
            className="inline-flex items-center gap-1 text-sm font-medium text-ink-7 hover:text-ink-9"
          >
            Full feed <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {!latest && <GridSkeleton />}

        {latest && latest.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-3 bg-paper-1 p-8 text-center text-sm text-ink-5">
            No posts yet.
          </div>
        )}

        {latest && latest.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {latest.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.slug}`}
                className="group rounded-2xl border border-ink-2 bg-paper-0 p-5 hover:border-ink-3 hover:shadow-editorial hover:-translate-y-0.5 transition-all"
              >
                {post.field && <p className="kicker mb-3">{post.field}</p>}
                <h3 className="font-display text-lg font-medium text-ink-9 leading-snug line-clamp-2 mb-2 group-hover:text-brand-700 transition-colors">
                  {post.title}
                </h3>
                {post.summary && (
                  <p className="text-sm text-ink-6 line-clamp-2 mb-4 leading-relaxed">
                    {post.summary}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-ink-5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {post.view_count} views · {post.like_count} likes
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function TrendingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-16 rounded-xl border border-ink-2 bg-paper-0 animate-pulse"
        />
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="h-40 rounded-2xl border border-ink-2 bg-paper-0 animate-pulse"
        />
      ))}
    </div>
  );
}
