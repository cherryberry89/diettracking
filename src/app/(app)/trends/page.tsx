"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "@/components/app-context";
import { ErrorNote, NumberInput, Segmented, Spinner } from "@/components/ui";
import { addDays, parseLocalDate, shortDate, toLocalDate } from "@/lib/dates";
import { deleteWeight, listDayTotals, listWeights, saveWeight, type DayTotal } from "@/lib/db";
import { bmi, bmiCategory } from "@/lib/nutrition";
import type { WeightLog } from "@/lib/types";
import { formatWeight, kgToLb, lbToKg, round1 } from "@/lib/units";

type Range = "7" | "30";
const fmt = (n: number) => Math.round(n).toLocaleString();

const AXIS = { fontSize: 12, fill: "var(--muted)" };

export default function TrendsPage() {
  const { db, profile, refresh } = useApp();
  const [today] = useState(() => toLocalDate());
  const [range, setRange] = useState<Range>("7");
  const [totals, setTotals] = useState<DayTotal[] | null>(null);
  const [weights, setWeights] = useState<WeightLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = Number(range);
  const from = addDays(today, -(days - 1));

  const load = useCallback(async () => {
    try {
      const [t, w] = await Promise.all([listDayTotals(db, from, today), listWeights(db)]);
      setTotals(t);
      setWeights(w);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your trends.");
    }
  }, [db, from, today]);

  useEffect(() => {
    load();
  }, [load]);

  const series = Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    const t = totals?.find((x) => x.local_date === date);
    return { date, label: shortDate(date), weekday: parseLocalDate(date).toLocaleDateString(undefined, { weekday: "short" }), calories: t ? Math.round(t.calories) : 0, protein: t ? Math.round(t.protein_g) : 0, logged: !!t };
  });
  const loggedDays = series.filter((d) => d.logged);
  const avg = (key: "calories" | "protein") =>
    loggedDays.length ? loggedDays.reduce((a, d) => a + d[key], 0) / loggedDays.length : 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Trends</h1>
        <Segmented
          label="Time range"
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
          ]}
        />
      </header>
      <ErrorNote>{error}</ErrorNote>

      {totals === null || weights === null ? (
        <Spinner />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <IntakeChart
              title="Calories"
              unit="kcal"
              data={series}
              dataKey="calories"
              target={profile.target_calories}
              average={avg("calories")}
              loggedDays={loggedDays.length}
              color="var(--accent)"
            />
            <IntakeChart
              title="Protein"
              unit="g"
              data={series}
              dataKey="protein"
              target={profile.target_protein_g}
              average={avg("protein")}
              loggedDays={loggedDays.length}
              color="var(--protein)"
            />
          </div>
          <WeightSection
            weights={weights}
            today={today}
            onSave={async (date, kg) => {
              await saveWeight(db, date, kg);
              await Promise.all([load(), refresh()]);
            }}
            onDelete={async (date) => {
              await deleteWeight(db, date);
              await Promise.all([load(), refresh()]);
            }}
          />
        </>
      )}
    </div>
  );
}

interface Point {
  date: string;
  label: string;
  weekday: string;
  calories: number;
  protein: number;
  logged: boolean;
}

