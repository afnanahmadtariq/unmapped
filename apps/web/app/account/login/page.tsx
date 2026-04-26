"use client";

import Link from "next/link";
import { Suspense, useState, useTransition, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, KeyRound, LogIn, UserPlus } from "lucide-react";
import { apiClient, ApiError } from "@/lib/apiClient";
import Pill from "@/components/Pill";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams?.get("from") ?? "/account";
  const country = searchParams?.get("country") ?? "";
  const locale = searchParams?.get("locale") ?? "";
  const qs = country
    ? `?country=${country}${locale ? `&locale=${locale}` : ""}`
    : "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await apiClient.userLogin(email, password);
        router.replace(fromParam || `/account${qs}`);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to sign in. Please try again.",
        );
      }
    });
  };

  return (
    <main className="flex flex-1 items-center justify-center bg-bg-base px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border-default bg-bg-raised p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <Pill tone="accent">Cartographer account</Pill>
            <h1 className="mt-2 text-xl font-semibold text-fg-primary">
              Welcome back
            </h1>
            <p className="text-xs text-fg-muted">
              Log in to refresh your saved insights and competition view.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-fg-muted">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-bg-base px-3 py-2 text-sm text-fg-primary outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-fg-muted">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-bg-base px-3 py-2 text-sm text-fg-primary outline-none focus:border-accent"
            />
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" />
            {isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs text-fg-muted">
          New here?{" "}
          <Link
            href={`/account/signup${qs}`}
            className="inline-flex items-center gap-1 text-accent hover:text-accent-strong"
          >
            <UserPlus className="h-3 w-3" /> Create an account
          </Link>
        </p>
        <p className="mt-2 text-[11px] text-fg-muted">
          Optional. Sign in just lets us save your wizard runs so we can
          show updated insights next time.
        </p>
      </div>
    </main>
  );
}

export default function AccountLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
