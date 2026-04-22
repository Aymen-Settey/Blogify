"use client";

import { useState, FormEvent } from "react";
import { RESEARCH_FIELDS, LANGUAGES } from "@/lib/constants";

export interface CampaignFormValue {
  name: string;
  advertiser_name: string;
  headline: string;
  body: string;
  image_url: string;
  cta_label: string;
  link: string;
  target_fields: string[];
  target_keywords: string[];
  target_languages: string[];
  daily_budget: string;
  total_budget: string;
  cpm: string;
  start_date: string;
  end_date: string;
}

export const EMPTY_CAMPAIGN_FORM: CampaignFormValue = {
  name: "",
  advertiser_name: "",
  headline: "",
  body: "",
  image_url: "",
  cta_label: "Learn more",
  link: "",
  target_fields: [],
  target_keywords: [],
  target_languages: ["en"],
  daily_budget: "5.00",
  total_budget: "50.00",
  cpm: "1.00",
  start_date: "",
  end_date: "",
};

interface CampaignFormProps {
  initial?: CampaignFormValue;
  submitLabel: string;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (value: CampaignFormValue) => void | Promise<void>;
}

export function CampaignForm({
  initial,
  submitLabel,
  submitting,
  error,
  onSubmit,
}: CampaignFormProps) {
  const [form, setForm] = useState<CampaignFormValue>(initial ?? EMPTY_CAMPAIGN_FORM);
  const [keywordInput, setKeywordInput] = useState("");

  const update = <K extends keyof CampaignFormValue>(key: K, value: CampaignFormValue[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleField = (field: string) => {
    setForm((f) => ({
      ...f,
      target_fields: f.target_fields.includes(field)
        ? f.target_fields.filter((x) => x !== field)
        : [...f.target_fields, field],
    }));
  };

  const toggleLanguage = (code: string) => {
    setForm((f) => ({
      ...f,
      target_languages: f.target_languages.includes(code)
        ? f.target_languages.filter((x) => x !== code)
        : [...f.target_languages, code],
    }));
  };

  const addKeyword = () => {
    const k = keywordInput.trim().toLowerCase();
    if (!k) return;
    setForm((f) =>
      f.target_keywords.includes(k)
        ? f
        : { ...f, target_keywords: [...f.target_keywords, k] }
    );
    setKeywordInput("");
  };

  const removeKeyword = (k: string) =>
    setForm((f) => ({ ...f, target_keywords: f.target_keywords.filter((x) => x !== k) }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Creative */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Creative</h2>
        <p className="mt-1 text-xs text-slate-500">
          What readers see. All ads are reviewed before going live.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Campaign name" hint="Internal label only">
            <input
              type="text"
              required
              maxLength={200}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={inputClass}
              placeholder="Spring launch"
            />
          </Field>
          <Field label="Advertiser name" hint="Shown next to the ad">
            <input
              type="text"
              required
              maxLength={200}
              value={form.advertiser_name}
              onChange={(e) => update("advertiser_name", e.target.value)}
              className={inputClass}
              placeholder="Acme Research"
            />
          </Field>
        </div>

        <div className="mt-5 space-y-5">
          <Field label="Headline" hint={`${form.headline.length}/140`}>
            <input
              type="text"
              required
              maxLength={140}
              value={form.headline}
              onChange={(e) => update("headline", e.target.value)}
              className={inputClass}
              placeholder="Cite, annotate, and share research faster"
            />
          </Field>

          <Field label="Body" hint={`${form.body.length}/1000`}>
            <textarea
              required
              maxLength={1000}
              rows={3}
              value={form.body}
              onChange={(e) => update("body", e.target.value)}
              className={`${inputClass} resize-none`}
              placeholder="Short pitch that tells readers why this matters to them."
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-[1fr,160px]">
            <Field label="Link URL">
              <input
                type="url"
                required
                maxLength={500}
                value={form.link}
                onChange={(e) => update("link", e.target.value)}
                className={inputClass}
                placeholder="https://example.com/landing"
              />
            </Field>
            <Field label="CTA label">
              <input
                type="text"
                maxLength={40}
                value={form.cta_label}
                onChange={(e) => update("cta_label", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Image URL" hint="Optional · 1:1 or landscape works best">
            <input
              type="url"
              maxLength={500}
              value={form.image_url}
              onChange={(e) => update("image_url", e.target.value)}
              className={inputClass}
              placeholder="https://..."
            />
          </Field>
        </div>
      </section>

      {/* Targeting */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Targeting</h2>
        <p className="mt-1 text-xs text-slate-500">
          Contextual only — matched to post topics, not readers.
        </p>

        <div className="mt-5">
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Fields (any match)
          </label>
          <div className="flex flex-wrap gap-2">
            {RESEARCH_FIELDS.map((f) => {
              const active = form.target_fields.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleField(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                    active
                      ? "bg-brand-600 text-white ring-brand-600"
                      : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300"
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-xs font-medium text-slate-600 mb-2">Languages</label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => {
              const active = form.target_languages.includes(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => toggleLanguage(l.code)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                    active
                      ? "bg-slate-900 text-white ring-slate-900"
                      : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300"
                  }`}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Keywords (optional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addKeyword();
                }
              }}
              className={inputClass}
              placeholder="Add a keyword and press Enter"
            />
            <button
              type="button"
              onClick={addKeyword}
              className="rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              Add
            </button>
          </div>
          {form.target_keywords.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {form.target_keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                >
                  {k}
                  <button
                    type="button"
                    onClick={() => removeKeyword(k)}
                    className="text-slate-400 hover:text-rose-600"
                    aria-label={`Remove ${k}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Budget */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">Budget & pacing</h2>
        <p className="mt-1 text-xs text-slate-500">
          CPM billing. Campaign auto-pauses when total budget is spent.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <Field label="Daily budget (USD)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.daily_budget}
              onChange={(e) => update("daily_budget", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Total budget (USD)">
            <input
              type="number"
              min={0}
              step="0.01"
              required
              value={form.total_budget}
              onChange={(e) => update("total_budget", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="CPM (USD)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.cpm}
              onChange={(e) => update("cpm", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Start date (optional)">
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => update("start_date", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="End date (optional)">
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => update("end_date", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-60"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-medium text-slate-600">{label}</label>
        {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function dollarsToCents(v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function centsToDollars(c: number): string {
  return (c / 100).toFixed(2);
}
