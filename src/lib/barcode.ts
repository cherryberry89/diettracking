import type { Nutrients } from "./types";

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand: string | null;
  /** Nutrients per 100 g (or per 100 ml for drinks). */
  per100: Nutrients;
  /** "g" or "ml" */
  baseUnit: "g" | "ml";
  servingQuantity: number | null;
  servingLabel: string | null;
}

interface OffProduct {
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  serving_quantity?: number | string;
  serving_size?: string;
  quantity?: string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Converts an Open Food Facts product into the app's shape. Returns null when it has no usable nutrition data. */
export function normalizeOffProduct(barcode: string, p: OffProduct): BarcodeProduct | null {
  const n = p.nutriments ?? {};
  let kcal = num(n["energy-kcal_100g"]);
  if (!kcal && n["energy_100g"] !== undefined) kcal = num(n["energy_100g"]) / 4.184;
  const hasData = ["energy-kcal_100g", "energy_100g", "proteins_100g", "carbohydrates_100g", "fat_100g"].some(
    (k) => n[k] !== undefined && n[k] !== "",
  );
  if (!hasData) return null;

  const name = (p.product_name || p.product_name_en || p.generic_name || "").trim();
  const serving = num(p.serving_quantity);
  const isDrink = /\d\s*(ml|cl|l)\b/i.test(`${p.serving_size ?? ""} ${p.quantity ?? ""}`);

  return {
    barcode,
    name: name || "Unnamed product",
    brand: p.brands?.split(",")[0]?.trim() || null,
    per100: {
      calories: Math.round(kcal),
      protein_g: Math.round(num(n["proteins_100g"]) * 10) / 10,
      carbs_g: Math.round(num(n["carbohydrates_100g"]) * 10) / 10,
      fat_g: Math.round(num(n["fat_100g"]) * 10) / 10,
      fiber_g: Math.round(num(n["fiber_100g"]) * 10) / 10,
    },
    baseUnit: isDrink ? "ml" : "g",
    servingQuantity: serving > 0 ? serving : null,
    servingLabel: p.serving_size?.trim() || null,
  };
}

export function scaleNutrients(per100: Nutrients, amount: number): Nutrients {
  const f = amount / 100;
  const r1 = (x: number) => Math.round(x * f * 10) / 10;
  return {
    calories: Math.round(per100.calories * f),
    protein_g: r1(per100.protein_g),
    carbs_g: r1(per100.carbs_g),
    fat_g: r1(per100.fat_g),
    fiber_g: r1(per100.fiber_g),
  };
}
