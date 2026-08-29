-- Real Pantry Gate A v0.3 cloud schema
-- Parent-facing alpha. Child data is minimized to nickname/grade + lunch preferences/outcomes.
-- All household data is protected by RLS. Reference catalog is authenticated-read-only.

create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  timezone text not null default 'America/Chicago'
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','caregiver')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 60),
  grade_band text check (grade_band in ('pre-k','k','1','2','3','4','5','other')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.child_restrictions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  kind text not null check (kind in ('allergy','school_rule','dietary_restriction','never_food')),
  canonical_value text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.family_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  weekly_budget_cents integer check (weekly_budget_cents is null or weekly_budget_cents >= 0),
  max_prep_minutes integer not null default 15 check (max_prep_minutes between 0 and 240),
  baseline_planning_minutes integer check (baseline_planning_minutes is null or baseline_planning_minutes between 0 and 600),
  preferred_stores jsonb not null default '[]'::jsonb,
  values_profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.foods (
  id text primary key,
  name text not null,
  category text not null,
  default_allergens jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  presentation_tags jsonb not null default '[]'::jsonb
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  food_id text references public.foods(id),
  brand text,
  product_name text not null,
  barcode text,
  verification_status text not null default 'unverified'
    check (verification_status in ('verified','needs_review','unverified','retired')),
  nutrition_facts jsonb,
  ingredients jsonb,
  evidence_score numeric check (evidence_score is null or evidence_score between 0 and 100),
  family_attributes jsonb not null default '{}'::jsonb,
  source_notes text,
  updated_at timestamptz not null default now()
);
create unique index if not exists products_barcode_unique_idx on public.products(barcode) where barcode is not null;

create table if not exists public.lunch_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nutrition_score numeric not null default 0 check (nutrition_score between 0 and 100),
  family_fit_score numeric not null default 75 check (family_fit_score between 0 and 100),
  practicality_score numeric not null default 75 check (practicality_score between 0 and 100),
  prep_minutes integer check (prep_minutes is null or prep_minutes between 0 and 240),
  estimated_cost_cents integer check (estimated_cost_cents is null or estimated_cost_cents >= 0),
  store_tags jsonb not null default '["Any"]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  scoring_status text not null default 'alpha_heuristic'
    check (scoring_status in ('alpha_heuristic','reviewed','production')),
  requires_cold_pack boolean not null default false,
  active boolean not null default true
);

create table if not exists public.lunch_template_items (
  id uuid primary key default gen_random_uuid(),
  lunch_template_id uuid not null references public.lunch_templates(id) on delete cascade,
  food_id text not null references public.foods(id),
  role text not null check (role in ('main','veg','fruit','other','dip','drink')),
  product_id uuid references public.products(id),
  portion_note text,
  unique (lunch_template_id, role, food_id)
);

create table if not exists public.child_food_preferences (
  child_id uuid not null references public.children(id) on delete cascade,
  food_id text not null references public.foods(id),
  status text not null default 'unknown'
    check (status in ('loves','likes','okay','unknown','exposure','avoid')),
  source text not null default 'parent_seed'
    check (source in ('parent_seed','import','inferred')),
  updated_at timestamptz not null default now(),
  primary key (child_id, food_id)
);

create table if not exists public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft','active','complete','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, week_start)
);

create table if not exists public.planned_lunches (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references public.weekly_plans(id) on delete cascade,
  lunch_date date not null,
  template_id uuid references public.lunch_templates(id),
  locked boolean not null default false,
  recommendation_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weekly_plan_id, lunch_date)
);

