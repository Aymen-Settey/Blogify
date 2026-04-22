"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AdCampaign, AdStatus } from "@/lib/types";
import { PlusCircle, BarChart3, Megaphone } from "lucide-react";

const STATUS_STYLES: Record<AdStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  pending_review: "bg-amber-50 text-amber-700 ring-amber-200",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  paused: "bg-slate-100 text-slate-600 ring-slate-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  ended: "bg-slate-100 text-slate-500 ring-slate-200",
};

const STATUS_LABELS: Record<AdStatus, string> = {
  draft: "Draft",
  pending_review: "In review",
  active: "Active",
  paused: "Paused",
  rejected: "Rejected",
  ended: "Ended",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function ctr(impressions: number, clicks: number): string {
  if (!impressions) return "—";
  return `${((clicks / impressions) * 100).toFixed(2)}%`;
}

export default function CampaignsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    (async () => {
      try {
        const data = await apiFetch<AdCampaign[]>("/api/ads/campaigns");
        setCampaigns(data);
      } catch (err) {
        setError((err as { detail?: string })?.detail ?? "Failed to load campaigns");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, router]);

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-brand-600 mb-1">
            <Megaphone className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Advertiser</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Your campaigns</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-xl">
            Privacy-first contextual ads. Campaigns are matched to posts by topic, not
            readers. Submit for review and we&apos;ll approve ads that meet our content
            guidelines.
          </p>
        </div>
        <Link
          href="/advertiser/campaigns/new"
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          New campaign
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-8 py-16 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">No campaigns yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Create your first campaign to reach relevant readers.
          </p>
          <Link
            href="/advertiser/campaigns/new"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <PlusCircle className="h-4 w-4" />
            Create campaign
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-paper-0">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                href={`/advertiser/campaigns/${c.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900 truncate">{c.name}</h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLES[c.status]}`}
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600 truncate">{c.headline}</p>
                  {c.rejection_reason ? (
                    <p className="mt-1 text-xs text-rose-600 line-clamp-1">
                      Rejected: {c.rejection_reason}
                    </p>
                  ) : null}
                </div>
                <div className="hidden md:grid grid-cols-4 gap-6 text-right text-sm">
                  <div>
                    <div className="text-slate-400 text-[11px] uppercase tracking-wide">Views</div>
                    <div className="font-semibold text-slate-900">{c.impressions.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px] uppercase tracking-wide">Clicks</div>
                    <div className="font-semibold text-slate-900">{c.clicks.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px] uppercase tracking-wide">CTR</div>
                    <div className="font-semibold text-slate-900">{ctr(c.impressions, c.clicks)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[11px] uppercase tracking-wide">Spend</div>
                    <div className="font-semibold text-slate-900">
                      {formatCents(c.spend_cents)}
                      <span className="text-slate-400 font-normal"> / {formatCents(c.total_budget_cents)}</span>
                    </div>
                  </div>
                </div>
                <BarChart3 className="h-4 w-4 text-slate-300 flex-none" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
