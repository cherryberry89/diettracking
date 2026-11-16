"use client";

import { bmi, bmiCategory, calculateTargets } from "@/lib/nutrition";
import {
  ACTIVITY_INFO,
  GOAL_INFO,
  type ActivityLevel,
  type Goal,
  type Sex,
  type Targets,
  type UnitSystem,
} from "@/lib/types";
import { cmToFtIn, ftInToCm, kgToLb, lbToKg, mlToFlOz, round1 } from "@/lib/units";
import { NumberInput, Segmented } from "./ui";

export interface BodyState {
  unit_system: UnitSystem;
  heightCm: number;
  weightKg: number;
  age: number;
  sex: Sex;
  activity: ActivityLevel;
  goal: Goal;
  trimester: 1 | 2 | 3;
}

export const DEFAULT_BODY: BodyState = {
  unit_system: "metric",
  heightCm: 0,
  weightKg: 0,
  age: 0,
  sex: "female",
  activity: "light",
  goal: "maintenance",
  trimester: 1,
};

export function validateBody(b: BodyState): string | null {
  if (!(b.heightCm >= 120 && b.heightCm <= 230)) {
    return b.unit_system === "metric"
      ? "Enter a height between 120 and 230 cm."
      : "Enter a height between 4 ft and 7 ft 6 in.";
  }
  if (!(b.weightKg >= 30 && b.weightKg <= 300)) {
    return b.unit_system === "metric"
      ? "Enter a weight between 30 and 300 kg."
      : "Enter a weight between 66 and 660 lb.";
  }
  if (!(b.age >= 18 && b.age <= 100)) {
    return b.age > 0 && b.age < 18
      ? "This app is designed for adults aged 18 and over."
      : "Enter an age between 18 and 100.";
  }
  return null;
}

export const targetsFor = (b: BodyState): Targets =>
  calculateTargets({
    sex: b.sex,
    weightKg: b.weightKg,
    heightCm: b.heightCm,
    age: b.age,
    activity: b.activity,
    goal: b.goal,
    trimester: b.trimester,
  });

type Patch = (p: Partial<BodyState>) => void;

