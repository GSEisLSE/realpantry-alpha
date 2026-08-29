# Real Pantry Gate A Alpha v0.2 — Dataset Build

## What changed from v0.1

- Replaced the 13 demonstration lunches with a **40-template alpha catalog**.
- Added **61 generic food concepts** and a faster **33-food onboarding seed set**.
- Reused the historical 15-lunch Standard / Nut-Free / Budget rotations as normalized seed templates.
- Added 25 additional lunch patterns, for **22 distinct mains** overall.
- Preserved the recovered **100-product MVP audit queue** as `needs_review`; no old grade is treated as verified.
- Added prep-time effects to practicality scoring.
- Kept budget and preferred-store effects in Family Fit.
- Parent-marked `Avoid` foods are now hard exclusions.
- `Okay` foods now qualify as reliable acceptance anchors for the alpha.
- Added a better onboarding gate: at least 8 quick-seed answers and 2 workable mains.
- Fixed local longitudinal feedback so a later Monday does not overwrite an earlier Monday's outcomes.
- Added plan identity/history in the static prototype.
- Added Gate A schema fields, event table, and Supabase seed SQL.
- Added tester eligibility and measurement documents.

## Tests run

- JavaScript syntax checks: pass.
- Engine guardrail smoke test: pass.
- Parent-marked Avoid hard exclusion: pass.
- Known peanut restriction test: pass.
- Five unique weekday templates: pass.
- Common-constraint matrix: all tested profiles generated five lunches in the generic alpha catalog.
- 250-profile incomplete-onboarding simulation: ~92% complete five-day generation.
- Dataset structural validator: pass, no duplicate IDs/barcodes detected in the 100-candidate queue.

## Important limitation

The branded product database is not yet a production food-safety/allergy database. The first external Gate A cohort should exclude households that need the app to manage medically significant food allergies until current product labels and allergen data are audited.

The template nutrition scores remain alpha heuristics used to test ranking behavior, not production health claims.

## Best next engineering step

Wire this v0.2 catalog and schema into a real Supabase project, then deploy the six-step workflow behind simple parent authentication for the founder household first.
