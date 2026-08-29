# Real Pantry Gate A — v0.3 Founder Household Alpha

This build turns the v0.2 local prototype into a cloud-backed founder-household alpha.

## What changed

- Supabase project is live and the Real Pantry schema has been created.
- Row Level Security is enabled on every exposed Real Pantry table.
- Security advisor check returned no findings after schema creation.
- Parent-only passwordless email sign-in (magic link / OTP flow through Supabase Auth).
- Automatic first-household bootstrap after first sign-in.
- `alpha_state_snapshots` provides safe transitional cloud persistence for the exact v0.2 UI state.
- Browser localStorage remains a fallback/cache, so a temporary network issue does not erase the active week.
- v0.2 local data is migrated into v0.3 on the first launch and uploaded when a new cloud household has no existing snapshot.
- Alpha events can now be mirrored into `alpha_events` for Gate-A measurement.
- Normalized tables remain the destination model for child profiles, restrictions, preferences, weeks, lunch items, and outcomes.

## Why snapshots first?

The six-screen alpha already works. Rewriting every screen to individually CRUD dozens of normalized rows before Founder Household testing would add failure modes without answering the Gate-A question. v0.3 persists the exact tested application state in one household-owned JSONB row while retaining the normalized schema underneath. Once the workflow stabilizes, sync can move entity-by-entity into normalized tables without changing the product experience.

## Authentication/privacy posture

- Parent accounts only. No child authentication.
- Alpha asks for a child nickname rather than legal/full name.
- No anonymous Data API access to Real Pantry tables.
- Household data access is membership-scoped through RLS.
- Catalog tables are read-only to authenticated clients.
- Never ship a Supabase secret/service-role key to the browser. This project uses only the publishable client key.

## Founder Household launch checklist

1. Install dependencies with a lockfile-capable environment.
2. Run `npm run build` and resolve any frontend compilation issues.
3. Seed the reference catalog with `seed-alpha-v0.2.sql`.
4. Configure Supabase Auth Site URL / Redirect URLs for the deployed alpha domain.
5. Deploy the Vite site privately.
6. Sign in with the founder parent email and verify a household row/membership is bootstrapped.
7. Complete Child Setup + Food Seed.
8. Generate Week 1; confirm refresh / second-device restore.
9. Log outcomes and verify Week 2 retains the prior history.
10. Review Gate-A events before inviting outside families.

## Important alpha limitation

The catalog scores are alpha workflow heuristics and the legacy branded-product allergen/ingredient data is not production-verified. Do not position this build as a medical/allergy safety system.
