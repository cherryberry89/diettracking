"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SetupNotice } from "@/components/app-context";
import { Logo } from "@/components/Logo";
import { ErrorNote } from "@/components/ui";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace("/today");
      });
  }, [router]);

  if (!isSupabaseConfigured) return <SetupNotice />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const auth = getSupabase().auth;
    try {
      if (mode === "signup") {
        const { data, error } = await auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/` },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmSent(true);
          return;
        }
      } else {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      setPassword("");
      router.replace("/today");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const signup = mode === "signup";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size={56} />
        <h1 className="text-2xl font-semibold tracking-tight">Nourish</h1>
        <p className="text-muted">Track what you eat. Hit your calorie and protein goals.</p>
      </div>

      {confirmSent ? (
        <div className="card space-y-3 text-center">
          <h2 className="font-semibold">Check your inbox</h2>
          <p className="hint">
            We sent a confirmation link to <strong className="text-ink">{email}</strong>. Open it, then come back
            and sign in.
          </p>
          <button
            className="btn-secondary w-full"
            onClick={() => {
              setConfirmSent(false);
              setMode("signin");
            }}
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4">
          <h2 className="text-lg font-semibold">{signup ? "Create your account" : "Sign in"}</h2>
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              required
              minLength={8}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={signup ? "password-hint" : undefined}
            />
            {signup && (
              <p id="password-hint" className="hint mt-1.5">
                At least 8 characters.
              </p>
            )}
          </div>
          <ErrorNote>{error}</ErrorNote>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
          </button>
        </form>
      )}

      {!confirmSent && (
        <p className="text-center text-sm text-muted">
          {signup ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            className="cursor-pointer font-semibold text-accent underline-offset-2 hover:underline"
            onClick={() => {
              setMode(signup ? "signin" : "signup");
              setError(null);
            }}
          >
            {signup ? "Sign in" : "Create an account"}
          </button>
        </p>
      )}
    </main>
  );
}
