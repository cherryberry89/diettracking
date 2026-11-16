export type UnitSystem = "metric" | "imperial";
export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type Goal =
  | "weight_loss"
  | "build_muscle"
  | "increase_mass"
  | "recomposition"
  | "maintenance"
  | "pregnancy";
export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export type EntrySource = "text" | "photo" | "barcode" | "saved" | "manual";

export interface Nutrients {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface Targets {
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  target_fiber_g: number;
  target_water_ml: number;
}

export interface Profile extends Targets {
  id: string;
  unit_system: UnitSystem;
  height_cm: number;
  sex: Sex;
  birth_year: number;
  activity_level: ActivityLevel;
  goal: Goal;
  trimester: 1 | 2 | 3 | null;
}

/** A food item proposed by text, photo, barcode or a saved food, before it is logged. */
export interface FoodDraft extends Nutrients {
  name: string;
  quantity: number;
  unit: string;
  /** How sure the estimator is. "none" means the user has to fill in the values. */
  confidence?: "high" | "medium" | "none";
}

export interface FoodEntry extends FoodDraft {
  id: string;
  user_id: string;
  local_date: string;
  eaten_at: string;
  meal: Meal;
  source: EntrySource;
  barcode: string | null;
  photo_path: string | null;
}

export interface SavedFood extends Nutrients {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface WeightLog {
  log_date: string;
  weight_kg: number;
}

export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];
export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export const GOAL_INFO: Record<Goal, { label: string; description: string }> = {
  weight_loss: {
    label: "Weight loss",
    description: "A moderate calorie deficit with high protein to protect muscle.",
  },
  build_muscle: {
    label: "Build muscle",
    description: "A small surplus and plenty of protein to support training.",
  },
  increase_mass: {
    label: "Increase mass",
    description: "A larger surplus for gaining overall body weight.",
  },
  recomposition: {
    label: "Body recomposition",
    description: "Lose fat and gain muscle together: a slight deficit, very high protein.",
  },
  maintenance: {
    label: "Maintenance",
    description: "Hold your current weight with balanced macros.",
  },
  pregnancy: {
    label: "Pregnancy",
    description: "Extra energy by trimester and never a deficit.",
  },
};

export const ACTIVITY_INFO: Record<ActivityLevel, { label: string; description: string }> = {
  sedentary: { label: "Sedentary", description: "Desk job, little exercise" },
  light: { label: "Lightly active", description: "Exercise 1–3 days a week" },
  moderate: { label: "Moderately active", description: "Exercise 3–5 days a week" },
  active: { label: "Very active", description: "Hard exercise 6–7 days a week" },
  very_active: { label: "Extremely active", description: "Physical job or twice-daily training" },
};
