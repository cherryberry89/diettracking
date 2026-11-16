import { normalizeOffProduct } from "@/lib/barcode";
import { authenticate, unauthorized } from "@/lib/server-auth";

const FIELDS = "product_name,product_name_en,generic_name,brands,serving_quantity,serving_size,quantity,nutriments";

/** GET /api/barcode/:code — looks a product up in the Open Food Facts database. */
export async function GET(request: Request, ctx: RouteContext<"/api/barcode/[code]">) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const { code } = await ctx.params;
  if (!/^\d{6,14}$/.test(code)) {
    return Response.json({ error: "That doesn't look like a product barcode." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`, {
      headers: { "User-Agent": "diet-tracker-app/0.1", Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return Response.json({ error: "The product database could not be reached. Try again in a moment." }, { status: 502 });
  }
  if (res.status === 404) return Response.json({ error: "Product not found." }, { status: 404 });
  if (!res.ok) {
    return Response.json({ error: "The product database returned an error. Try again in a moment." }, { status: 502 });
  }

  const data = (await res.json()) as { status?: number; product?: Record<string, unknown> };
  const product = data.status === 1 && data.product ? normalizeOffProduct(code, data.product) : null;
  if (!product) {
    return Response.json(
      { error: "This product isn't in the database or has no nutrition data. You can add it by describing it instead." },
      { status: 404 },
    );
  }
  return Response.json(product);
}
