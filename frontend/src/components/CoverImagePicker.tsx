"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { uploadFile } from "@/lib/api";
import { cn } from "@/lib/cn";

/**
 * Cover image picker for the write / edit surfaces. Uploads to
 * `POST /api/uploads/image` and reports the resulting URL via `onChange`.
 * The returned URL is what PostCard renders above the title.
 */
export function CoverImagePicker({
  value,
  onChange,
  className,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image too large (max 10MB).");
      return;
    }

    setUploading(true);
    try {
      const res = await uploadFile<{ url: string }>("/api/uploads/image", file);
      onChange(res.url);
    } catch (err) {
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail: string }).detail)
          : "Upload failed";
      setError(detail);
    } finally {
      setUploading(false);
    }
  };

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = "";
  };

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-ink-6 uppercase tracking-wider mb-1.5">
        Cover image <span className="text-ink-4 normal-case">(shown on cards & the post header)</span>
      </label>

      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-ink-2 bg-paper-1 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Cover preview"
            className="w-full h-56 object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-full bg-paper-0/95 backdrop-blur px-3 py-1.5 text-xs font-medium text-ink-8 border border-ink-2 hover:bg-paper-0 transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <ImagePlus className="h-3.5 w-3.5" /> Replace
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-full bg-paper-0/95 backdrop-blur px-3 py-1.5 text-xs font-medium text-ink-8 border border-ink-2 hover:border-danger hover:text-danger transition-colors disabled:opacity-60"
              aria-label="Remove cover image"
            >
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "group flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-3 bg-paper-1 px-4 py-10 text-sm text-ink-6 transition-colors",
            "hover:border-brand-400 hover:bg-brand-50/40 hover:text-ink-8",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60",
            uploading && "opacity-60 pointer-events-none",
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          ) : (
            <ImagePlus className="h-6 w-6 text-ink-5 group-hover:text-brand-600 transition-colors" />
          )}
          <span className="font-medium">
            {uploading ? "Uploading…" : "Add a cover image"}
          </span>
          <span className="text-xs text-ink-5">
            JPG, PNG, WebP or GIF · up to 10 MB
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={onInput}
        className="hidden"
      />

      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="mt-2 text-xs text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}
