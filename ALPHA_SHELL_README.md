# Real Pantry Gate A Alpha Shell

This package turns the recovered Monday-Friday prototype into the six-step Gate A workflow:

1. Child Setup
2. Food Seed
3. Plan My Week
4. Lock / Swap
5. Grocery List
6. What Came Back?

## Two implementations are included

### `static-demo/` — verified runnable Gate A prototype
No npm dependencies are required. It uses the v2 recommendation engine directly in the browser and persists alpha data/events in localStorage.

Run it locally:

```bash
cd static-demo
python -m http.server 8000
```

Then open `http://localhost:8000`.

The demo supports:
- child nickname/grade
- allergen + nut-free hard exclusions
- weekly budget, prep-time, preferred-store constraints
- baseline weekly planning-time capture
- 22-food seed questionnaire
- five-day v2 ranked week generation
- acceptance/nutrition/variety/family-fit/practicality scoring
- day and component locks
- best-eligible component swaps
- regenerate-unlocked workflow
- aggregated grocery list
- Monday-Friday eaten-fraction feedback
- learned acceptance updates on later generation
- local Gate A event instrumentation

### React/Vite source shell
`src/` contains the maintainable React version of the same workflow plus a repository/service split intended to become the production shell. It is wired to versioned local persistence for Gate A and maps onto `schema.sql` from the Alpha Bridge for later Supabase persistence.

Dependency installation was not available in the build environment, so the React/Vite shell was not bundled here. The dependency-free `static-demo` was syntax-checked and HTTP-served successfully, and the recommendation engine smoke test passed.

## Persistence bridge
Gate A uses versioned local browser storage deliberately. The production mapping is already defined in the Alpha Bridge schema:

- child -> `children`, `child_restrictions`
- household constraints -> `family_settings`
- seed answers -> `child_food_preferences`
- generated week -> `weekly_plans`, `planned_lunches`, `planned_lunch_items`
- what came back -> `food_outcomes`
- ranking explanation -> `recommendation_logs`

This lets the early alpha stay cheap while preserving a clean migration path to Supabase/Postgres.

## Instrumented Gate A events
The verified demo writes these events into `realpantry.static.alpha.events.v1` in localStorage:

- `child_profile_completed`
- `seed_foods_completed`
- `week_generated`
- `day_lock_toggled`
- `item_lock_toggled`
- `item_swap_requested`
- `grocery_list_opened`
- `outcome_logged`

These allow the first 5-10 household test to measure first-week activation, repair burden, grocery use, and feedback participation.

## Current intentional limitations
- single-child static demo; React source is structured to expand beyond it
- compact alpha candidate catalog, not the full verified-100 database
- grocery frequency notes, not recipe quantities
- no auth/cloud sync yet
- no camera OCR yet
- no subscription/paywall yet
- no nutrition/medical claims should be treated as production-ready

## Validation target for this segment
The shell is ready to answer the first product question: can a parent move through the entire weekly loop without the old broader meal-planning application?
