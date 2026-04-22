"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Upload, X, Check } from "lucide-react";
import { apiFetch, uploadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SettingsPage() {
  const { user, loading: authLoading, refresh, logout } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [affiliations, setAffiliations] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth/login?next=/settings");
      return;
    }
    setDisplayName(user.display_name || "");
    setBio(user.bio || "");
    setAvatarUrl(user.avatar_url || null);
    setAffiliations(user.affiliations || "");
    setInterests(user.research_interests || []);
  }, [authLoading, user, router]);

  const addInterest = () => {
    const v = interestInput.trim();
    if (!v) return;
    if (interests.includes(v)) {
      setInterestInput("");
      return;
    }
    setInterests([...interests, v]);
    setInterestInput("");
  };

  const removeInterest = (tag: string) => {
    setInterests(interests.filter((t) => t !== tag));
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadFile<{ url: string }>("/api/uploads/image", file);
      setAvatarUrl(res.url);
    } catch (err) {
      const msg = (err as { detail?: string })?.detail || "Upload failed";
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch<User>("/api/auth/me", {
        method: "PUT",
        body: JSON.stringify({
          display_name: displayName,
          bio: bio || null,
          avatar_url: avatarUrl,
          affiliations: affiliations || null,
          research_interests: interests,
        }),
      });
      await refresh();
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      const msg = (err as { detail?: string })?.detail || "Failed to save";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="h-8 w-40 bg-paper-2 rounded animate-pulse mb-6" />
        <div className="h-64 bg-paper-2 rounded-2xl animate-pulse" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
      <SectionHeader
        kicker="Preferences"
        title="Settings"
        description="Manage your profile and account."
      />

      <form onSubmit={save} className="space-y-6 mt-10">
        <section className="rounded-2xl border border-ink-2 bg-paper-0 p-6 md:p-8">
          <h2 className="font-display text-xl font-medium text-ink-9 mb-1">
            Profile
          </h2>
          <p className="text-sm text-ink-5 mb-6">
            This information will be visible on your public profile.
          </p>

          {/* Avatar */}
          <div className="flex items-center gap-5 mb-6">
            <div className="h-20 w-20 rounded-full bg-paper-2 overflow-hidden flex items-center justify-center text-ink-6 text-xl font-display font-medium shrink-0 border border-ink-2">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                displayName.charAt(0).toUpperCase() ||
                user.username.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-lg border border-ink-2 bg-paper-0 px-3 py-2 text-sm font-medium text-ink-7 hover:bg-paper-2 hover:text-ink-9 cursor-pointer transition-colors">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatar}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="text-sm text-ink-5 hover:text-danger transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <Input
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={100}
            />

            <div>
              <label className="block text-sm font-medium text-ink-7 mb-1.5">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="A short description about yourself…"
                className="w-full rounded-lg border border-ink-2 bg-paper-0 px-3 py-2 text-sm text-ink-8 placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-500 resize-none transition-colors"
              />
              <p className="text-xs text-ink-4 mt-1">{bio.length}/500</p>
            </div>

            <Input
              label="Affiliations"
              value={affiliations}
              onChange={(e) => setAffiliations(e.target.value)}
              placeholder="e.g. MIT CSAIL, Google Research"
            />

            <div>
              <label className="block text-sm font-medium text-ink-7 mb-1.5">
                Research interests
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInterest();
                    }
                  }}
                  placeholder="Add a topic and press Enter"
                  className="flex-1 rounded-lg border border-ink-2 bg-paper-0 px-3 py-2 text-sm text-ink-8 placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-500 transition-colors"
                />
                <Button type="button" onClick={addInterest} size="sm">
                  Add
                </Button>
              </div>
              {interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {interests.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-paper-2 border border-ink-2 px-2.5 py-1 text-xs font-medium text-ink-7"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeInterest(tag)}
                        aria-label={`Remove ${tag}`}
                        className="hover:text-danger transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-ink-2 bg-paper-0 p-6 md:p-8">
          <h2 className="font-display text-xl font-medium text-ink-9 mb-1">
            Account
          </h2>
          <p className="text-sm text-ink-5 mb-6">
            Your account identifiers. Contact support to change these.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-7 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={user.username}
                readOnly
                className="w-full rounded-lg border border-ink-2 bg-paper-1 px-3 py-2 text-sm text-ink-5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-7 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                readOnly
                className="w-full rounded-lg border border-ink-2 bg-paper-1 px-3 py-2 text-sm text-ink-5"
              />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-ink-2">
            <button
              type="button"
              onClick={() => {
                logout();
              }}
              className="text-sm font-medium text-danger hover:opacity-80 transition-opacity"
            >
              Sign out of this account
            </button>
          </div>
        </section>

        {error && (
          <div role="alert" aria-live="assertive" className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 sticky bottom-4">
          {savedAt && (
            <span className="inline-flex items-center gap-1.5 text-sm text-success font-medium">
              <Check className="h-4 w-4" />
              Saved
            </span>
          )}
          <Button
            type="submit"
            disabled={saving}
            loading={saving}
            variant="primary"
            leadingIcon={<Save className="h-4 w-4" />}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </main>
  );
}
