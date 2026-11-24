"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

interface Props {
  mode: "login" | "register";
}

function AuthFormInner({ mode }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";
  // Where to land after a successful sign-in. Only same-site paths are
  // honoured so this cannot be used as an open redirect.
  const rawNext = params.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const urlError = params.get("error");
  const displayError = error || urlError;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { email, password, name } : { email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <span className="display mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-[24px] leading-none text-brand-fg">
          S
        </span>
        <h1 className="display mt-4 text-3xl">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          {isRegister
            ? "Your inventory, stats and suggestions belong to you alone."
            : "Sign in to pick up where you left off."}
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-6">
        {displayError ? (
          <div className="rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">
            {displayError}
          </div>
        ) : null}

        {isRegister ? (
          <div>
            <label className="label" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
              autoComplete="name"
            />
          </div>
        ) : null}

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            required
            minLength={isRegister ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isRegister ? "At least 8 characters" : ""}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Just a moment…" : isRegister ? "Create account" : "Sign in"}
        </button>

        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-line" />
          </div>
          <div className="relative bg-card px-2 text-xs uppercase text-muted">Or continue with</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a
            href={`/api/auth/oauth/google?returnTo=${encodeURIComponent(next)}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-xs font-medium text-ink transition hover:border-ink/30 hover:bg-tint"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Google
          </a>
          <a
            href={`/api/auth/oauth/apple?returnTo=${encodeURIComponent(next)}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-xs font-medium text-ink transition hover:border-ink/30 hover:bg-tint"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M16.37 1.43c0 1.14-.42 2.2-1.24 3.06-.99 1.03-2.19 1.63-3.49 1.53a3.6 3.6 0 0 1 1.3-2.9c.9-.83 2.1-1.4 3.43-1.69ZM20.5 17.1c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.39 3.53-4.12 3.54-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.05-1.78-4.04-3.35C-.1 15.9-.4 10.7 1.3 8.1c1.2-1.85 3.1-2.93 4.88-2.93 1.82 0 2.96 1 4.46 1 1.46 0 2.35-1 4.45-1 1.58 0 3.26.86 4.46 2.35-3.92 2.15-3.28 7.75.95 9.58Z" />
            </svg>
            Apple
          </a>
        </div>
      </form>

      <p className="mt-5 text-center text-[13px] text-muted">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-ink hover:text-accent">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/auth/register" className="font-medium text-ink hover:text-accent">
              Create one
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export default function AuthForm(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-sm">
          <div className="card p-6">
            <p className="text-center text-sm text-muted">Loading…</p>
          </div>
        </div>
      }
    >
      <AuthFormInner {...props} />
    </Suspense>
  );
}