export function BodyFields({ body, patch }: { body: BodyState; patch: Patch }) {
  const imperial = body.unit_system === "imperial";
  const ftIn = cmToFtIn(body.heightCm);
  return (
    <div className="space-y-5">
      <div>
        <span className="label">Units</span>
        <Segmented
          label="Measurement system"
          value={body.unit_system}
          onChange={(unit_system) => patch({ unit_system })}
          options={[
            { value: "metric", label: "Metric (cm, kg)" },
            { value: "imperial", label: "Imperial (ft, lb)" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {imperial ? (
          <fieldset className="col-span-2 sm:col-span-1">
            <legend className="label">Height</legend>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <NumberInput
                  aria-label="Height, feet"
                  decimals={0}
                  value={body.heightCm ? ftIn.ft : 0}
                  onChange={(ft) => patch({ heightCm: ftInToCm(ft, body.heightCm ? ftIn.in : 0) })}
                  className="input pr-9"
                />
                <Suffix>ft</Suffix>
              </div>
              <div className="relative flex-1">
                <NumberInput
                  aria-label="Height, inches"
                  decimals={0}
                  value={body.heightCm ? ftIn.in : 0}
                  onChange={(inches) => patch({ heightCm: ftInToCm(body.heightCm ? ftIn.ft : 0, Math.min(inches, 11)) })}
                  className="input pr-9"
                  placeholder="0"
                />
                <Suffix>in</Suffix>
              </div>
            </div>
          </fieldset>
        ) : (
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="height" className="label">
              Height
            </label>
            <div className="relative">
              <NumberInput
                id="height"
                decimals={0}
                value={Math.round(body.heightCm)}
                onChange={(heightCm) => patch({ heightCm })}
                className="input pr-10"
              />
              <Suffix>cm</Suffix>
            </div>
          </div>
        )}

        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="weight" className="label">
            Weight
          </label>
          <div className="relative">
            <NumberInput
              id="weight"
              value={imperial ? round1(kgToLb(body.weightKg)) : round1(body.weightKg)}
              onChange={(n) => patch({ weightKg: imperial ? lbToKg(n) : n })}
              className="input pr-10"
            />
            <Suffix>{imperial ? "lb" : "kg"}</Suffix>
          </div>
        </div>

        <div>
          <label htmlFor="age" className="label">
            Age
          </label>
          <NumberInput id="age" decimals={0} value={body.age} onChange={(age) => patch({ age })} />
        </div>

        <div>
          <span className="label">Sex</span>
          <Segmented
            label="Sex"
            value={body.sex}
            onChange={(sex) => patch({ sex, ...(sex === "male" && body.goal === "pregnancy" ? { goal: "maintenance" } : {}) })}
            options={[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ]}
          />
        </div>
      </div>
      <p className="hint">Age and sex are used to estimate how many calories your body uses.</p>
    </div>
  );
}

function Suffix({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
      {children}
    </span>
  );
}

export function BmiCard({ body }: { body: BodyState }) {
  if (validateBody({ ...body, age: 30 })) return null;
  const value = bmi(body.weightKg, body.heightCm);
  const pregnant = body.goal === "pregnancy";
  // Position on a 15–40 scale for the marker.
  const pos = Math.min(100, Math.max(0, ((value - 15) / 25) * 100));
  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-muted">Approximate BMI</span>
        {!pregnant && <span className="text-sm font-semibold">{bmiCategory(value)}</span>}
      </div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value.toFixed(1)}</div>
      {!pregnant && (
        <div className="mt-3" aria-hidden="true">
          <div className="relative h-2 rounded-full bg-surface-2">
            <div className="absolute inset-y-0 rounded-full bg-accent/50" style={{ left: "14%", width: "26%" }} />
            <div
              className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink"
              style={{ left: `${pos}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted">
            <span>15</span>
            <span>Healthy range 18.5–25</span>
            <span>40</span>
          </div>
        </div>
      )}
      <p className="hint mt-3">
        {pregnant
          ? "BMI categories don't apply during pregnancy. Your clinician can tell you what weight gain is right for you."
          : "BMI is a rough screening number. It doesn't account for muscle, build or age."}
      </p>
    </div>
  );
}

export function ActivityPicker({ body, patch }: { body: BodyState; patch: Patch }) {
  return (
    <div role="radiogroup" aria-label="Activity level" className="space-y-2">
      {(Object.keys(ACTIVITY_INFO) as ActivityLevel[]).map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={body.activity === level}
          className="choice"
          onClick={() => patch({ activity: level })}
        >
          <span>
            <span className="block font-medium">{ACTIVITY_INFO[level].label}</span>
            <span className="hint">{ACTIVITY_INFO[level].description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function GoalPicker({ body, patch }: { body: BodyState; patch: Patch }) {
  const underweight = body.heightCm > 0 && body.weightKg > 0 && bmi(body.weightKg, body.heightCm) < 18.5;
  const goals = (Object.keys(GOAL_INFO) as Goal[]).filter((g) => g !== "pregnancy" || body.sex === "female");
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Goal" className="grid gap-2 sm:grid-cols-2">
        {goals.map((goal) => {
          const blocked = goal === "weight_loss" && underweight;
          return (
            <button
              key={goal}
              type="button"
              role="radio"
              aria-checked={body.goal === goal}
              disabled={blocked}
              className="choice disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => patch({ goal })}
            >
              <span>
                <span className="block font-medium">{GOAL_INFO[goal].label}</span>
                <span className="hint">
                  {blocked
                    ? "Not available: your BMI is already below the healthy range."
                    : GOAL_INFO[goal].description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {body.goal === "pregnancy" && (
        <div>
          <span className="label">Trimester</span>
          <Segmented
            label="Trimester"
            value={String(body.trimester) as "1" | "2" | "3"}
            onChange={(t) => patch({ trimester: Number(t) as 1 | 2 | 3 })}
            options={[
              { value: "1", label: "First" },
              { value: "2", label: "Second" },
              { value: "3", label: "Third" },
            ]}
          />
          <p className="hint mt-2">
            These are general figures. Follow your doctor or midwife&apos;s advice where it differs.
          </p>
        </div>
      )}
    </div>
  );
}

const TARGET_FIELDS: { key: keyof Targets; label: string; unit: string }[] = [
  { key: "target_calories", label: "Calories", unit: "kcal" },
  { key: "target_protein_g", label: "Protein", unit: "g" },
  { key: "target_carbs_g", label: "Carbs", unit: "g" },
  { key: "target_fat_g", label: "Fat", unit: "g" },
  { key: "target_fiber_g", label: "Fiber", unit: "g" },
  { key: "target_water_ml", label: "Water", unit: "ml" },
];

export function TargetsEditor({
  targets,
  onChange,
  unitSystem,
}: {
  targets: Targets;
  onChange: (t: Targets) => void;
  unitSystem: UnitSystem;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {TARGET_FIELDS.map(({ key, label, unit }) => (
        <div key={key}>
          <label htmlFor={key} className="label">
            {label}
          </label>
          <div className="relative">
            <NumberInput
              id={key}
              decimals={0}
              value={targets[key]}
              onChange={(n) => onChange({ ...targets, [key]: Math.round(n) })}
              className="input pr-12 tabular-nums"
            />
            <Suffix>{unit}</Suffix>
          </div>
          {key === "target_water_ml" && unitSystem === "imperial" && (
            <p className="hint mt-1">≈ {Math.round(mlToFlOz(targets.target_water_ml))} fl oz</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function validateTargets(t: Targets): string | null {
  if (!(t.target_calories >= 800 && t.target_calories <= 8000)) return "Daily calories should be between 800 and 8000.";
  if (!(t.target_protein_g >= 10 && t.target_protein_g <= 500)) return "Daily protein should be between 10 and 500 g.";
  if (t.target_water_ml > 10000) return "Daily water should be at most 10,000 ml.";
  return null;
}
