import { getEstimator } from "@/lib/estimator";
import { authenticate, unauthorized } from "@/lib/server-auth";

/**
 * POST { type: "text", text } or { type: "image", path }
 * Returns the estimator's proposed food items. This is the only place the
 * estimator is called, so connecting a real AI model is a change here and in
 * src/lib/estimator/index.ts only.
 */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { type, text, path } = (body ?? {}) as { type?: string; text?: unknown; path?: unknown };
  const estimator = getEstimator();

  if (type === "text" && typeof text === "string" && text.trim()) {
    return Response.json(await estimator.fromText(text.slice(0, 2000)));
  }

  if (type === "image" && typeof path === "string") {
    // Users may only reference photos in their own folder.
    if (!path.startsWith(`${auth.userId}/`)) {
      return Response.json({ error: "Photo not found" }, { status: 404 });
    }
    const { data } = await auth.supabase.storage.from("meal-photos").createSignedUrl(path, 120);
    return Response.json(await estimator.fromImage({ path, signedUrl: data?.signedUrl }));
  }

  return Response.json({ error: "Invalid request" }, { status: 400 });
}
