import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/** Browser client. Sessions are kept in local storage and refreshed automatically. */
export function getSupabase(): SupabaseClient {
  if (!url || !key) throw new Error("Supabase is not configured. Copy .env.example to .env.local.");
  client ??= createClient(url, key);
  return client;
}

/** Calls one of this app's /api routes as the signed-in user. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await getSupabase().auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(path, { ...init, headers });
}
