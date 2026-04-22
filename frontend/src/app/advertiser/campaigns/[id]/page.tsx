"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { AdCampaign, AdStats, AdStatus } from "@/lib/types";
import {
  CampaignForm,
  CampaignFormValue,
  dollarsToCents,
  centsToDollars,
} from "@/components/CampaignForm";
import { ArrowLeft, Pause, Play, Trash2 } from "lucide-react";

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

function campaignToForm(c: AdCampaign): CampaignFormValue {
  return {
    name: c.name,
    advertiser_name: c.advertiser_name,
    headline: c.headline,
    body: c.body,
    image_url: c.image_url ?? "",
    cta_label: c.cta_label,
    link: c.link,
    target_fields: c.target_fields ?? [],
    target_keywords: c.target_keywords ?? [],
    target_languages: c.target_languages ?? [],
    daily_budget: centsToDollars(c.daily_budget_cents),
    total_budget: centsToDollars(c.total_budget_cents),
    cpm: centsToDollars(c.cpm_cents),
    start_date: c.start_date ?? "",
    end_date: c.end_date ?? "",
  };
}

export default function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();
  const [campaign, setCampaign] = useState<AdCampaign | null>(null);
  const [stats, setStats] = useState<AdStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = async () => {
    try {
      const [c, s] = await Promise.all([
        apiFetch<AdCampaign>(`/api/ads/campaigns/${id}`),
        apiFetch<AdStats>(`/api/ads/campaigns/${id}/stats`).catch(() => null),
      ]);
      setCampaign(c);
      setStats(s);
    } catch (err) {
      const detail = (err as { detail?: string; status?: number })?.status;
      if (detail === 404) setNotFound(true);
      else setError((err as { detail?: string })?.detail ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSubmit = async (value: CampaignFormValue) => {
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: value.name.trim(),
        headline: value.headline.trim(),
        body: value.body.trim(),
        image_url: value.image_url.trim() || null,
        cta_label: value.cta_label.trim() || "Learn more",
        link: value.link.trim(),
        target_fields: value.target_fields.length ? value.target_fields : null,
        target_keywords: value.target_keywords.length ? value.target_keywords : null,
        target_languages: value.target_languages.length ? value.target_languages : null,
        daily_budget_cents: dollarsToCents(value.daily_budget),
        total_budget_cents: dollarsToCents(value.total_budget),
        cpm_cents: dollarsToCents(value.cpm),
        start_date: value.start_date || null,
        end_date: value.end_date || null,
      };
      const updated = await apiFetch<AdCampaign>(`/api/ads/campaigns/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setCampaign(updated);
    } catch (err) {
      setError((err as { detail?: string })?.detail ?? "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (status: "active" | "paused") => {
    if (!campaign) return;
    try {
      const updated = await apiFetch<AdCampaign>(`/api/ads/campaigns/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      setCampaign(updated);
    } catch (err) {
      setError((err as { detail?: string })?.detail ?? "Failed to change status");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/ads/campaigns/${id}`, { method: "DELETE" });
      router.push("/advertiser/campaigns");
    } catch (err) {
      setError((err as { detail?: string })?.detail ?? "Failed to delete");
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-8 w-56 bg-slate-100 rounded animate-pulse" />
        <div className="mt-6 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  if (notFound || !campaign) {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        <p className="text-slate-500">Campaign not found.</p>
        <Link href="/advertiser/campaigns" className="mt-4 inline-block text-brand-600">
          ← Back to campaigns
        </Link>
      </main>
    );
  }

  const canPause = campaign.status === "active";
  const canResume = campaign.status === "paused";

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/advertiser/campaigns"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to campaigns
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold text-slate-900 truncate">{campaign.name}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLES[campaign.status]}`}
            >
              {STATUS_LABELS[campaign.status]}
            </span>
          </div>
          {campaign.rejection_reason ? (
            <p className="mt-2 text-sm text-rose-600">
              Rejected: {campaign.rejection_reason}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {canPause ? (
            <button
              onClick={() => changeStatus("paused")}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-paper-0 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Pause className="h-4 w-4" />
              Pause
            </button>
          ) : null}
          {canResume ? (
            <button
              onClick={() => changeStatus("active")}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100"
            >
              <Play className="h-4 w-4" />
              Resume
            </button>
          ) : null}
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-paper-0 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Stats */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-paper-0 p-6">
        <h2 className="text-base font-semibold text-slate-900">Performance</h2>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Impressions" value={campaign.impressions.toLocaleString()} />
          <Stat label="Clicks" value={campaign.clicks.toLocaleString()} />
          <Stat
            label="CTR"
            value={
              campaign.impressions
                ? `${((campaign.clicks / campaign.impressions) * 100).toFixed(2)}%`
                : "—"
            }
          />
          <Stat
            label="Spend"
            value={`$${centsToDollars(campaign.spend_cents)}`}
            hint={`of $${centsToDollars(campaign.total_budget_cents)}`}
          />
        </div>

        {stats && stats.last_7_days.length > 0 ? (
          <div className="mt-6">
            <div className="text-xs font-medium text-slate-500 mb-2">Last 7 days</div>
            <MiniBars data={stats.last_7_days} />
          </div>
        ) : null}
      </section>

      {/* Edit */}
      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Edit campaign</h2>
        <p className="text-xs text-slate-500 mb-4">
          Changes to creative fields will send the campaign back to review.
        </p>
        <CampaignForm
          initial={campaignToForm(campaign)}
          submitLabel="Save changes"
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
        />
      </section>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

function MiniBars({
  data,
}: {
  data: { date: string; impressions: number; clicks: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.impressions));
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((d) => {
        const h = (d.impressions / max) * 100;
        const ch = d.impressions ? (d.clicks / d.impressions) * h : 0;
        const label = new Date(d.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t bg-brand-100 relative overflow-hidden"
                style={{ height: `${h}%` }}
                title={`${d.impressions} impressions · ${d.clicks} clicks`}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 bg-brand-600"
                  style={{ height: `${(ch / Math.max(h, 0.01)) * 100}%` }}
                />
              </div>
            </div>
            <div className="text-[10px] text-slate-400">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
