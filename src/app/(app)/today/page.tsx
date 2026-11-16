"use client";

import { ChevronLeft, ChevronRight, Droplet, Plus, Star, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-context";
import { DraftFields, formatAmount } from "@/components/DraftFields";
import { ErrorNote, ProgressBar, Sheet, Spinner } from "@/components/ui";
import { addDays, friendlyDate, toLocalDate } from "@/lib/dates";
import {
  addWater,
  deleteEntries,
  getWaterTotal,
  listEntries,
  saveFood,
  sumNutrients,
  undoWater,
  updateEntry,
} from "@/lib/db";
import { MEALS, MEAL_LABELS, type FoodDraft, type FoodEntry, type Meal } from "@/lib/types";
import { formatWater } from "@/lib/units";

const fmt = (n: number) => Math.round(n).toLocaleString();

export default function TodayPage() {
  const { db, profile } = useApp();
  const [today] = useState(() => toLocalDate());
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState<FoodEntry[] | null>(null);
  const [water, setWater] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, w] = await Promise.all([listEntries(db, date), getWaterTotal(db, date)]);
      setEntries(e);
      setWater(w);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this day.");
    }
  }, [db, date]);

  useEffect(() => {
    load();
  }, [load]);

  const changeDate = (d: string) => {
    setEntries(null);
    setDate(d);
  };

  const totals = sumNutrients(entries ?? []);
  const imperial = profile.unit_system === "imperial";
  const waterSteps = imperial
    ? [
        { ml: 237, label: "+ 8 fl oz" },
        { ml: 473, label: "+ 16 fl oz" },
      ]
    : [
        { ml: 250, label: "+ 250 ml" },
        { ml: 500, label: "+ 500 ml" },
      ];

  async function changeWater(action: () => Promise<void>) {
    try {
      await action();
      setWater(await getWaterTotal(db, date));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update water.");
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <button className="icon-btn" onClick={() => changeDate(addDays(date, -1))} aria-label="Previous day">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-semibold tracking-tight" aria-live="polite">
          {friendlyDate(date, today)}
        </h1>
        <button
          className="icon-btn"
          onClick={() => changeDate(addDays(date, 1))}
          disabled={date >= today}
          aria-label="Next day"
        >
          <ChevronRight size={22} />
        </button>
      </header>

      <ErrorNote>{error}</ErrorNote>

      {entries === null ? (
        <Spinner />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <HeadlineCard
              title="Calories"
              unit="kcal"
              value={totals.calories}
              target={profile.target_calories}
              tone="accent"
              limit
            />
            <HeadlineCard
              title="Protein"
              unit="g"
              value={totals.protein_g}
              target={profile.target_protein_g}
              tone="protein"
            />
          </div>

          <section className="card grid grid-cols-3 gap-4" aria-label="Other nutrients">
            <MiniStat label="Carbs" value={totals.carbs_g} target={profile.target_carbs_g} />
            <MiniStat label="Fat" value={totals.fat_g} target={profile.target_fat_g} />
            <MiniStat label="Fiber" value={totals.fiber_g} target={profile.target_fiber_g} />
          </section>

          <section className="card" aria-label="Water">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-medium">
                <Droplet size={18} className="text-water" aria-hidden="true" /> Water
              </div>
              <div className="text-sm tabular-nums text-muted">
                <span className="font-semibold text-ink">{formatWater(water, profile.unit_system)}</span> of{" "}
                {formatWater(profile.target_water_ml, profile.unit_system)}
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar value={water} max={profile.target_water_ml} label="Water" tone="water" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {waterSteps.map((s) => (
                <button key={s.ml} className="btn-secondary" onClick={() => changeWater(() => addWater(db, date, s.ml))}>
                  {s.label}
                </button>
              ))}
              <button
                className="btn-ghost ml-auto"
                disabled={water === 0}
                onClick={() => changeWater(() => undoWater(db, date))}
              >
                <Undo2 size={16} aria-hidden="true" /> Undo
              </button>
            </div>
          </section>

          <section aria-label="Food log" className="space-y-3">
            <div className="flex items-center justify-between pt-2">
              <h2 className="text-lg font-semibold">Food</h2>
              <Link href={`/log?date=${date}`} className="btn-primary">
                <Plus size={18} aria-hidden="true" /> Log food
              </Link>
            </div>

            {entries.length === 0 ? (
              <div className="card py-8 text-center">
                <p className="font-medium">Nothing logged {date === today ? "yet today" : "on this day"}</p>
                <p className="hint mt-1">Describe a meal, snap a photo or scan a barcode to get started.</p>
              </div>
            ) : (
              MEALS.filter((m) => entries.some((e) => e.meal === m)).map((meal) => {
                const items = entries.filter((e) => e.meal === meal);
                return (
                  <div key={meal} className="card p-0">
                    <div className="flex items-baseline justify-between px-4 pb-1 pt-3">
                      <h3 className="font-semibold">{MEAL_LABELS[meal]}</h3>
                      <span className="text-sm tabular-nums text-muted">
                        {fmt(sumNutrients(items).calories)} kcal
                      </span>
                    </div>
                    <ul>
                      {items.map((e) => (
                        <li key={e.id} className="border-t border-line first:border-t-0">
                          <button
                            className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 px-4 py-2 text-left hover:bg-surface-2"
                            onClick={() => setEditing(e)}
                            aria-label={`Edit ${e.name}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{e.name}</span>
                              <span className="hint">{formatAmount(e)}</span>
                            </span>
                            <span className="shrink-0 text-right text-sm tabular-nums">
                              <span className="block font-semibold">{fmt(e.calories)} kcal</span>
                              <span className="text-protein">{fmt(e.protein_g)} g protein</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </section>
        </>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Edit entry">
        {editing && (
          <EditEntry
            key={editing.id}
            entry={editing}
            onDone={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function HeadlineCard({
  title,
  unit,
  value,
  target,
  tone,
  limit = false,
}: {
  title: string;
  unit: string;
  value: number;
  target: number;
  tone: "accent" | "protein";
  /** True when going over the target is undesirable. */
  limit?: boolean;
}) {
  const diff = target - value;
  const status =
    diff >= 0
      ? `${fmt(diff)} ${unit} ${limit ? "left" : "to go"}`
      : limit
        ? `${fmt(-diff)} ${unit} over`
        : "Target reached";
  return (
    <section className="card" aria-label={title}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium text-muted">{title}</h2>
        <span className={`text-sm font-medium ${diff < 0 && limit && value > target * 1.05 ? "text-warn" : "text-muted"}`}>
          {status}
        </span>
      </div>
      <p className="mb-3 mt-1 tabular-nums">
        <span className="text-4xl font-semibold tracking-tight">{fmt(value)}</span>
        <span className="text-muted">
          {" "}
          / {fmt(target)} {unit}
        </span>
      </p>
      <ProgressBar value={value} max={target} label={title} tone={tone} size="lg" />
    </section>
  );
}

function MiniStat({ label, value, target }: { label: string; value: number; target: number }) {
  return (
    <div>
      <div className="text-sm text-muted">{label}</div>
      <div className="mb-2 tabular-nums">
        <span className="font-semibold">{fmt(value)}</span>
        <span className="text-sm text-muted"> / {fmt(target)} g</span>
      </div>
      <ProgressBar value={value} max={target} label={label} tone="neutral" size="sm" />
    </div>
  );
}

function EditEntry({ entry, onDone }: { entry: FoodEntry; onDone: () => void }) {
  const { db } = useApp();
  const [draft, setDraft] = useState<FoodDraft>({
    name: entry.name,
    quantity: Number(entry.quantity),
    unit: entry.unit,
    calories: Number(entry.calories),
    protein_g: Number(entry.protein_g),
    carbs_g: Number(entry.carbs_g),
    fat_g: Number(entry.fat_g),
    fiber_g: Number(entry.fiber_g),
  });
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favourited, setFavourited] = useState(false);

  async function run(action: () => Promise<void>, close = true) {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (close) onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <DraftFields draft={draft} onChange={setDraft} />
      <div>
        <label htmlFor="edit-meal" className="label">
          Meal
        </label>
        <select id="edit-meal" className="input" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
          {MEALS.map((m) => (
            <option key={m} value={m}>
              {MEAL_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary flex-1"
          disabled={busy || !draft.name.trim()}
          onClick={() => run(() => updateEntry(db, entry.id, { ...draft, meal }))}
        >
          Save
        </button>
        <button
          className="btn-secondary"
          disabled={busy || favourited || !draft.name.trim()}
          onClick={() =>
            run(async () => {
              await saveFood(db, draft);
              setFavourited(true);
            }, false)
          }
        >
          <Star size={16} aria-hidden="true" fill={favourited ? "currentColor" : "none"} />
          {favourited ? "Saved" : "Save as favourite"}
        </button>
        <button className="btn-danger" disabled={busy} onClick={() => run(() => deleteEntries(db, [entry.id]))}>
          <Trash2 size={16} aria-hidden="true" /> Delete
        </button>
      </div>
    </div>
  );
}
