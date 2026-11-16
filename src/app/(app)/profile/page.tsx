"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-context";
import {
  ActivityPicker,
  BmiCard,
  BodyFields,
  GoalPicker,
  TargetsEditor,
  targetsFor,
  validateBody,
  validateTargets,
  type BodyState,
} from "@/components/profile-form";
import { ErrorNote, Sheet } from "@/components/ui";
import { toLocalDate } from "@/lib/dates";
import { deleteAllData, saveProfile, saveWeight } from "@/lib/db";
import type { Targets } from "@/lib/types";

const TARGET_KEYS = [
  "target_calories",
  "target_protein_g",
  "target_carbs_g",
  "target_fat_g",
  "target_fiber_g",
  "target_water_ml",
] as const;

export default function ProfilePage() {
  const { db, userId, email, profile, weightKg, refresh } = useApp();
  const [body, setBody] = useState<BodyState>(() => ({
    unit_system: profile.unit_system,
    heightCm: Number(profile.height_cm),
    weightKg: weightKg ?? 0,
    age: new Date().getFullYear() - profile.birth_year,
    sex: profile.sex,
    activity: profile.activity_level,
    goal: profile.goal,
    trimester: profile.trimester ?? 1,
  }));
  const [targets, setTargets] = useState<Targets>(
    () => Object.fromEntries(TARGET_KEYS.map((k) => [k, profile[k]])) as unknown as Targets,
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const patch = (p: Partial<BodyState>) => {
    setBody((b) => ({ ...b, ...p }));
    setStatus("idle");
  };

  const suggestion = validateBody(body) ? null : targetsFor(body);
  const differs = suggestion !== null && TARGET_KEYS.some((k) => suggestion[k] !== targets[k]);

  async function save() {
    const problem = validateBody(body) ?? validateTargets(targets);
    if (problem) return setError(problem);
    setStatus("saving");
    setError(null);
    try {
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
      if (weightKg === null || Math.abs(body.weightKg - weightKg) > 0.04) {
        await saveWeight(db, toLocalDate(), body.weightKg);
      }
      await refresh();
      setStatus("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your changes.");
      setStatus("idle");
    }
  }

  async function removeEverything() {
    setDeleting(true);
    try {
      await deleteAllData(db, userId);
      await db.auth.signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete your data.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Profile</h1>
        <p className="hint">{email}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">About you</h2>
        <div className="card">
          <BodyFields body={body} patch={patch} />
        </div>
        <BmiCard body={body} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Activity</h2>
        <ActivityPicker body={body} patch={patch} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Goal</h2>
        <GoalPicker body={body} patch={patch} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Daily targets</h2>
        <div className="card space-y-3">
          <TargetsEditor
            targets={targets}
            onChange={(t) => {
              setTargets(t);
              setStatus("idle");
            }}
            unitSystem={body.unit_system}
          />
          {differs && suggestion && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
              <p className="text-sm text-muted">
                Suggested for your details: {suggestion.target_calories.toLocaleString()} kcal,{" "}
                {suggestion.target_protein_g} g protein.
              </p>
              <button
                type="button"
                className="btn-secondary min-h-9"
                onClick={() => {
                  setTargets(suggestion);
                  setStatus("idle");
                }}
              >
                Use suggested
              </button>
            </div>
          )}
        </div>
        <p className="hint">Targets are estimates from standard formulas, not medical advice.</p>
      </section>

      <div className="space-y-3">
        <ErrorNote>{error}</ErrorNote>
        <div className="flex items-center gap-3">
          <button className="btn-primary min-w-40" onClick={save} disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Save changes"}
          </button>
          {status === "saved" && (
            <span role="status" className="text-sm font-medium text-accent">
              Saved
            </span>
          )}
        </div>
      </div>

      <section className="space-y-3 border-t border-line pt-6">
        <h2 className="text-lg font-semibold">Account</h2>
        <div className="flex flex-wrap gap-3">
          <button className="btn-secondary" onClick={() => db.auth.signOut()}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
          <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete my data
          </button>
        </div>
      </section>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete all your data?">
        <div className="space-y-4">
          <p className="text-muted">
            This permanently removes your profile, food log, weigh-ins, water log, favourites and meal photos. It
            can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <button className="btn-danger flex-1" onClick={removeEverything} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete everything"}
            </button>
            <button className="btn-secondary flex-1" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Keep my data
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
