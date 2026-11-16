import { describe, expect, it } from "vitest";
import { parseMealText, parseSegment } from "./mock";

describe("parseSegment", () => {
  it("handles explicit grams", () => {
    const r = parseSegment("200g chicken breast")!;
    expect(r).toMatchObject({ name: "Chicken breast", quantity: 200, unit: "g", calories: 330, protein_g: 62, confidence: "high" });
  });
  it("handles counts and plurals", () => {
    expect(parseSegment("2 eggs")).toMatchObject({ name: "Boiled egg", quantity: 2, unit: "piece", calories: 155 });
    expect(parseSegment("three bananas")).toMatchObject({ name: "Banana", quantity: 3, calories: 320 });
  });
  it("handles articles without eating the food name", () => {
    expect(parseSegment("an apple")).toMatchObject({ name: "Apple", quantity: 1, unit: "piece" });
    expect(parseSegment("apple")).toMatchObject({ name: "Apple", quantity: 1 });
    expect(parseSegment("oatmeal")).toMatchObject({ name: "Oatmeal" });
    expect(parseSegment("lentils")).toMatchObject({ name: "Lentils" });
    expect(parseSegment("grapes")).toMatchObject({ name: "Grapes" });
  });
  it("handles food-specific units", () => {
    expect(parseSegment("2 slices of toast")).toMatchObject({ name: "White bread", quantity: 2, unit: "slice", calories: 159 });
    expect(parseSegment("a cup of rice")).toMatchObject({ name: "Cooked rice", unit: "cup", calories: 208 });
    expect(parseSegment("half a pizza")).toMatchObject({ name: "Pizza", quantity: 0.5 });
    expect(parseSegment("1/2 cup oats")).toMatchObject({ name: "Rolled oats", quantity: 0.5, unit: "cup" });
    expect(parseSegment("a glass of milk")).toMatchObject({ name: "Whole milk", unit: "glass" });
  });
  it("handles size words", () => {
    expect(parseSegment("2 large eggs")!.calories).toBe(194);
  });
  it("prefers the most specific food", () => {
    expect(parseSegment("greek yogurt")!.name).toBe("Greek yogurt");
    expect(parseSegment("1 tbsp peanut butter")).toMatchObject({ name: "Peanut butter", calories: 88 });
    expect(parseSegment("sweet potato")!.name).toBe("Sweet potato");
  });
  it("flags unknown foods", () => {
    expect(parseSegment("2 zorblaxes")).toMatchObject({ name: "Zorblaxes", quantity: 2, calories: 0, confidence: "none" });
  });
});

describe("parseMealText", () => {
  it("splits a sentence into items and finds the meal", () => {
    const r = parseMealText("For breakfast I had 2 eggs, a slice of toast with butter and a coffee");
    expect(r.meal).toBe("breakfast");
    expect(r.items.map((i) => i.name)).toEqual(["Boiled egg", "White bread", "Butter", "Black coffee"]);
  });
  it("keeps dishes containing 'and' together", () => {
    expect(parseMealText("mac and cheese and a salad").items.map((i) => i.name)).toEqual(["Mac and cheese", "Mixed salad"]);
  });
  it("returns nothing for empty text", () => {
    expect(parseMealText("  ").items).toEqual([]);
  });
});