function IntakeChart({
  title,
  unit,
  data,
  dataKey,
  target,
  average,
  loggedDays,
  color,
}: {
  title: string;
  unit: string;
  data: Point[];
  dataKey: "calories" | "protein";
  target: number;
  average: number;
  loggedDays: number;
  color: string;
}) {
  const max = Math.max(target, ...data.map((d) => d[dataKey]));
  // Round the axis to "nice" steps (1, 2, 2.5 or 5 × a power of ten) so tick labels are easy to read.
  const rawStep = (max * 1.08) / 3;
  const pow = 10 ** Math.floor(Math.log10(rawStep));
  const tickStep = [1, 2, 2.5, 5, 10].find((m) => m * pow >= rawStep)! * pow;
  const ticks = [0, tickStep, tickStep * 2, tickStep * 3];
  return (
    <section className="card" aria-label={`${title} per day`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium">{title} per day</h2>
        <span className="text-sm text-muted">Target {fmt(target)} {unit}</span>
      </div>
      <p className="mt-1 tabular-nums">
        <span className="text-2xl font-semibold">{loggedDays ? fmt(average) : "–"}</span>
        <span className="text-sm text-muted">
          {" "}
          {unit} average{loggedDays ? ` over ${loggedDays} logged day${loggedDays === 1 ? "" : "s"}` : ""}
        </span>
      </p>
      {loggedDays === 0 ? (
        <p className="hint py-10 text-center">Nothing logged in this period yet.</p>
      ) : (
        <div className="mt-3 h-48" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={data.length > 10 ? 2 : "22%"}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis
                dataKey="label"
                tick={AXIS}
                tickLine={false}
                axisLine={{ stroke: "var(--line)" }}
                interval={data.length > 10 ? Math.ceil(data.length / 5) - 1 : 0}
                tickFormatter={(_: string, i: number) => (data.length > 10 ? data[i].label : data[i].weekday)}
              />
              <YAxis width={44} tick={AXIS} tickLine={false} axisLine={false} domain={[0, tickStep * 3]} ticks={ticks} />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as Point | undefined;
                  if (!active || !p) return null;
                  return (
                    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-md">
                      <div className="text-muted">{p.label}</div>
                      <div className="font-semibold tabular-nums">
                        {p.logged ? `${fmt(p[dataKey])} ${unit}` : "Nothing logged"}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
              <ReferenceLine y={target} stroke="var(--ink)" strokeDasharray="4 4" strokeOpacity={0.55} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {loggedDays > 0 && (
        <>
          <p className="hint mt-2 text-xs">Dashed line: your daily target.</p>
          <table className="sr-only">
            <caption>
              {title} per day, target {target} {unit}
            </caption>
            <thead>
              <tr>
                <th>Day</th>
                <th>
                  {title} ({unit})
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td>{d.label}</td>
                  <td>{d.logged ? d[dataKey] : "not logged"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function WeightSection({
  weights,
  today,
  onSave,
  onDelete,
}: {
  weights: WeightLog[];
  today: string;
  onSave: (date: string, kg: number) => Promise<void>;
  onDelete: (date: string) => Promise<void>;
}) {
  const { profile } = useApp();
  const imperial = profile.unit_system === "imperial";
  const unit = imperial ? "lb" : "kg";
  const show = (kg: number) => round1(imperial ? kgToLb(kg) : kg);
  const [date, setDate] = useState(today);
  const [value, setValue] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = weights.at(-1);
  const first = weights[0];
  const change = latest && first && weights.length > 1 ? latest.weight_kg - first.weight_kg : null;
  const data = weights.map((w) => ({ label: shortDate(w.log_date), value: show(w.weight_kg) }));
  const values = data.map((d) => d.value);
  const pad = Math.max(1, (Math.max(...values) - Math.min(...values)) * 0.25);
  const currentBmi = latest ? bmi(latest.weight_kg, profile.height_cm) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const kg = imperial ? lbToKg(value) : value;
    if (!(kg >= 30 && kg <= 300)) {
      return setError(imperial ? "Enter a weight between 66 and 660 lb." : "Enter a weight between 30 and 300 kg.");
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(date, kg);
      setValue(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-4" aria-label="Weight">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="font-medium">Weight</h2>
          <p className="mt-1 tabular-nums">
            <span className="text-2xl font-semibold">
              {latest ? formatWeight(latest.weight_kg, profile.unit_system) : "–"}
            </span>
            {change !== null && (
              <span className="text-sm text-muted">
                {" "}
                {change === 0 ? "no change" : `${change > 0 ? "+" : "−"}${Math.abs(show(change))} ${unit}`} since{" "}
                {shortDate(first.log_date)}
              </span>
            )}
          </p>
        </div>
        {currentBmi !== null && (
          <div className="text-right">
            <div className="text-sm text-muted">Approximate BMI</div>
            <div className="tabular-nums">
              <span className="font-semibold">{currentBmi.toFixed(1)}</span>
              {profile.goal !== "pregnancy" && <span className="text-sm text-muted"> · {bmiCategory(currentBmi)}</span>}
            </div>
          </div>
        )}
      </div>

      {data.length >= 2 ? (
        <div className="h-52" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--line)" }} minTickGap={28} />
              <YAxis
                width={44}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                domain={[Math.floor(Math.min(...values) - pad), Math.ceil(Math.max(...values) + pad)]}
                tickCount={4}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as { label: string; value: number } | undefined;
                  if (!active || !p) return null;
                  return (
                    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-md">
                      <div className="text-muted">{p.label}</div>
                      <div className="font-semibold tabular-nums">
                        {p.value} {unit}
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--ink)"
                strokeWidth={2}
                dot={data.length <= 31 ? { r: 3.5, fill: "var(--ink)", stroke: "var(--surface)", strokeWidth: 2 } : false}
                activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="hint">Log your weight on a second day to see a chart of your progress.</p>
      )}

      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
        <div className="w-32">
          <label htmlFor="weigh-value" className="label">
            Weight ({unit})
          </label>
          <NumberInput id="weigh-value" value={value} onChange={setValue} />
        </div>
        <div>
          <label htmlFor="weigh-date" className="label">
            Date
          </label>
          <input
            id="weigh-date"
            type="date"
            className="input"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={busy || value <= 0}>
          {busy ? "Saving…" : "Log weight"}
        </button>
      </form>
      <ErrorNote>{error}</ErrorNote>

      {weights.length > 0 && (
        <details>
          <summary className="cursor-pointer py-2 text-sm font-medium text-muted hover:text-ink">
            All weigh-ins ({weights.length})
          </summary>
          <ul className="mt-1 divide-y divide-line">
            {[...weights].reverse().map((w) => (
              <li key={w.log_date} className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className="text-muted">{shortDate(w.log_date)}</span>
                <span className="ml-auto font-medium tabular-nums">{formatWeight(w.weight_kg, profile.unit_system)}</span>
                <button
                  className="icon-btn size-9"
                  aria-label={`Delete weigh-in from ${shortDate(w.log_date)}`}
                  disabled={weights.length === 1}
                  onClick={() => onDelete(w.log_date).catch((e: Error) => setError(e.message))}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
