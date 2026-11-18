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
        {error ? (
          <div className="rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">
            {error}
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
