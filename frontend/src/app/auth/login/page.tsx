"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/feed");
    } catch (err) {
      const detail =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail: string }).detail)
          : "Login failed";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="kicker mb-3">Returning reader</p>
      <h1 className="font-display text-4xl font-medium tracking-tight text-ink-9 mb-2">
        Welcome back.
      </h1>
      <p className="text-ink-6 mb-8">
        Sign in to continue reading Blogify.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
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
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-sm text-ink-6 text-center mt-8">
        New here?{" "}
        <Link
          href="/auth/register"
          className="text-brand-600 font-medium hover:text-brand-700 underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
