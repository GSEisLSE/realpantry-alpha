-- Real Pantry Alpha data model (Postgres/Supabase)
-- Parent-facing product. Minimize child identifiers: nickname is enough for alpha.

create extension if not exists pgcrypto;

create table households (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  timezone text not null default 'America/Chicago'
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null, -- Supabase auth.users id
  role text not null default 'owner' check (role in ('owner','caregiver')),
  primary key (household_id, user_id)
);

create table children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  nickname text not null,
  grade_band text check (grade_band in ('pre-k','k','1','2','3','4','5','other')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Allergy/school restrictions are hard exclusions, not scoring preferences.
create table child_restrictions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  kind text not null check (kind in ('allergy','school_rule','dietary_restriction','never_food')),
  canonical_value text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table family_settings (
  household_id uuid primary key references households(id) on delete cascade,
  weekly_budget_cents integer,
  max_prep_minutes integer not null default 15,
  preferred_stores jsonb not null default '[]'::jsonb,
  values_profile jsonb not null default '{}'::jsonb,
  -- e.g. {"organic":3,"avoid_synthetic_dyes":5,"seed_oil_avoidance":0,"minimal_plastic":2}
  updated_at timestamptz not null default now()
);

-- Canonical food concepts: strawberries, cucumber, turkey sandwich, hummus.
create table foods (
  id text primary key,
  name text not null,
  category text not null,
  default_allergens jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb
);

-- Optional branded realization of a food. Old Real Pantry product DB migrates here.
create table products (
  id uuid primary key default gen_random_uuid(),
  food_id text references foods(id),
  brand text,
  product_name text not null,
  barcode text,
  verification_status text not null default 'unverified'
    check (verification_status in ('verified','needs_review','unverified','retired')),
  nutrition_facts jsonb,
  ingredients jsonb,
  evidence_score numeric,
  family_attributes jsonb not null default '{}'::jsonb,
  source_notes text,
  updated_at timestamptz not null default now()
);

-- Lunch templates are combinations, not necessarily recipes.
create table lunch_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nutrition_score numeric not null default 0,
  family_fit_score numeric not null default 75,
  practicality_score numeric not null default 75,
  prep_minutes integer,
  requires_cold_pack boolean not null default false,
  active boolean not null default true
);

create table lunch_template_items (
  id uuid primary key default gen_random_uuid(),
  lunch_template_id uuid not null references lunch_templates(id) on delete cascade,
  food_id text not null references foods(id),
  role text not null check (role in ('main','veg','fruit','other','dip','drink')),
  product_id uuid references products(id),
  portion_note text,
  unique (lunch_template_id, role, food_id)
);

-- Parent seed answer + derived child-specific history.
create table child_food_preferences (
  child_id uuid not null references children(id) on delete cascade,
  food_id text not null references foods(id),
  status text not null default 'unknown'
    check (status in ('loves','likes','okay','unknown','exposure','avoid')),
  source text not null default 'parent_seed'
    check (source in ('parent_seed','import','inferred')),
  updated_at timestamptz not null default now(),
  primary key (child_id, food_id)
);

create table weekly_plans (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft','active','complete','archived')),
  created_at timestamptz not null default now(),
  unique (child_id, week_start)
);

create table planned_lunches (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  lunch_date date not null,
  template_id uuid references lunch_templates(id),
  locked boolean not null default false,
  recommendation_snapshot jsonb,
  unique (weekly_plan_id, lunch_date)
);

create table planned_lunch_items (
  id uuid primary key default gen_random_uuid(),
  planned_lunch_id uuid not null references planned_lunches(id) on delete cascade,
  food_id text not null references foods(id),
  product_id uuid references products(id),
  role text not null,
  was_parent_swap boolean not null default false
);

-- The moat: what actually happened after the food left home.
create table food_outcomes (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  planned_lunch_item_id uuid references planned_lunch_items(id) on delete set null,
  food_id text not null references foods(id),
  occurred_on date not null,
  eaten_fraction numeric check (eaten_fraction between 0 and 1),
  outcome text check (outcome in ('all','most','half','little','none','unknown')),
  presentation_tags jsonb not null default '[]'::jsonb,
  -- e.g. ["with_hummus","cold","sliced"] for later context learning
  notes text,
  created_at timestamptz not null default now()
);

-- Keep score components/explanations so the alpha is debuggable.
create table recommendation_logs (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  week_start date,
  candidate_template_id uuid references lunch_templates(id),
  eligible boolean not null,
  total_score numeric,
  sub_scores jsonb,
  rejection_reason text,
  created_at timestamptz not null default now()
);

-- Camera import can be added without changing the core model.
create table imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  kind text not null check (kind in ('handwritten_week','packed_lunch','label')),
  status text not null default 'uploaded' check (status in ('uploaded','parsed','confirmed','failed')),
  parsed_payload jsonb,
  created_at timestamptz not null default now()
);

-- Production requirement: enable RLS on every household/child table and scope
-- rows through household_members. Do not ship with public table access.

-- Gate A v0.2 additions ------------------------------------------------------
alter table family_settings add column if not exists baseline_planning_minutes integer;
alter table foods add column if not exists presentation_tags jsonb not null default '[]'::jsonb;
alter table lunch_templates add column if not exists estimated_cost_cents integer;
alter table lunch_templates add column if not exists store_tags jsonb not null default '["Any"]'::jsonb;
alter table lunch_templates add column if not exists tags jsonb not null default '[]'::jsonb;
alter table lunch_templates add column if not exists scoring_status text not null default 'alpha_heuristic'
  check (scoring_status in ('alpha_heuristic','reviewed','production'));

create table if not exists alpha_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  weekly_plan_id uuid references weekly_plans(id) on delete set null,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists alpha_events_event_name_idx on alpha_events(event_name, created_at);
create index if not exists food_outcomes_child_date_idx on food_outcomes(child_id, occurred_on desc);
create index if not exists weekly_plans_child_week_idx on weekly_plans(child_id, week_start desc);
