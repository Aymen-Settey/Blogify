"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AdCampaign } from "@/lib/types";
import { ShieldCheck, Check, X, ExternalLink } from "lucide-react";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AdminAdsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await apiFetch<AdCampaign[]>("/api/ads/admin/pending");
      setPending(data);
    } catch (err) {
      setError((err as { detail?: string })?.detail ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    if (!user.is_admin) {
      router.push("/");
      return;
    }
    void load();
  }, [user, authLoading, router]);

  const moderate = async (id: string, action: "approve" | "reject") => {
    let reason: string | undefined;
    if (action === "reject") {
      const entered = window.prompt("Reason for rejection (shown to advertiser):");
      if (entered === null) return;
      reason = entered.trim() || "Does not meet content guidelines";
    }
    setActioning(id);
    setError(null);
    try {
      await apiFetch(`/api/ads/admin/campaigns/${id}/moderate`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      });
      setPending((list) => list.filter((c) => c.id !== id));
    } catch (err) {
      setError((err as { detail?: string })?.detail ?? "Action failed");
    } finally {
      setActioning(null);
    }
  };

  if (authLoading || !user) {
    return (
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-2 text-brand-600 mb-1">
        <ShieldCheck className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">Admin</span>
      </div>
      <h1 className="text-3xl font-bold text-slate-900">Ad review queue</h1>
      <p className="mt-1 text-sm text-slate-500 max-w-xl">
        Approve campaigns that meet content standards. Rejected campaigns receive the
        reason you provide.
      </p>

      {error ? (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-8 py-16 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">Inbox zero</h3>
          <p className="mt-1 text-sm text-slate-500">No campaigns are pending review.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {pending.map((c) => (
            <li key={c.id} className="rounded-2xl border border-slate-200 bg-paper-0 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{c.advertiser_name}</span>
                    <span>·</span>
                    <span>{c.name}</span>
                  </div>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{c.headline}</h3>
                  <p className="mt-1 text-sm text-slate-600">{c.body}</p>

                  <div className="mt-3 flex items-center gap-3 flex-wrap text-xs">
                    <a
                      href={c.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"
                    >
                      {c.link}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <span className="text-slate-400">CTA: “{c.cta_label}”</span>
                  </div>

                  <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px]">
                    {(c.target_fields ?? []).map((f) => (
                      <span
                        key={f}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700"
                      >
                        {f}
                      </span>
                    ))}
                    {(c.target_languages ?? []).map((l) => (
                      <span
                        key={l}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600"
                      >
                        {l}
                      </span>
                    ))}
                    {(c.target_keywords ?? []).slice(0, 6).map((k) => (
                      <span
                        key={k}
                        className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 ring-1 ring-amber-100"
                      >
                        {k}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    Budget: {formatCents(c.total_budget_cents)} total · {formatCents(c.cpm_cents)} CPM
                  </div>
                </div>

                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image_url}
                    alt=""
                    className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                ) : null}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  onClick={() => moderate(c.id, "reject")}
                  disabled={actioning === c.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-paper-0 px-4 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Reject
                </button>
                <button
                  onClick={() => moderate(c.id, "approve")}
                  disabled={actioning === c.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  Approve
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 text-xs text-slate-400">
        <Link href="/advertiser/campaigns">Go to advertiser dashboard →</Link>
      </div>
    </main>
  );
}
