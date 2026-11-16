"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getLatestWeight, getProfile } from "@/lib/db";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { Logo } from "./Logo";
import { ErrorNote, Spinner } from "./ui";

interface AppState {
  db: SupabaseClient;
  userId: string;
  email: string;
  profile: Profile;
  /** Most recent logged weight. */
  weightKg: number | null;
  /** Reloads profile and weight after they change. */
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function SetupNotice() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">
      <Logo size={44} />
      <h1 className="text-xl font-semibold">Almost there</h1>
      <p className="text-muted">
        The app isn&apos;t connected to its database yet. Copy <code>.env.example</code> to{" "}
        <code>.env.local</code>, fill in the Supabase URL and publishable key, then restart the server.
      </p>
    </main>
  );
}

/** Loads the signed-in user and their profile; redirects to sign-in or onboarding when missing. */
export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<Omit<AppState, "refresh"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = getSupabase();
    const { data } = await db.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      router.replace("/login");
      return;
    }
    const [profile, weight] = await Promise.all([getProfile(db, user.id), getLatestWeight(db)]);
    if (!profile) {
      router.replace("/onboarding");
      return;
    }
    setState({ db, userId: user.id, email: user.email ?? "", profile, weightKg: weight?.weight_kg ?? null });
  }, [router]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    load().catch((e: Error) => setError(e.message));
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      // A full page load (not a client-side route change) so that nothing from
      // the signed-out account stays in memory in previously visited screens.
      if (event === "SIGNED_OUT") window.location.replace("/login");
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (error) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 space-y-4 p-6">
        <ErrorNote>Couldn&apos;t load your data: {error}</ErrorNote>
        <button className="btn-secondary" onClick={() => location.reload()}>
          Try again
        </button>
      </main>
    );
  }
  if (!state) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return <AppContext.Provider value={{ ...state, refresh: load }}>{children}</AppContext.Provider>;
}
