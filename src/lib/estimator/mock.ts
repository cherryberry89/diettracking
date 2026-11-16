import type { FoodDraft, Meal } from "../types";
import { FOODS, type FoodRef } from "./foods";
import type { EstimateResult, FoodEstimator } from "./types";

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5, couple: 2, few: 3, some: 1,
};

const MASS_UNITS: Record<string, { grams: number; label: string }> = {
  g: { grams: 1, label: "g" }, gr: { grams: 1, label: "g" }, gram: { grams: 1, label: "g" },
  kg: { grams: 1000, label: "kg" },
  ml: { grams: 1, label: "ml" }, l: { grams: 1000, label: "l" },
  liter: { grams: 1000, label: "l" }, litre: { grams: 1000, label: "l" },
  oz: { grams: 28.35, label: "oz" }, ounce: { grams: 28.35, label: "oz" },
  lb: { grams: 453.6, label: "lb" }, pound: { grams: 453.6, label: "lb" },
  tbsp: { grams: 15, label: "tbsp" }, tablespoon: { grams: 15, label: "tbsp" },
  tsp: { grams: 5, label: "tsp" }, teaspoon: { grams: 5, label: "tsp" },
  handful: { grams: 30, label: "handful" },
  bottle: { grams: 500, label: "bottle" },
};

/** Units whose weight depends on the food; value is the fallback in grams. */
const FOOD_UNITS: Record<string, { key: keyof NonNullable<FoodRef["units"]> | "serving"; fallback?: number; label: string }> = {
  cup: { key: "cup", fallback: 240, label: "cup" },
  bowl: { key: "bowl", fallback: 300, label: "bowl" },
  glass: { key: "glass", fallback: 250, label: "glass" },
  can: { key: "can", fallback: 330, label: "can" },
  scoop: { key: "scoop", fallback: 30, label: "scoop" },
  slice: { key: "slice", label: "slice" },
  piece: { key: "piece", label: "piece" },
  pc: { key: "piece", label: "piece" },
  serving: { key: "serving", label: "serving" },
  portion: { key: "serving", label: "serving" },
  plate: { key: "serving", label: "serving" },
};

const UNIT_PATTERN =
  "kg|grams?|gr|g|ml|liters?|litres?|l|oz|ounces?|lbs?|pounds?|cups?|tbsp|tablespoons?|tsp|teaspoons?|slices?|pieces?|pcs?|bowls?|glass(?:es)?|cans?|servings?|portions?|plates?|scoops?|handfuls?|bottles?";

const QUANTITY_RE = new RegExp(
  "^(?:(\\d+(?:[.,]\\d+)?)(?:\\s*/\\s*(\\d+))?|(half(?: an?)?|a couple(?: of)?|a few|an?|one|two|three|four|five|six|seven|eight|nine|ten|some)\\b)?" +
    "\\s*(?:(" + UNIT_PATTERN + ")(?![a-z]))?\\s*(?:of\\s+)?",
  "i",
);

const SIZE_FACTORS: Record<string, number> = { small: 0.8, medium: 1, large: 1.25, big: 1.25 };

const MEAL_WORDS: [RegExp, Meal][] = [
  [/\bbreakfast\b|\bbrunch\b/i, "breakfast"],
  [/\blunch\b/i, "lunch"],
  [/\bdinner\b|\bsupper\b/i, "dinner"],
  [/\bsnacks?\b/i, "snack"],
];

