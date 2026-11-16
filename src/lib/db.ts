import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EntrySource,
  FoodDraft,
  FoodEntry,
  Meal,
  Nutrients,
  Profile,
  SavedFood,
  WeightLog,
} from "./types";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const nutrientsOf = (d: Nutrients): Nutrients => ({
  calories: clamp(d.calories),
  protein_g: clamp(d.protein_g),
  carbs_g: clamp(d.carbs_g),
  fat_g: clamp(d.fat_g),
  fiber_g: clamp(d.fiber_g),
});
const clamp = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0);

export const sumNutrients = (items: Nutrients[]): Nutrients =>
  items.reduce(
    (acc, i) => ({
      calories: acc.calories + Number(i.calories),
      protein_g: acc.protein_g + Number(i.protein_g),
      carbs_g: acc.carbs_g + Number(i.carbs_g),
      fat_g: acc.fat_g + Number(i.fat_g),
      fiber_g: acc.fiber_g + Number(i.fiber_g),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  );

// Profile -------------------------------------------------------------------

export async function getProfile(db: SupabaseClient, userId: string): Promise<Profile | null> {
  return check(await db.from("profiles").select("*").eq("id", userId).maybeSingle());
}

export async function saveProfile(db: SupabaseClient, profile: Profile): Promise<Profile> {
  return check(
    await db
      .from("profiles")
      .upsert({ ...profile, updated_at: new Date().toISOString() })
      .select()
      .single(),
  );
}

// Food ----------------------------------------------------------------------

export async function listEntries(db: SupabaseClient, date: string): Promise<FoodEntry[]> {
  return check(
    await db.from("food_entries").select("*").eq("local_date", date).order("eaten_at", { ascending: true }),
  );
}

export type DayTotal = Nutrients & { local_date: string };

export async function listDayTotals(db: SupabaseClient, from: string, to: string): Promise<DayTotal[]> {
  const rows: (Nutrients & { local_date: string })[] = check(
    await db
      .from("food_entries")
      .select("local_date, calories, protein_g, carbs_g, fat_g, fiber_g")
      .gte("local_date", from)
      .lte("local_date", to),
  );
  const byDate = new Map<string, Nutrients[]>();
  for (const r of rows) byDate.set(r.local_date, [...(byDate.get(r.local_date) ?? []), r]);
  return [...byDate.entries()].map(([local_date, items]) => ({ local_date, ...sumNutrients(items) }));
}

export async function addEntries(
  db: SupabaseClient,
  drafts: FoodDraft[],
  meta: { date: string; meal: Meal; source: EntrySource; barcode?: string | null; photoPath?: string | null },
): Promise<FoodEntry[]> {
  const rows = drafts.map((d) => ({
    local_date: meta.date,
    meal: meta.meal,
    source: meta.source,
    barcode: meta.barcode ?? null,
    photo_path: meta.photoPath ?? null,
    name: d.name.trim().slice(0, 200) || "Food",
    quantity: Number.isFinite(d.quantity) && d.quantity > 0 ? d.quantity : 1,
    unit: d.unit || "serving",
    ...nutrientsOf(d),
  }));
  return check(await db.from("food_entries").insert(rows).select());
}

export async function updateEntry(
  db: SupabaseClient,
  id: string,
  patch: FoodDraft & { meal: Meal },
): Promise<void> {
  check(
    await db
      .from("food_entries")
      .update({
        name: patch.name.trim().slice(0, 200) || "Food",
        quantity: patch.quantity > 0 ? patch.quantity : 1,
        unit: patch.unit || "serving",
        meal: patch.meal,
        ...nutrientsOf(patch),
      })
      .eq("id", id)
      .select("id"),
  );
}

export async function deleteEntries(db: SupabaseClient, ids: string[]): Promise<void> {
  if (ids.length) check(await db.from("food_entries").delete().in("id", ids).select("id"));
}

/** Most recently logged distinct foods, for one-tap re-logging. */
export async function listRecentFoods(db: SupabaseClient, limit = 8): Promise<FoodDraft[]> {
  const rows: FoodEntry[] = check(
    await db.from("food_entries").select("*").order("created_at", { ascending: false }).limit(60),
  );
  const seen = new Set<string>();
  const out: FoodDraft[] = [];
  for (const r of rows) {
    const key = r.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: r.name, quantity: Number(r.quantity), unit: r.unit, ...nutrientsOf(r) });
    if (out.length >= limit) break;
  }
  return out;
}

