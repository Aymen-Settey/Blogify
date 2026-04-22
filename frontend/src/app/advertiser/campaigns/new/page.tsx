"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { AdCampaign } from "@/lib/types";
import {
  CampaignForm,
  CampaignFormValue,
  dollarsToCents,
} from "@/components/CampaignForm";
import { ArrowLeft } from "lucide-react";

export default function NewCampaignPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (value: CampaignFormValue) => {
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: value.name.trim(),
        advertiser_name: value.advertiser_name.trim(),
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
      const created = await apiFetch<AdCampaign>("/api/ads/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/advertiser/campaigns/${created.id}`);
    } catch (err) {
      setError((err as { detail?: string })?.detail ?? "Failed to create campaign");
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/advertiser/campaigns"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to campaigns
      </Link>
      <h1 className="text-3xl font-bold text-slate-900">New campaign</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">
        Submit a contextual ad. Once reviewed, it&apos;ll be shown alongside relevant posts.
      </p>
      <CampaignForm
        submitLabel="Submit for review"
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
