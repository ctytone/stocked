# Meal Planner

Plan your week of meals, track pantry servings, and get a Sunday shopping list that only tells you to buy
a package when you'll actually run out. See [SPEC.md](SPEC.md) for how it works.

## Run it on your laptop (Windows)
1. Install Node.js 20+ from nodejs.org.
2. Open this folder in VS Code, then in the terminal:
   ```
   npm install
   npm run dev
   ```
3. Open http://localhost:5173. To try it on your phone on the same Wi-Fi: `npm run dev -- --host`, then open the
   "Network" address it prints.

## Tests
`npm test` runs the planner logic tests (shopping math, auto-eating past meals, batches) and the recipe-link parser tests.

## Put it online (all free tiers)
**1. Supabase (accounts + database)**
1. supabase.com → New project. Save the database password somewhere safe.
2. SQL Editor → New query → paste `supabase/schema.sql` → Run.
3. Project Settings → API: copy the **Project URL** and the **publishable / anon key**.
   (Never use the `service_role` / secret key in this app.)
4. Authentication → URL Configuration: set **Site URL** to your Vercel address (step 2 below), so
   confirmation and password-reset emails link back to the app.

**2. GitHub + Vercel (hosting)**
1. Push this folder to a GitHub repo named `meal-planner`.
2. vercel.com → Add New → Project → pick the repo.
3. Before deploying, add Environment Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (from step 1.3).
4. Deploy. Every push to `main` redeploys. `api/import.js` becomes the link-import service.

**3. Your phone:** open the site in Safari → Share → **Add to Home Screen**, then sign in on the Account tab.

For local development with accounts, copy `.env.example` to `.env.local` and fill in the two values.

Without the Supabase variables the app still works, saving to the browser only (no Account sign-in).

## Project layout
```
src/lib/planner.ts     the rules: covered vs. to-buy, shopping list, eating, skipping, batches
src/lib/dates.ts       weeks run Mon–Sun; Sunday shopping covers through the next Sunday
src/store.ts           app data + actions, saved in the browser (localStorage)
src/sync.ts            Supabase login + cloud sync
supabase/schema.sql    database table + security rules
src/screens/           Week, Recipes, Pantry, Shop
api/recipe-parser.js   reads schema.org Recipe data from a recipe page
api/import.js          Vercel function: /api/import?url=...
```

## How sync works
Each account has one row in `planner_state` with the whole plan as JSON; Row Level Security means a person can
only read or write their own row. Changes save a second after you stop editing; opening the app pulls the latest.
If two devices edit at the same moment, the last save wins. Signing out clears the plan from that device.

## Later
- Real units (cups, grams), barcode scan for servings per container.
