import type { FoodDraft, Meal } from "../types";

export interface EstimateResult {
  items: FoodDraft[];
  /** Meal mentioned in the text ("for breakfast"), if any. */
  meal?: Meal;
  /** Short message shown to the user in the chat. */
  message: string;
  /** True when the estimator could not read the photo and needs a description. */
  needsDescription?: boolean;
}

/**
 * Turns what the user ate into structured food items.
 * The mock implementation lives in ./mock.ts; a real AI-backed one only has
 * to implement this interface and be returned from ./index.ts.
 */
export interface FoodEstimator {
  readonly name: string;
  fromText(text: string): Promise<EstimateResult>;
  /** `image` is the stored photo; implementations may fetch it via a signed URL. */
  fromImage(image: { path: string; signedUrl?: string }): Promise<EstimateResult>;
}
