# Stocked — v1 Spec

A phone-first web app: plan a week of meals, track pantry servings, and get a Sunday shopping list.

## The weekly loop
1. **Sunday — plan.** Fill breakfast / lunch / dinner for Monday through the next Sunday (7 days).
   "Repeat on days" lets one choice fill several slots (yogurt Mon–Fri).
2. **Sunday — shop.** The shopping list = what the plan needs for those 7 days, minus what's in the pantry,
   rounded up to whole packages. Checking an item off adds that many packages to the pantry.
3. **During the week.** When a day ends, its planned meals are automatically "eaten" and their servings
   leave the pantry. A past meal can be marked **Didn't eat it**, which puts the servings back.
4. **Anytime.** Add, edit, or delete pantry items by hand.

## Core rules
- **Everything is counted in servings.** Each item has "servings per package" (yogurt tub = 8).
  Real units (cups, grams) are a later version.
- **Every meal slot = 1 serving** of a recipe or a single pantry item.
- **In stock vs. to buy.** A planned meal is *covered* if the pantry has enough servings left after
  earlier planned meals take theirs. Otherwise it's marked **to buy** and drives the shopping list.
  Servings you already own are never double-counted.
- **Recipes** list ingredients in servings and say how many meals the recipe makes (`makes`).
  Each planned meal uses `ingredient servings ÷ makes` of each ingredient.
  Example: Taco meat uses 4 servings of ground beef and makes 4 meals → 1 beef serving per meal.
- **Batch cooking.** "Cook a batch" takes a recipe's ingredients out of the pantry and adds
  "Cooked: <recipe>" with `makes` servings. Planned meals of that recipe use the cooked batch first.
- **Stock colors.** Yellow when under half a package is left, red when out.

## Screens
- **Week** — 7 days × 3 meals, week arrows, badges for "to buy" and "eaten/skipped".
- **Recipes** — list, add by pasting a link (auto-import) or typing, edit, delete.
- **Pantry** — Fridge / Freezer / Pantry groups, servings left with color, Cook a batch.
- **Shop** — list for the coming Mon–Sun, check off to add to pantry.

## Data & hosting
- v1 saves to the browser (localStorage). v1.1: Supabase login + cloud sync (whole state per user).
- React + Vite + TypeScript, installable as a home-screen app, hosted on Vercel.
- Link import: a small serverless function (`api/import.js`) reads the page's schema.org Recipe data.

## Later
Real units, barcode scan for servings per container (Open Food Facts), push notifications, macros.
