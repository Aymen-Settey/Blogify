"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

/**
 * Editorial split layout for auth. Left: quiet copy & wordmark.
 * Right: the form. Redirects authed users to /feed.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace("/feed");
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <div className="rounded-2xl bg-paper-0 border border-ink-2 p-8 text-center text-sm text-ink-5">
          Loading…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
      {/* Editorial side */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-ink-2 bg-paper-1 p-12">
        <div
          aria-hidden
          className="absolute inset-0 bg-aurora-mesh opacity-[0.15] pointer-events-none"
        />
        <Link
          href="/"
          className="relative inline-flex items-baseline gap-1"
          aria-label="Blogify home"
        >
          <span className="font-display text-3xl font-medium tracking-tight text-ink-9">
            Blogify
          </span>
          <span className="h-2 w-2 rounded-full bg-aurora-gradient" aria-hidden />
        </Link>

        <figure className="relative max-w-md">
          <blockquote className="font-display italic text-2xl leading-snug text-ink-9">
            “This is the only place online where I can publish a 4,000-word
            methods section and still feel like someone's going to read it.”
          </blockquote>
          <figcaption className="mt-5 kicker">
            — a Blogify contributor
          </figcaption>
        </figure>

        <p className="relative text-xs text-ink-5 max-w-sm leading-relaxed">
          Your reading never leaves the page. Recommendations run on-device.
          We don't sell attention.
        </p>
      </aside>

      {/* Form side */}
      <section className="flex items-center justify-center px-4 sm:px-6 lg:px-12 py-16">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
