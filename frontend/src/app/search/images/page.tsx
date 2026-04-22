"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ImageIcon, Search as SearchIcon, Upload, Loader2 } from "lucide-react";
import { API_URL, apiFetch, getToken } from "@/lib/api";

type Hit = {
  image_id: string;
  score: number;
  url: string | null;
  uploader_id: string | null;
  post_id: string | null;
  alt_text: string | null;
  content_type: string | null;
};

type Response = {
  mode: "text" | "image";
  query?: string;
  results: Hit[];
};

type Mode = "text" | "image";

export default function ImageSearchPage() {
  const [mode, setMode] = useState<Mode>("text");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runTextSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Response>(
        `/api/search/images?q=${encodeURIComponent(q)}&limit=24`
      );
      setResults(data.results);
    } catch (e) {
      setError((e as { detail?: string })?.detail || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const runImageSearch = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setQuery("");
    try {
      const form = new FormData();
      form.append("file", file);
      const token = getToken();
      const res = await fetch(`${API_URL}/api/search/images/by-image?limit=24`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.detail || "Search failed");
      }
      const data: Response = await res.json();
      setResults(data.results);
    } catch (e) {
      setError((e as Error)?.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">
          Image search
        </h1>
        <p className="text-sm text-slate-500">
          Find images by describing them, or upload an image to find visually similar ones.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-6">
        <button
          onClick={() => setMode("text")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            mode === "text"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <SearchIcon className="h-4 w-4" />
          Text → image
        </button>
        <button
          onClick={() => setMode("image")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            mode === "image"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          Image → image
        </button>
      </div>

      {mode === "text" ? (
        <div className="relative mb-8">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runTextSearch()}
            placeholder='Describe an image, e.g. "a chart showing model accuracy"'
            autoFocus
            className="w-full rounded-xl border border-slate-300 bg-white pl-12 pr-28 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
          <button
            onClick={runTextSearch}
            disabled={!query.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) runImageSearch(f);
          }}
          onClick={() => fileInputRef.current?.click()}
          className="mb-8 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center cursor-pointer hover:border-brand-400 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) runImageSearch(f);
            }}
          />
          <Upload className="mx-auto h-10 w-10 text-slate-400 mb-2" />
          <p className="text-slate-700 font-medium">Drop an image, or click to upload</p>
          <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF, WebP · up to 10MB</p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {results.map((hit) => (
            <HitCard key={hit.image_id} hit={hit} />
          ))}
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <ImageIcon className="mx-auto h-10 w-10 text-slate-400 mb-3" />
          <p className="text-slate-600 font-medium">
            {mode === "text"
              ? "Describe what you're looking for"
              : "Upload an image to find similar ones"}
          </p>
        </div>
      )}
    </main>
  );
}

function HitCard({ hit }: { hit: Hit }) {
  const href = hit.post_id ? `/post/${hit.post_id}` : hit.url || "#";
  const content = (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      {hit.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hit.url}
          alt={hit.alt_text || "image"}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-400">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="text-xs text-white">
          score {hit.score.toFixed(3)}
        </p>
      </div>
    </div>
  );
  return hit.post_id ? (
    <Link href={href}>{content}</Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  );
}
