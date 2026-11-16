"use client";

import { useId, useState } from "react";
import type { FoodDraft, Nutrients } from "@/lib/types";
import { NumberInput } from "./ui";

const NUTRIENT_FIELDS: { key: keyof Nutrients; label: string; decimals: number }[] = [
  { key: "calories", label: "kcal", decimals: 0 },
  { key: "protein_g", label: "Protein", decimals: 1 },
  { key: "carbs_g", label: "Carbs", decimals: 1 },
  { key: "fat_g", label: "Fat", decimals: 1 },
  { key: "fiber_g", label: "Fiber", decimals: 1 },
];

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Editable fields for one food item. Changing the amount scales the
 * nutrients; editing a nutrient directly sets a new baseline to scale from.
 */
export function DraftFields({ draft, onChange }: { draft: FoodDraft; onChange: (d: FoodDraft) => void }) {
  const id = useId();
  const [base, setBase] = useState({ quantity: draft.quantity, nutrients: pick(draft) });

  function setQuantity(quantity: number) {
    if (quantity > 0 && base.quantity > 0) {
      const f = quantity / base.quantity;
      onChange({
        ...draft,
        quantity,
        calories: Math.round(base.nutrients.calories * f),
        protein_g: r1(base.nutrients.protein_g * f),
        carbs_g: r1(base.nutrients.carbs_g * f),
        fat_g: r1(base.nutrients.fat_g * f),
        fiber_g: r1(base.nutrients.fiber_g * f),
      });
    } else {
      onChange({ ...draft, quantity });
    }
  }

  function setNutrient(key: keyof Nutrients, value: number) {
    const next = { ...draft, [key]: value, confidence: draft.confidence === "none" ? "medium" : draft.confidence } as FoodDraft;
    setBase({ quantity: draft.quantity > 0 ? draft.quantity : base.quantity, nutrients: pick(next) });
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${id}-name`} className="label">
          Food
        </label>
        <input
          id={`${id}-name`}
          className="input"
          value={draft.name}
          maxLength={200}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-qty`} className="label">
            Amount
          </label>
          <NumberInput id={`${id}-qty`} decimals={2} value={draft.quantity} onChange={setQuantity} />
        </div>
        <div>
          <label htmlFor={`${id}-unit`} className="label">
            Unit
          </label>
          <input
            id={`${id}-unit`}
            className="input"
            value={draft.unit}
            maxLength={20}
            onChange={(e) => onChange({ ...draft, unit: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {NUTRIENT_FIELDS.map(({ key, label, decimals }) => (
          <div key={key}>
            <label htmlFor={`${id}-${key}`} className="mb-1 block text-xs font-medium text-muted">
              {label}
              {key !== "calories" && <span className="sr-only"> in grams</span>}
            </label>
            <NumberInput
              id={`${id}-${key}`}
              decimals={decimals}
              value={draft[key]}
              onChange={(n) => setNutrient(key, n)}
              className="input px-2 text-center tabular-nums"
              placeholder="0"
            />
          </div>
        ))}
      </div>
      <p className="hint text-xs">Changing the amount rescales the nutrition values.</p>
    </div>
  );
}

function pick(d: Nutrients): Nutrients {
  return { calories: d.calories, protein_g: d.protein_g, carbs_g: d.carbs_g, fat_g: d.fat_g, fiber_g: d.fiber_g };
}

export const formatAmount = (d: { quantity: number; unit: string }) => {
  const q = +Number(d.quantity).toFixed(2);
  const compact = ["g", "kg", "ml", "l", "oz", "lb"].includes(d.unit);
  const plural = !compact && q !== 1 && !d.unit.endsWith("s") && d.unit.length > 2 ? "s" : "";
  return compact ? `${q} ${d.unit}` : `${q} ${d.unit === "glass" && q !== 1 ? "glasses" : d.unit + plural}`;
};
