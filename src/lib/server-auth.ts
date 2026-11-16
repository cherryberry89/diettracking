import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifies the bearer token sent by the web app (or, later, a native app)
 * and returns a Supabase client acting as that user.
 */
export async function authenticate(
  request: Request,
): Promise<{ userId: string; supabase: SupabaseClient } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return null;

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, supabase };
}

export const unauthorized = () => Response.json({ error: "Not signed in" }, { status: 401 });
