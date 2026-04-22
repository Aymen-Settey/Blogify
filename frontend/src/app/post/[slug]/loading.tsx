/**
 * Route-level loading UI for /post/[slug].
 *
 * Next.js renders this Suspense boundary INSTANTLY when a user clicks a post
 * card link, before the page's client bundle runs or the post data is fetched.
 * The skeleton mirrors the real post detail layout so the transition feels
 * continuous rather than jarring.
 */
export default function PostDetailLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="animate-pulse space-y-6">
        {/* Field badge */}
        <div className="h-5 w-20 rounded-full bg-slate-200" />

        {/* Title: two lines */}
        <div className="space-y-3">
          <div className="h-10 md:h-12 w-11/12 rounded-lg bg-slate-200" />
          <div className="h-10 md:h-12 w-3/5 rounded-lg bg-slate-200" />
        </div>

        {/* Summary */}
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="h-4 w-4/5 rounded bg-slate-100" />
        </div>

        {/* Author row */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
          <div className="h-10 w-10 rounded-full bg-slate-200" />
          <div className="space-y-2">
            <div className="h-3.5 w-32 rounded bg-slate-200" />
            <div className="h-3 w-24 rounded bg-slate-100" />
          </div>
        </div>

        {/* Cover image placeholder */}
        <div className="h-72 md:h-96 w-full rounded-2xl bg-slate-100" />

        {/* Body paragraphs */}
        <div className="space-y-3 pt-4">
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="h-4 w-11/12 rounded bg-slate-100" />
          <div className="h-4 w-10/12 rounded bg-slate-100" />
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="h-4 w-9/12 rounded bg-slate-100" />
        </div>

        <div className="space-y-3 pt-2">
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="h-4 w-11/12 rounded bg-slate-100" />
          <div className="h-4 w-8/12 rounded bg-slate-100" />
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
          <div className="h-9 w-20 rounded-full bg-slate-200" />
          <div className="h-9 w-20 rounded-full bg-slate-100" />
          <div className="h-9 w-24 rounded-full bg-slate-100" />
          <div className="h-9 w-9 rounded-full bg-slate-100 ml-auto" />
        </div>
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        Loading post…
      </span>
    </main>
  );
}
