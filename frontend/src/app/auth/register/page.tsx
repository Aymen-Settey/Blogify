"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    display_name: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      router.push("/feed");
    } catch (err) {
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail: string }).detail)
          : "Registration failed";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const update =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  return (
    <div>
      <p className="kicker mb-3">New contributor</p>
      <h1 className="font-display text-4xl font-medium tracking-tight text-ink-9 mb-2">
        Create your account.
      </h1>
      <p className="text-ink-6 mb-8">
        Join a community of researchers sharing their work.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Display name"
          type="text"
          value={form.display_name}
          onChange={update("display_name")}
          required
          minLength={1}
          maxLength={100}
        />
        <Input
          label="Username"
          type="text"
          value={form.username}
          onChange={update("username")}
          required
          minLength={3}
          maxLength={50}
          pattern="[a-zA-Z0-9_-]+"
          hint="Letters, numbers, _ and - only."
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={update("email")}
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={update("password")}
          required
          minLength={8}
          autoComplete="new-password"
          hint="At least 8 characters."
        />

        {error && (
          <div role="alert" aria-live="assertive" className="rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <Button
          type="submit"
          loading={loading}
          variant="primary"
          size="lg"
          className="w-full"
        >
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-sm text-ink-6 text-center mt-8">
        Already a reader?{" "}
        <Link
          href="/auth/login"
          className="text-brand-600 font-medium hover:text-brand-700 underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