const FILLER_RE =
  /\b(i|i've|ive|just|also|then|today|this morning|tonight|ate|had|have|eaten|drank|drunk|got|for (?:my )?(?:breakfast|brunch|lunch|dinner|supper|snack|a snack|dessert)|as a snack|my|about|around|roughly|approximately|approx|plus)\b/gi;

interface Alias {
  alias: string;
  re: RegExp;
  food: FoodRef;
}

const ALIASES: Alias[] = FOODS.flatMap((food) =>
  food.aliases.map((alias) => ({
    alias,
    food,
    re: new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:e?s)?\\b`, "i"),
  })),
).sort((a, b) => b.alias.length - a.alias.length);

function singular(unit: string): string {
  const u = unit.toLowerCase();
  if (u === "glasses" || u === "glass") return "glass";
  if (u === "lbs") return "lb";
  if (u === "pcs") return "pc";
  return u.length > 2 && u.endsWith("s") ? u.slice(0, -1) : u;
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

function fromGrams(food: FoodRef, grams: number): Omit<FoodDraft, "name" | "quantity" | "unit" | "confidence"> {
  const f = grams / 100;
  return {
    calories: Math.round(food.kcal * f),
    protein_g: round(food.protein * f),
    carbs_g: round(food.carbs * f),
    fat_g: round(food.fat * f),
    fiber_g: round(food.fiber * f),
  };
}

/** Parses one phrase such as "2 slices of toast" or "200g chicken breast". */
export function parseSegment(raw: string): FoodDraft | null {
  let text = raw.toLowerCase().replace(FILLER_RE, " ").replace(/[.!?()]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const m = QUANTITY_RE.exec(text);
  let quantity: number | null = null;
  let unit: string | null = null;
  if (m) {
    if (m[1]) {
      quantity = parseFloat(m[1].replace(",", "."));
      if (m[2]) quantity /= parseFloat(m[2]);
    } else if (m[3]) {
      const word = m[3].split(" ").find((w) => w in NUMBER_WORDS && w !== "a") ?? "a";
      quantity = NUMBER_WORDS[word];
    }
    if (m[4]) unit = singular(m[4]);
    text = text.slice(m[0].length).trim();
  }

  let sizeFactor = 1;
  text = text.replace(/\b(small|medium|large|big)\b/, (w) => {
    sizeFactor = SIZE_FACTORS[w];
    return "";
  }).replace(/\s+/g, " ").trim();
  if (!text) return null;

  const hit = ALIASES.find((a) => a.re.test(text));
  if (!hit) {
    return {
      name: text.charAt(0).toUpperCase() + text.slice(1),
      quantity: quantity ?? 1,
      unit: unit && MASS_UNITS[unit] ? MASS_UNITS[unit].label : "serving",
      calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0,
      confidence: "none",
    };
  }

  const food = hit.food;
  const q = quantity ?? 1;
  let grams: number;
  let label: string;
  let confidence: FoodDraft["confidence"] = "medium";

  if (unit && MASS_UNITS[unit]) {
    grams = q * MASS_UNITS[unit].grams;
    label = MASS_UNITS[unit].label;
    if (["g", "kg", "ml", "l", "oz", "lb"].includes(label)) confidence = "high";
  } else if (unit && FOOD_UNITS[unit]) {
    const u = FOOD_UNITS[unit];
    const per =
      u.key === "serving"
        ? food.serving
        : food.units?.[u.key] ?? u.fallback ?? food.serving;
    grams = q * per;
    label = u.label;
  } else {
    const perPiece = food.units?.piece;
    grams = q * (perPiece ?? food.serving);
    label = perPiece ? "piece" : "serving";
  }
  grams *= sizeFactor;

  return { name: food.name, quantity: round(q, 2), unit: label, ...fromGrams(food, grams), confidence };
}

export function parseMealText(text: string): { items: FoodDraft[]; meal?: Meal } {
  const meal = MEAL_WORDS.find(([re]) => re.test(text))?.[1];
  // Keep dish names that contain "and" together while splitting the list.
  const protectedText = text
    .toLowerCase()
    .replace(/mac and cheese/g, "mac_and_cheese")
    .replace(/fish and chips/g, "fish_and_chips");
  const items = protectedText
    .split(/,|;|\n|\+|&|\band\b|\bwith\b/)
    .map((s) => s.replace(/_and_/g, " and "))
    .map(parseSegment)
    .filter((x): x is FoodDraft => x !== null);
  return { items, meal };
}

export class MockEstimator implements FoodEstimator {
  readonly name = "placeholder";

  async fromText(text: string): Promise<EstimateResult> {
    const { items, meal } = parseMealText(text);
    if (items.length === 0) {
      return { items, meal, message: "I couldn't find any food in that. Try something like “2 eggs and a slice of toast”." };
    }
    const unknown = items.filter((i) => i.confidence === "none");
    const message =
      unknown.length === 0
        ? "Here's my estimate. Adjust anything that looks off, then add it to your log."
        : unknown.length === items.length
          ? "I don't know these foods yet, so please fill in the values before adding them."
          : `I estimated what I recognised. Please fill in the values for ${unknown.map((u) => u.name.toLowerCase()).join(", ")}.`;
    return { items, meal, message };
  }

  async fromImage(): Promise<EstimateResult> {
    return {
      items: [],
      needsDescription: true,
      message:
        "Photo saved. Automatic photo recognition isn't connected yet, so tell me what's on the plate and I'll estimate it and attach the photo to the entry.",
    };
  }
}
