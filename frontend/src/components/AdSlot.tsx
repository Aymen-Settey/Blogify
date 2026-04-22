"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { AdSlot as AdSlotType } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AdSlotProps {
  postId?: string;
  field?: string;
  language?: string;
  className?: string;
}

export function AdSlot({ postId, field, language, className = "" }: AdSlotProps) {
  const [ad, setAd] = useState<AdSlotType | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const impressionFired = useRef(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Fetch a single ad
  useEffect(() => {
    if (!postId && !field) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (postId) params.set("post_id", postId);
        if (field) params.set("field", field);
        if (language) params.set("language", language);
        params.set("limit", "1");
        const data = await apiFetch<AdSlotType[]>(`/api/ads/serve?${params.toString()}`);
        if (!cancelled) setAd(data[0] ?? null);
      } catch {
        if (!cancelled) setAd(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, field, language]);

  // Fire impression when visible
  useEffect(() => {
    if (!ad || impressionFired.current) return;
    const el = cardRef.current;
    if (!el) return;

    const fire = () => {
      if (impressionFired.current) return;
      impressionFired.current = true;
      // Fire-and-forget; backend logs the event and returns 204
      fetch(`${API_URL}/api/ads/impression?token=${encodeURIComponent(ad.impression_token)}`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {});
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            fire();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ad]);

  if (loading) return null;
  if (!ad || dismissed) return null;

  const clickUrl = `${API_URL}/api/ads/click?token=${encodeURIComponent(ad.impression_token)}`;

  return (
    <aside
      ref={cardRef}
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm ${className}`}
      aria-label="Sponsored content"
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Sponsored
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-slate-400 hover:text-slate-600 transition"
          aria-label="Dismiss ad"
        >
          Hide
        </button>
      </div>

      <a
        href={clickUrl}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="block px-5 pb-5 pt-3 group"
      >
        <div className="flex gap-4">
          {ad.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.image_url}
              alt=""
              className="h-20 w-20 flex-none rounded-lg object-cover ring-1 ring-slate-200"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">{ad.advertiser_name}</p>
            <h3 className="mt-0.5 text-base font-semibold text-slate-900 group-hover:text-brand-700 transition-colors line-clamp-2">
              {ad.headline}
            </h3>
            <p className="mt-1 text-sm text-slate-600 line-clamp-2">{ad.body}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-medium text-white group-hover:bg-brand-700 transition-colors">
            {ad.cta_label}
            <span aria-hidden="true">→</span>
          </span>
          <span className="text-[11px] text-slate-400">Ad</span>
        </div>
      </a>
    </aside>
  );
}
