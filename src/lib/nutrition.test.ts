import { describe, expect, it } from "vitest";
import { bmi, bmiCategory, bmr, calculateTargets } from "./nutrition";
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from "./units";

const base = { sex: "male" as const, weightKg: 80, heightCm: 180, age: 30, activity: "moderate" as const };

describe("bmi", () => {
  it("computes kg/m²", () => {
    expect(bmi(80, 180)).toBeCloseTo(24.69, 2);
    expect(bmi(lbToKg(176.37), ftInToCm(5, 10.866))).toBeCloseTo(24.69, 1);
  });
  it("categorises", () => {
    expect(bmiCategory(17)).toBe("Underweight");
    expect(bmiCategory(22)).toBe("Healthy weight");
    expect(bmiCategory(27)).toBe("Overweight");
    expect(bmiCategory(31)).toBe("Obesity");
  });
});

describe("units", () => {
  it("round-trips", () => {
    expect(lbToKg(kgToLb(72.5))).toBeCloseTo(72.5, 6);
    expect(cmToFtIn(ftInToCm(5, 11))).toEqual({ ft: 5, in: 11 });
    expect(cmToFtIn(182.5)).toEqual({ ft: 6, in: 0 });
  });
});

describe("targets", () => {
  it("uses Mifflin-St Jeor", () => {
    expect(bmr("male", 80, 180, 30)).toBe(1780);
    expect(bmr("female", 60, 165, 30)).toBeCloseTo(1320.25);
  });
  it("maintenance", () => {
    const t = calculateTargets({ ...base, goal: "maintenance" });
    expect(t.target_calories).toBe(2760);
    expect(t.target_protein_g).toBe(112);
    expect(t.target_fat_g).toBe(86);
    expect(t.target_fiber_g).toBe(39);
    expect(t.target_water_ml).toBe(2800);
    // macros add up to roughly the calorie target
    const kcal = t.target_protein_g * 4 + t.target_carbs_g * 4 + t.target_fat_g * 9;
    expect(Math.abs(kcal - t.target_calories)).toBeLessThan(10);
  });
  it("orders goals sensibly", () => {
    const cal = (goal: Parameters<typeof calculateTargets>[0]["goal"]) =>
      calculateTargets({ ...base, goal }).target_calories;
    expect(cal("weight_loss")).toBeLessThan(cal("recomposition"));
    expect(cal("recomposition")).toBeLessThan(cal("maintenance"));
    expect(cal("maintenance")).toBeLessThan(cal("build_muscle"));
    expect(cal("build_muscle")).toBeLessThan(cal("increase_mass"));
    expect(calculateTargets({ ...base, goal: "recomposition" }).target_protein_g).toBe(160);
  });
  it("applies a calorie floor for weight loss", () => {
    const t = calculateTargets({ sex: "female", weightKg: 45, heightCm: 150, age: 60, activity: "sedentary", goal: "weight_loss" });
    expect(t.target_calories).toBe(1200);
  });
  it("pregnancy adds by trimester and never cuts", () => {
    const p = (trimester: 1 | 2 | 3) =>
      calculateTargets({ sex: "female", weightKg: 65, heightCm: 168, age: 31, activity: "light", goal: "pregnancy", trimester });
    const maintenance = calculateTargets({ sex: "female", weightKg: 65, heightCm: 168, age: 31, activity: "light", goal: "maintenance" });
    expect(p(1).target_calories).toBe(maintenance.target_calories);
    expect(p(2).target_calories - p(1).target_calories).toBe(340);
    expect(p(3).target_calories - p(1).target_calories).toBe(450);
    expect(p(1).target_protein_g).toBe(72);
    expect(calculateTargets({ sex: "female", weightKg: 50, heightCm: 160, age: 28, activity: "light", goal: "pregnancy", trimester: 2 }).target_protein_g).toBe(71);
  });
});
