"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BlogEditor } from "@/components/BlogEditor";
import { CoverImagePicker } from "@/components/CoverImagePicker";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Post } from "@/lib/types";
import { Button } from "@/components/ui/Button";

const FIELDS = [
  "Computer Science",
  "Biology",
  "Physics",
  "Chemistry",
  "Mathematics",
  "Medicine",
  "Psychology",
  "Economics",
  "Engineering",
  "Social Sciences",
  "Other",
];

export default function EditPostPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [field, setField] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [language, setLanguage] = useState("en");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/auth/login?next=/post/${slug}/edit`);
      return;
    }

    let cancelled = false;
    apiFetch<Post>(`/api/posts/${slug}`)
      .then((p) => {
        if (cancelled) return;
        if (p.author_id !== user.id) {
          setNotAllowed(true);
          return;
        }
        setPost(p);
        setTitle(p.title);
        setContent(p.content);
        setField(p.field || "");
        setTagsInput((p.tags || []).join(", "));
        setLanguage(p.language || "en");
        setCoverImageUrl(p.cover_image_url ?? null);
      })
      .catch(() => !cancelled && setNotAllowed(true))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, slug, router]);

  useEffect(() => {
    if (notAllowed) {
      router.replace(`/post/${slug}`);
    }
  }, [notAllowed, slug, router]);

  const save = async (status: "draft" | "published") => {
    if (!post) return;
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const updated = await apiFetch<Post>(`/api/posts/${post.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          content,
          field: field || null,
          tags: tags.length > 0 ? tags : null,
          language,
          status,
          cover_image_url: coverImageUrl,
        }),
      });

      router.push(`/post/${updated.slug}`);
    } catch (err) {
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail: string }).detail)
          : "Failed to save post";
      setError(detail);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="h-8 w-40 bg-paper-2 rounded animate-pulse mb-6" />
        <div className="h-64 bg-paper-2 rounded-2xl animate-pulse" />
      </main>
    );
  }

  if (!post) return null;

  const isPublished = post.status === "published";

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div className="min-w-0">
          <Link
            href={`/post/${post.slug}`}
            className="inline-flex items-center gap-1 text-sm text-ink-5 hover:text-ink-9 mb-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <p className="kicker mb-1">Revise</p>
          <h1 className="font-display text-3xl font-medium text-ink-9 truncate">
            Edit post
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => save("draft")}
            disabled={saving}
            variant="secondary"
            size="sm"
          >
            {isPublished ? "Unpublish" : "Save draft"}
          </Button>
          <Button
            onClick={() => save("published")}
            disabled={saving}
            loading={saving}
            variant="primary"
            size="sm"
          >
            {saving ? "Saving…" : isPublished ? "Update" : "Publish"}
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger mb-6">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Your post title"
          className="w-full font-display text-4xl sm:text-5xl font-medium text-ink-9 placeholder-ink-4 bg-transparent outline-none border-b border-ink-2 pb-4 focus:border-brand-500 transition-colors tracking-tight"
          maxLength={300}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-6 uppercase tracking-wider mb-1.5">
              Field
            </label>
            <select
              value={field}
              onChange={(e) => setField(e.target.value)}
              className="w-full rounded-lg border border-ink-2 bg-paper-0 px-3 py-2 text-sm text-ink-8 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/40"
            >
              <option value="">Select a field</option>
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-6 uppercase tracking-wider mb-1.5">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-ink-2 bg-paper-0 px-3 py-2 text-sm text-ink-8 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/40"
            >
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
              <option value="de">German</option>
              <option value="ar">Arabic</option>
              <option value="zh">Chinese</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-6 uppercase tracking-wider mb-1.5">
              Tags <span className="text-ink-4 normal-case">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="machine learning, nlp"
              className="w-full rounded-lg border border-ink-2 bg-paper-0 px-3 py-2 text-sm text-ink-8 placeholder:text-ink-4 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400/40"
            />
          </div>
        </div>

        <CoverImagePicker value={coverImageUrl} onChange={setCoverImageUrl} />

        <BlogEditor initialContent={post.content} onChange={setContent} />
      </div>
    </main>
  );
}
