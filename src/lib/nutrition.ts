import type { ActivityLevel, Goal, Sex, Targets } from "./types";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export type BmiCategory = "Underweight" | "Healthy weight" | "Overweight" | "Obesity";

export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return "Underweight";
  if (value < 25) return "Healthy weight";
  if (value < 30) return "Overweight";
  return "Obesity";
}

/** Basal metabolic rate, Mifflin-St Jeor equation. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

export function maintenanceCalories(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number,
  activity: ActivityLevel,
): number {
  return bmr(sex, weightKg, heightCm, age) * ACTIVITY_FACTORS[activity];
}

const CALORIE_FACTOR: Record<Exclude<Goal, "pregnancy">, number> = {
  weight_loss: 0.8,
  build_muscle: 1.1,
  increase_mass: 1.18,
  recomposition: 0.92,
  maintenance: 1,
};

const PROTEIN_PER_KG: Record<Goal, number> = {
  weight_loss: 1.8,
  build_muscle: 1.8,
  increase_mass: 1.6,
  recomposition: 2.0,
  maintenance: 1.4,
  pregnancy: 1.1,
};

const PREGNANCY_EXTRA_KCAL = { 1: 0, 2: 340, 3: 450 } as const;

export interface TargetInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activity: ActivityLevel;
  goal: Goal;
  trimester?: 1 | 2 | 3 | null;
}

export function calculateTargets(input: TargetInput): Targets {
  const { weightKg, heightCm, age, activity, goal } = input;
  const sex: Sex = goal === "pregnancy" ? "female" : input.sex;
  const maintenance = maintenanceCalories(sex, weightKg, heightCm, age, activity);

  let calories: number;
  if (goal === "pregnancy") {
    calories = maintenance + PREGNANCY_EXTRA_KCAL[input.trimester ?? 1];
  } else {
    calories = maintenance * CALORIE_FACTOR[goal];
    if (goal === "weight_loss" || goal === "recomposition") {
      // Never suggest less than commonly used safe minimums.
      calories = Math.max(calories, sex === "male" ? 1500 : 1200);
    }
  }
  calories = Math.round(calories / 10) * 10;

  let protein = PROTEIN_PER_KG[goal] * weightKg;
  if (goal === "pregnancy") protein = Math.max(protein, 71);
  // Keep protein from crowding out everything else at very high body weights.
  protein = Math.min(protein, (calories * 0.4) / 4);
  protein = Math.round(protein);

  const fat = Math.round((calories * 0.28) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((calories / 1000) * 14);
  const water = Math.round((weightKg * 35) / 50) * 50 + (goal === "pregnancy" ? 300 : 0);

  return {
    target_calories: calories,
    target_protein_g: protein,
    target_carbs_g: carbs,
    target_fat_g: fat,
    target_fiber_g: fiber,
    target_water_ml: water,
  };
}
