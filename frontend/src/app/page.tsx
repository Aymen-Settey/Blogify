import Link from "next/link";
import {
  Sparkles,
  Brain,
  Users,
  TrendingUp,
  ArrowRight,
  Quote,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

export default function Home() {
  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-ink-2">
        {/* Subtle aurora wash (decorative only, never the headline color) */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.18] dark:opacity-25 bg-aurora-mesh"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-paper-grain mix-blend-soft-light opacity-40 pointer-events-none"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-28 sm:pt-32 sm:pb-36">
          <div className="max-w-3xl">
            <p className="kicker flex items-center gap-2 mb-6">
              <span className="aurora-text inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Issue №01
              </span>
              <span className="text-ink-4">/</span>
              <span>An AI-augmented publication</span>
            </p>

            <h1 className="font-display text-display-lg sm:text-display-xl font-medium tracking-tight text-ink-9 leading-[1.02]">
              Where research meets{" "}
              <em className="italic aurora-text">the world.</em>
            </h1>

            <p className="mt-8 text-xl sm:text-2xl text-ink-7 leading-relaxed max-w-2xl font-display font-normal">
              A home for long-form thinking — and a quiet AI companion that
              learns your taste, surfaces work that actually matters, and never
              sells your attention.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <ButtonLink
                href="/auth/register"
                size="lg"
                variant="primary"
                trailingIcon={<ArrowRight className="h-4 w-4" />}
              >
                Start writing
              </ButtonLink>
              <ButtonLink href="/explore" size="lg" variant="secondary">
                Browse research
              </ButtonLink>
              <span className="text-xs text-ink-5 sm:ml-2">
                Free forever for readers. No algorithmic dark patterns.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pull-quote / editorial proof ─────────────────── */}
      <section className="bg-paper-1 border-b border-ink-2">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20">
          <figure className="relative">
            <Quote
              aria-hidden
              className="absolute -left-2 -top-2 h-10 w-10 text-ink-3"
              strokeWidth={1}
            />
            <blockquote className="font-display italic text-3xl sm:text-4xl leading-snug text-ink-9 pl-10">
              “The web lost the art of the long read. Blogify is the first
              publication I’ve seen that treats research prose like a
              first-class citizen — and the AI recommendations feel like a
              curator, not an algorithm.”
            </blockquote>
            <figcaption className="mt-6 pl-10 kicker">
              Dr. Mira Okafor · Computational Biology
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24">
        <div className="mb-14 max-w-2xl">
          <p className="kicker mb-3">The publication</p>
          <h2 className="font-display text-display-md font-medium tracking-tight text-ink-9">
            Built for people who read{" "}
            <em className="italic text-ink-7">past the headline.</em>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink-2 border border-ink-2 rounded-2xl overflow-hidden">
          <FeatureCell
            icon={<Brain className="h-5 w-5" />}
            kicker="Discovery"
            title="Recommendations with receipts"
            description="Every AI-suggested post tells you why. Hover the aurora chip for the signals that ranked it."
          />
          <FeatureCell
            icon={<Users className="h-5 w-5" />}
            kicker="Craft"
            title="Prose, math, code, data"
            description="A calm editor with LaTeX, syntax highlighting, PDFs and figures — the full research toolkit."
          />
          <FeatureCell
            icon={<TrendingUp className="h-5 w-5" />}
            kicker="Audience"
            title="Readers, not metrics"
            description="Follow experts, repost with commentary, bookmark for later. No engagement bait, ever."
          />
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-y border-ink-2 bg-paper-1">
        <div
          aria-hidden
          className="absolute inset-0 bg-aurora-mesh opacity-[0.12]"
        />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="kicker mb-5">Issue №02 is open for submissions</p>
          <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight text-ink-9 leading-tight">
            Your best writing deserves{" "}
            <em className="italic aurora-text">a quieter home.</em>
          </h2>
          <div className="mt-8 flex items-center justify-center gap-3">
            <ButtonLink href="/auth/register" size="lg" variant="aurora">
              Create your account
            </ButtonLink>
            <Link
              href="/feed"
              className="text-sm text-ink-7 hover:text-ink-9 underline-offset-4 hover:underline"
            >
              Or keep browsing →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCell({
  icon,
  kicker,
  title,
  description,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group bg-paper-0 p-8 transition-colors hover:bg-paper-1">
      <div className="flex items-center gap-2.5 mb-6">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-paper-2 text-ink-8 group-hover:bg-aurora-gradient group-hover:text-paper-0 transition-colors">
          {icon}
        </span>
        <span className="kicker">{kicker}</span>
      </div>
      <h3 className="font-display text-xl font-medium text-ink-9 leading-snug">
        {title}
      </h3>
      <p className="mt-3 text-sm text-ink-6 leading-relaxed">{description}</p>
    </div>
  );
}