create table if not exists public.planned_lunch_items (
  id uuid primary key default gen_random_uuid(),
  planned_lunch_id uuid not null references public.planned_lunches(id) on delete cascade,
  food_id text not null references public.foods(id),
  product_id uuid references public.products(id),
  role text not null,
  was_parent_swap boolean not null default false,
  locked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.food_outcomes (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  planned_lunch_item_id uuid references public.planned_lunch_items(id) on delete set null,
  food_id text not null references public.foods(id),
  occurred_on date not null,
  eaten_fraction numeric check (eaten_fraction between 0 and 1),
  outcome text check (outcome in ('all','most','half','little','none','unknown')),
  presentation_tags jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.recommendation_logs (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  week_start date,
  candidate_template_id uuid references public.lunch_templates(id),
  eligible boolean not null,
  total_score numeric,
  sub_scores jsonb,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  kind text not null check (kind in ('handwritten_week','packed_lunch','label')),
  status text not null default 'uploaded' check (status in ('uploaded','parsed','confirmed','failed')),
  parsed_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.alpha_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  weekly_plan_id uuid references public.weekly_plans(id) on delete set null,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Exact app-state cache for Gate A. This lets v0.3 move off one-device localStorage
-- without prematurely forcing every UI field through normalized sync code.
create table if not exists public.alpha_state_snapshots (
  household_id uuid primary key references public.households(id) on delete cascade,
  state_version integer not null default 3,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists children_household_idx on public.children(household_id);
create index if not exists child_restrictions_child_idx on public.child_restrictions(child_id);
create index if not exists food_outcomes_child_date_idx on public.food_outcomes(child_id, occurred_on desc);
create index if not exists weekly_plans_child_week_idx on public.weekly_plans(child_id, week_start desc);
create index if not exists planned_lunches_plan_date_idx on public.planned_lunches(weekly_plan_id, lunch_date);
create index if not exists alpha_events_household_created_idx on public.alpha_events(household_id, created_at desc);
create index if not exists alpha_events_event_name_idx on public.alpha_events(event_name, created_at desc);

-- RLS -----------------------------------------------------------------------
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.children enable row level security;
alter table public.child_restrictions enable row level security;
alter table public.family_settings enable row level security;
alter table public.foods enable row level security;
alter table public.products enable row level security;
alter table public.lunch_templates enable row level security;
alter table public.lunch_template_items enable row level security;
alter table public.child_food_preferences enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.planned_lunches enable row level security;
alter table public.planned_lunch_items enable row level security;
alter table public.food_outcomes enable row level security;
alter table public.recommendation_logs enable row level security;
alter table public.imports enable row level security;
alter table public.alpha_events enable row level security;
alter table public.alpha_state_snapshots enable row level security;

-- Bootstrap + membership ----------------------------------------------------
drop policy if exists "households_select_member" on public.households;
create policy "households_select_member" on public.households for select to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.household_members hm
    where hm.household_id = households.id and hm.user_id = (select auth.uid())
  )
);

drop policy if exists "households_insert_creator" on public.households;
create policy "households_insert_creator" on public.households for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "households_update_member" on public.households;
create policy "households_update_member" on public.households for update to authenticated
using (
  created_by = (select auth.uid())
  or exists (select 1 from public.household_members hm where hm.household_id = households.id and hm.user_id = (select auth.uid()))
)
with check (
  created_by = (select auth.uid())
  or exists (select 1 from public.household_members hm where hm.household_id = households.id and hm.user_id = (select auth.uid()))
);

drop policy if exists "members_select_self" on public.household_members;
create policy "members_select_self" on public.household_members for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "members_insert_bootstrap_self" on public.household_members;
create policy "members_insert_bootstrap_self" on public.household_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.households h
    where h.id = household_members.household_id and h.created_by = (select auth.uid())
  )
);

-- Household-scoped mutable tables ------------------------------------------
drop policy if exists "children_member_all" on public.children;
create policy "children_member_all" on public.children for all to authenticated
using (exists (select 1 from public.household_members hm where hm.household_id = children.household_id and hm.user_id = (select auth.uid())))
with check (exists (select 1 from public.household_members hm where hm.household_id = children.household_id and hm.user_id = (select auth.uid())));

drop policy if exists "family_settings_member_all" on public.family_settings;
create policy "family_settings_member_all" on public.family_settings for all to authenticated
using (exists (select 1 from public.household_members hm where hm.household_id = family_settings.household_id and hm.user_id = (select auth.uid())))
with check (exists (select 1 from public.household_members hm where hm.household_id = family_settings.household_id and hm.user_id = (select auth.uid())));

