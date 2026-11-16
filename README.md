# Nourish — diet & nutrition tracker

A mobile-first web app for tracking what you eat against daily calorie and protein goals.

- **Onboarding**: height and weight in metric or imperial, approximate BMI, and a goal
  (weight loss, build muscle, increase mass, body recomposition, maintenance, pregnancy)
  that sets suggested daily targets you can edit.
- **Logging**: a chat where you describe a meal, attach a photo, or scan a barcode
  (Open Food Facts). Every suggestion can be edited before it is saved.
- **Dashboard**: progress bars for calories and protein, plus carbs, fat, fiber and water.
- **Trends**: daily calories and protein against target, weight log with chart.
- Favourite and recent foods for one-tap logging. Light and dark themes. Installable (PWA).

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (auth, Postgres, storage) · Recharts.

## Setup

1. Create a Supabase project and run `supabase/migrations/0001_init.sql` in its SQL editor.
2. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
3. Install and run:

```bash
npm install
npm run dev
```

By default Supabase asks new users to confirm their email address before they can sign in.

## Food estimation is a placeholder

Text is parsed by a built-in parser with a table of ~160 common foods
(`src/lib/estimator/mock.ts`, `foods.ts`). Photos are stored, but not recognised: the app
asks you to describe the photo. To connect a real AI model, implement the `FoodEstimator`
interface (`src/lib/estimator/types.ts`) and return it from `src/lib/estimator/index.ts`.
`/api/estimate` is the only caller.

## Structure

- `src/lib/` — framework-free logic: nutrition formulas, unit conversion, estimator,
  barcode normalisation, data access (`db.ts`). Reusable from a future native app.
- `src/app/api/` — JSON endpoints (`/api/estimate`, `/api/barcode/[code]`), authenticated
  with the user's Supabase access token as a bearer token.
- `src/app/(app)/` — signed-in screens: `today`, `log`, `trends`, `profile`.
- `supabase/migrations/` — database schema with row-level security.

## Tests

```bash
npm test          # unit tests: formulas, unit conversion, text parser
npm run lint
```

End-to-end walkthrough against an in-memory stand-in for Supabase (no real project needed):

```bash
node e2e/fake-supabase.mjs
```

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test npm run build && NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test npx next start -p 3100
```

```bash
node e2e/smoke.mjs http://localhost:3100
```

The stand-in does not test database security rules; those live in the migration.

Targets are estimates from standard formulas (Mifflin-St Jeor) and are not medical advice.