// Saved foods ---------------------------------------------------------------

export async function listSavedFoods(db: SupabaseClient): Promise<SavedFood[]> {
  return check(await db.from("saved_foods").select("*").order("name"));
}

export async function saveFood(db: SupabaseClient, d: FoodDraft): Promise<void> {
  check(
    await db
      .from("saved_foods")
      .upsert(
        { name: d.name.trim().slice(0, 200), quantity: d.quantity, unit: d.unit, ...nutrientsOf(d) },
        { onConflict: "user_id,name" },
      )
      .select("id"),
  );
}

export async function deleteSavedFood(db: SupabaseClient, id: string): Promise<void> {
  check(await db.from("saved_foods").delete().eq("id", id).select("id"));
}

// Water ---------------------------------------------------------------------

export async function getWaterTotal(db: SupabaseClient, date: string): Promise<number> {
  const rows: { ml: number }[] = check(await db.from("water_logs").select("ml").eq("local_date", date));
  return rows.reduce((a, r) => a + r.ml, 0);
}

export async function addWater(db: SupabaseClient, date: string, ml: number): Promise<void> {
  check(await db.from("water_logs").insert({ local_date: date, ml }).select("id"));
}

/** Removes the most recent water entry of the day. */
export async function undoWater(db: SupabaseClient, date: string): Promise<void> {
  const rows: { id: string }[] = check(
    await db.from("water_logs").select("id").eq("local_date", date).order("created_at", { ascending: false }).limit(1),
  );
  if (rows[0]) check(await db.from("water_logs").delete().eq("id", rows[0].id).select("id"));
}

// Weight --------------------------------------------------------------------

export async function listWeights(db: SupabaseClient, from?: string): Promise<WeightLog[]> {
  let q = db.from("weight_logs").select("log_date, weight_kg").order("log_date", { ascending: true });
  if (from) q = q.gte("log_date", from);
  const rows: WeightLog[] = check(await q);
  return rows.map((r) => ({ log_date: r.log_date, weight_kg: Number(r.weight_kg) }));
}

export async function getLatestWeight(db: SupabaseClient): Promise<WeightLog | null> {
  const rows: WeightLog[] = check(
    await db.from("weight_logs").select("log_date, weight_kg").order("log_date", { ascending: false }).limit(1),
  );
  return rows[0] ? { log_date: rows[0].log_date, weight_kg: Number(rows[0].weight_kg) } : null;
}

export async function saveWeight(db: SupabaseClient, date: string, weightKg: number): Promise<void> {
  check(
    await db
      .from("weight_logs")
      .upsert({ log_date: date, weight_kg: Math.round(weightKg * 100) / 100 }, { onConflict: "user_id,log_date" })
      .select("log_date"),
  );
}

export async function deleteWeight(db: SupabaseClient, date: string): Promise<void> {
  check(await db.from("weight_logs").delete().eq("log_date", date).select("log_date"));
}

// Photos --------------------------------------------------------------------

export async function uploadMealPhoto(db: SupabaseClient, userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await db.storage.from("meal-photos").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error(error.message);
  return path;
}

export async function getPhotoUrl(db: SupabaseClient, path: string): Promise<string | null> {
  const { data } = await db.storage.from("meal-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

// Account -------------------------------------------------------------------

/** Deletes everything the user has stored: logs, saved foods, photos and profile. */
export async function deleteAllData(db: SupabaseClient, userId: string): Promise<void> {
  const { data: files } = await db.storage.from("meal-photos").list(userId, { limit: 1000 });
  if (files?.length) {
    await db.storage.from("meal-photos").remove(files.map((f) => `${userId}/${f.name}`));
  }
  for (const table of ["food_entries", "water_logs", "weight_logs", "saved_foods"]) {
    check(await db.from(table).delete().eq("user_id", userId).select("user_id"));
  }
  check(await db.from("profiles").delete().eq("id", userId).select("id"));
}