drop policy if exists "restrictions_member_all" on public.child_restrictions;
create policy "restrictions_member_all" on public.child_restrictions for all to authenticated
using (exists (select 1 from public.children c join public.household_members hm on hm.household_id=c.household_id where c.id=child_restrictions.child_id and hm.user_id=(select auth.uid())))
with check (exists (select 1 from public.children c join public.household_members hm on hm.household_id=c.household_id where c.id=child_restrictions.child_id and hm.user_id=(select auth.uid())));

drop policy if exists "preferences_member_all" on public.child_food_preferences;
create policy "preferences_member_all" on public.child_food_preferences for all to authenticated
using (exists (select 1 from public.children c join public.household_members hm on hm.household_id=c.household_id where c.id=child_food_preferences.child_id and hm.user_id=(select auth.uid())))
with check (exists (select 1 from public.children c join public.household_members hm on hm.household_id=c.household_id where c.id=child_food_preferences.child_id and hm.user_id=(select auth.uid())));

drop policy if exists "weekly_plans_member_all" on public.weekly_plans;
create policy "weekly_plans_member_all" on public.weekly_plans for all to authenticated
using (exists (select 1 from public.children c join public.household_members hm on hm.household_id=c.household_id where c.id=weekly_plans.child_id and hm.user_id=(select auth.uid())))
with check (exists (select 1 from public.children c join public.household_members hm on hm.household_id=c.household_id where c.id=weekly_plans.child_id and hm.user_id=(select auth.uid())));

drop policy if exists "planned_lunches_member_all" on public.planned_lunches;
create policy "planned_lunches_member_all" on public.planned_lunches for all to authenticated
using (exists (
  select 1 from public.weekly_plans wp join public.children c on c.id=wp.child_id join public.household_members hm on hm.household_id=c.household_id
  where wp.id=planned_lunches.weekly_plan_id and hm.user_id=(select auth.uid())
))
with check (exists (
  select 1 from public.weekly_plans wp join public.children c on c.id=wp.child_id join public.household_members hm on hm.household_id=c.household_id
  where wp.id=planned_lunches.weekly_plan_id and hm.user_id=(select auth.uid())
));

drop policy if exists "planned_items_member_all" on public.planned_lunch_items;
create policy "planned_items_member_all" on public.planned_lunch_items for all to authenticated
using (exists (
  select 1 from public.planned_lunches pl join public.weekly_plans wp on wp.id=pl.weekly_plan_id join public.children c on c.id=wp.child_id join public.household_members hm on hm.household_id=c.household_id
  where pl.id=planned_lunch_items.planned_lunch_id and hm.user_id=(select auth.uid())
))
with check (exists (
  select 1 from public.planned_lunches pl join public.weekly_plans wp on wp.id=pl.weekly_plan_id join public.children c on c.id=wp.child_id join public.household_members hm on hm.household_id=c.household_id
  where pl.id=planned_lunch_items.planned_lunch_id and hm.user_id=(select auth.uid())
));

drop policy if exists "outcomes_member_all" on public.food_outcomes;
create policy "outcomes_member_all" on public.food_outcomes for all to authenticated
using (exists (select 1 from public.children c join public.household_members hm on hm.household_id=c.household_id where c.id=food_outcomes.child_id and hm.user_id=(select auth.uid())))
with check (exists (select 1 from public.children c join public.household_members hm on hm.household_id=c.household_id where c.id=food_outcomes.child_id and hm.user_id=(select auth.uid())));

drop policy if exists "recommendation_logs_member_all" on public.recommendation_logs;
create policy "recommendation_logs_member_all" on public.recommendation_logs for all to authenticated
using (exists (select 1 from public.children c join public.household_members hm on hm.household_id=c.household_id where c.id=recommendation_logs.child_id and hm.user_id=(select auth.uid())))
with check (exists (select 1 from public.children c join public.household_members hm on hm.household_id=c.household_id where c.id=recommendation_logs.child_id and hm.user_id=(select auth.uid())));

