import { MockEstimator } from "./mock";
import type { FoodEstimator } from "./types";

/** The single place to swap the placeholder for a real AI-backed estimator. */
export function getEstimator(): FoodEstimator {
  return new MockEstimator();
}

export type { EstimateResult, FoodEstimator } from "./types";
