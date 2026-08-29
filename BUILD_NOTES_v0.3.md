# Real Pantry v0.3 Build Notes

## Completed in this segment

- Connected to the existing Supabase project.
- Created the Real Pantry Gate-A schema in the live database.
- Enabled Row Level Security on every Real Pantry public table.
- Added ownership/membership policies for household-scoped data.
- Removed anonymous access to Real Pantry database tables.
- Kept reference catalog tables authenticated-read-only.
- Added performance indexes for foreign keys identified by Supabase advisor.
- Supabase security advisor result after changes: no security lints.
- Added passwordless parent email authentication UI.
- Added first-sign-in household + owner membership bootstrap.
- Added `alpha_state_snapshots` to persist the exact v0.2 workflow state safely across devices/sessions.
- Added cloud event mirroring into `alpha_events`.
- Added local v0.2 -> v0.3 migration/fallback.
- Added cloud save status and sign-out controls.
- Added environment configuration using the project's publishable (browser-safe) API key only.

## Why the catalog is still bundled in the app

Gate A tests whether the weekly workflow becomes a habit. The recommendation engine already uses the v0.2 61-food / 40-lunch catalog locally. Loading the catalog into Supabase is not necessary to answer the Founder Household question, so v0.3 avoids making seed deployment a blocker. The SQL seed file remains included and can be applied before outside-family testing.

## Data strategy

v0.3 intentionally uses two layers:

1. **Normalized long-term schema** — households, children, restrictions, preferences, weeks, lunch items, outcomes, events.
2. **Gate-A snapshot** — one household-owned JSONB row containing the working UI state.

This lets us test cloud persistence immediately without rewriting every already-working screen. Once the workflow stabilizes, screens can migrate entity-by-entity to normalized CRUD.

## Remaining before founder deployment

- Install npm dependencies and produce a lockfile/build in an environment with npm registry access.
- Configure the deployed URL in Supabase Auth redirect settings.
- Deploy the Vite frontend.
- Perform first real parent magic-link sign-in.
- Verify second-device restore.
- Verify Week 1 outcome -> Week 2 learning over real use.

## Still deliberately excluded

- Child accounts.
- Payments/paywall.
- Camera/OCR.
- Production allergy assurance.
- Native iOS/Android wrappers.
- Full branded-product verification.
- Public 5-10 family distribution.