drop policy if exists "imports_member_all" on public.imports;
create policy "imports_member_all" on public.imports for all to authenticated
using (exists (select 1 from public.household_members hm where hm.household_id=imports.household_id and hm.user_id=(select auth.uid())))
with check (exists (select 1 from public.household_members hm where hm.household_id=imports.household_id and hm.user_id=(select auth.uid())));

drop policy if exists "events_member_all" on public.alpha_events;
create policy "events_member_all" on public.alpha_events for all to authenticated
using (exists (select 1 from public.household_members hm where hm.household_id=alpha_events.household_id and hm.user_id=(select auth.uid())))
with check (exists (select 1 from public.household_members hm where hm.household_id=alpha_events.household_id and hm.user_id=(select auth.uid())));

drop policy if exists "snapshots_member_all" on public.alpha_state_snapshots;
create policy "snapshots_member_all" on public.alpha_state_snapshots for all to authenticated
using (exists (select 1 from public.household_members hm where hm.household_id=alpha_state_snapshots.household_id and hm.user_id=(select auth.uid())))
with check (exists (select 1 from public.household_members hm where hm.household_id=alpha_state_snapshots.household_id and hm.user_id=(select auth.uid())));

-- Reference catalog: authenticated users can read only ----------------------
drop policy if exists "foods_authenticated_read" on public.foods;
create policy "foods_authenticated_read" on public.foods for select to authenticated using (true);
drop policy if exists "products_authenticated_read" on public.products;
create policy "products_authenticated_read" on public.products for select to authenticated using (true);
drop policy if exists "templates_authenticated_read" on public.lunch_templates;
create policy "templates_authenticated_read" on public.lunch_templates for select to authenticated using (active = true);
drop policy if exists "template_items_authenticated_read" on public.lunch_template_items;
create policy "template_items_authenticated_read" on public.lunch_template_items for select to authenticated using (true);

-- Data API grants. No anon access to any Real Pantry table.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.households, public.household_members, public.children,
  public.child_restrictions, public.family_settings, public.child_food_preferences, public.weekly_plans,
  public.planned_lunches, public.planned_lunch_items, public.food_outcomes, public.recommendation_logs,
  public.imports, public.alpha_events, public.alpha_state_snapshots to authenticated;
grant select on public.foods, public.products, public.lunch_templates, public.lunch_template_items to authenticated;

-- Cover foreign keys flagged by Supabase performance advisor.
create index if not exists alpha_events_child_idx on public.alpha_events(child_id);
create index if not exists alpha_events_weekly_plan_idx on public.alpha_events(weekly_plan_id);
create index if not exists child_food_preferences_food_idx on public.child_food_preferences(food_id);
create index if not exists food_outcomes_food_idx on public.food_outcomes(food_id);
create index if not exists food_outcomes_planned_item_idx on public.food_outcomes(planned_lunch_item_id);
create index if not exists household_members_user_idx on public.household_members(user_id);
create index if not exists households_created_by_idx on public.households(created_by);
create index if not exists imports_child_idx on public.imports(child_id);
create index if not exists imports_household_idx on public.imports(household_id);
create index if not exists lunch_template_items_food_idx on public.lunch_template_items(food_id);
create index if not exists lunch_template_items_product_idx on public.lunch_template_items(product_id);
create index if not exists planned_lunch_items_food_idx on public.planned_lunch_items(food_id);
create index if not exists planned_lunch_items_lunch_idx on public.planned_lunch_items(planned_lunch_id);
create index if not exists planned_lunch_items_product_idx on public.planned_lunch_items(product_id);
create index if not exists planned_lunches_template_idx on public.planned_lunches(template_id);
create index if not exists products_food_idx on public.products(food_id);
create index if not exists recommendation_logs_template_idx on public.recommendation_logs(candidate_template_id);
create index if not exists recommendation_logs_child_idx on public.recommendation_logs(child_id);
