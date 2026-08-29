# Real Pantry Alpha Dataset v0.2

This package converts the recovered Real Pantry research into a deliberately narrow Gate A dataset for testing the weekly school-lunch workflow.

## What is in the dataset

- **61 generic food concepts** used by the recommendation engine.
- **33 quick-seed foods** shown during onboarding so a parent does not have to classify the entire catalog.
- **40 complete Monday–Friday-compatible lunch templates** with exactly one main, vegetable, fruit, and extra.
- **22 distinct main concepts** across the template pool.
- **100 recovered branded-product candidates** preserved from the historical Real Pantry research.
- **63 candidate products already have a barcode** in the recovered material.

## Historical work reused

The first 15 templates are normalized versions of the three historical five-day rotations in the Clean Lunchbox Guide: Standard, Nut-Free, and Budget. The additional 25 templates were added to increase main/produce variety and make the optimizer useful for an alpha.

The old A+/A/B grading is preserved only as `legacy_grade` in the audit files. It is **not** treated as a production evidence score.

## Important distinction

### Alpha template scores
`nutrition_score`, `family_fit_score`, and `practicality_score` are **workflow heuristics**. They allow the recommendation engine, UI, and feedback loop to be tested. They are not public health claims and should not be exposed as authoritative production grades.

### Product verification
Every branded product in `alpha-product-candidates.json` starts as `needs_review`. Products should move to `verified` only after the ingredient panel, nutrition facts, allergen labeling, and current product identity are checked.

## Onboarding rule discovered during testing

The old rule of “seed about 12 foods” was too blunt. Gate A now asks for:

- at least **8 quick-seed answers**, and
- at least **2 workable mains** marked Love, Like, or Okay.

This gives the engine enough child-specific anchors without making onboarding excessive.

## Engine change made during integration

A parent-marked **Avoid** food is now a hard exclusion, not merely a very-low acceptance probability.

The reliability threshold was also adjusted so `Okay` is a valid reliable anchor. In this model:

- Love ≈ strong prior
- Like ≈ reliable prior
- Okay ≈ acceptable/reliable prior
- New = controlled exposure
- Avoid = hard exclusion

## Stress testing

A common-constraint matrix successfully generated five lunches for baseline, nut-free, peanut, tree-nut, milk, egg, wheat, sesame, and several combined profiles using the current generic allergen metadata.

A deterministic 250-profile simulation with incomplete onboarding and mixed Love/Like/Okay/New/Avoid answers produced a complete five-day week in roughly **92%** of profiles.

This is a software stress test, **not validation that the current generic catalog is safe for families with medical food allergies**. Branded product labels are not yet fully audited. Gate A external testers with medically significant allergies should be excluded until the product-allergen layer is verified.

## Files

- `alpha-foods.json` — generic food concepts.
- `alpha-lunch-templates.json` — 40 alpha lunch patterns.
- `alpha-product-candidates.json` — 100 recovered branded candidates, all needing review.
- `mvp100-audit-tracker.csv` — working verification queue.
- `alphaCatalog.js` — generated data module used by the local React/static shells.
- `schema-v0.2.sql` — database schema with Gate A additions.
- `seed-alpha-v0.2.sql` — SQL seed for foods, templates, template items, and legacy product candidates.
- `data-health-report.json` — structural validation report.
- `smoke-test-v02.mjs` — engine guardrail test.
- `constraint-matrix-test.mjs` — constraint coverage test.
- `simulation-test.mjs` — incomplete-onboarding simulation.

