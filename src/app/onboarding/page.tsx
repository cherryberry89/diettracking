"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SetupNotice } from "@/components/app-context";
import { Logo } from "@/components/Logo";
import {
  ActivityPicker,
  BmiCard,
  BodyFields,
  DEFAULT_BODY,
  GoalPicker,
  TargetsEditor,
  targetsFor,
  validateBody,
  validateTargets,
  type BodyState,
} from "@/components/profile-form";
import { ErrorNote, Spinner } from "@/components/ui";
import { toLocalDate } from "@/lib/dates";
import { getProfile, saveProfile, saveWeight } from "@/lib/db";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { GOAL_INFO, type Targets } from "@/lib/types";

const STEPS = ["About you", "Activity", "Your goal", "Daily targets"];

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [body, setBody] = useState<BodyState>(DEFAULT_BODY);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const db = getSupabase();
    db.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return router.replace("/login");
      if (await getProfile(db, user.id).catch(() => null)) return router.replace("/today");
      setUserId(user.id);
    });
  }, [router]);

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (!userId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const patch = (p: Partial<BodyState>) => {
    setBody((b) => ({ ...b, ...p }));
    setError(null);
  };

  function next() {
    if (step === 0) {
      const problem = validateBody(body);
      if (problem) return setError(problem);
    }
    if (step === 2) setTargets(targetsFor(body));
    setError(null);
    setStep(step + 1);
  }

  async function finish() {
    if (!targets || !userId) return;
    const problem = validateTargets(targets);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const db = getSupabase();
      await saveProfile(db, {
        id: userId,
        unit_system: body.unit_system,
        height_cm: Math.round(body.heightCm * 10) / 10,
        sex: body.goal === "pregnancy" ? "female" : body.sex,
        birth_year: new Date().getFullYear() - body.age,
        activity_level: body.activity,
        goal: body.goal,
        trimester: body.goal === "pregnancy" ? body.trimester : null,
        ...targets,
      });
      await saveWeight(db, toLocalDate(), body.weightKg);
      router.replace("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your profile.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-6">
      <div className="mb-6 flex items-center gap-2.5">
        <Logo size={30} />
        <span className="text-lg font-semibold tracking-tight">Nourish</span>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm text-muted">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-surface-2"}`} />
          ))}
        </div>
      </div>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight">{STEPS[step]}</h1>

      {step === 0 && (
        <section className="space-y-5">
          <p className="text-muted">A few details so we can estimate what your body needs.</p>
          <div className="card">
            <BodyFields body={body} patch={patch} />
          </div>
          <BmiCard body={body} />
        </section>
      )}

      {step === 1 && (
        <section className="space-y-5">
          <p className="text-muted">How active are you in a typical week?</p>
          <ActivityPicker body={body} patch={patch} />
        </section>
      )}

      {step === 2 && (
        <section className="space-y-5">
          <p className="text-muted">What are you aiming for? You can change this any time.</p>
          <GoalPicker body={body} patch={patch} />
        </section>
      )}

      {step === 3 && targets && (
        <section className="space-y-5">
          <p className="text-muted">
            Suggested for <strong className="text-ink">{GOAL_INFO[body.goal].label.toLowerCase()}</strong>. Adjust
            anything you like.
          </p>
          <div className="card">
            <TargetsEditor targets={targets} onChange={setTargets} unitSystem={body.unit_system} />
            <button type="button" className="btn-ghost mt-3 -ml-2" onClick={() => setTargets(targetsFor(body))}>
              Reset to suggested
            </button>
          </div>
          <BmiCard body={body} />
          <p className="hint">
            These numbers are estimates from standard formulas, not medical advice. If you have a health condition,
            are pregnant or breastfeeding, check them with a professional.
          </p>
        </section>
      )}

      <div className="mt-6 space-y-3">
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-3">
          {step > 0 && (
            <button type="button" className="btn-secondary" onClick={() => setStep(step - 1)} disabled={busy}>
              <ArrowLeft size={18} aria-hidden="true" /> Back
            </button>
          )}
          {step < 3 ? (
            <button type="button" className="btn-primary flex-1" onClick={next}>
              Continue
            </button>
          ) : (
            <button type="button" className="btn-primary flex-1" onClick={finish} disabled={busy}>
              {busy ? "Saving…" : "Start tracking"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
