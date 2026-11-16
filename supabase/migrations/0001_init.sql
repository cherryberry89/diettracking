-- Diet tracker schema. Every table is private to its owner via row-level security.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  height_cm numeric(5, 1) not null check (height_cm between 50 and 280),
  sex text not null check (sex in ('male', 'female')),
  birth_year smallint not null check (birth_year between 1900 and 2100),
  activity_level text not null check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text not null check (goal in ('weight_loss', 'build_muscle', 'increase_mass', 'recomposition', 'maintenance', 'pregnancy')),
  trimester smallint check (trimester between 1 and 3),
  target_calories integer not null check (target_calories > 0),
  target_protein_g integer not null check (target_protein_g >= 0),
  target_carbs_g integer not null check (target_carbs_g >= 0),
  target_fat_g integer not null check (target_fat_g >= 0),
  target_fiber_g integer not null check (target_fiber_g >= 0),
  target_water_ml integer not null check (target_water_ml >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The user's own calendar day, so "today" is right in every timezone.
  local_date date not null,
  eaten_at timestamptz not null default now(),
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null check (char_length(name) between 1 and 200),
  quantity numeric(8, 2) not null default 1 check (quantity >= 0),
  unit text not null default 'serving',
  calories numeric(7, 1) not null default 0 check (calories >= 0),
  protein_g numeric(6, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(6, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(6, 1) not null default 0 check (fat_g >= 0),
  fiber_g numeric(6, 1) not null default 0 check (fiber_g >= 0),
  source text not null default 'text' check (source in ('text', 'photo', 'barcode', 'saved', 'manual')),
  barcode text,
  photo_path text,
  created_at timestamptz not null default now()
);
create index food_entries_user_date_idx on public.food_entries (user_id, local_date);

create table public.weight_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 500),
  created_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date date not null,
  ml integer not null check (ml > 0 and ml <= 5000),
  created_at timestamptz not null default now()
);
create index water_logs_user_date_idx on public.water_logs (user_id, local_date);

create table public.saved_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  quantity numeric(8, 2) not null default 1,
  unit text not null default 'serving',
  calories numeric(7, 1) not null default 0,
  protein_g numeric(6, 1) not null default 0,
  carbs_g numeric(6, 1) not null default 0,
  fat_g numeric(6, 1) not null default 0,
  fiber_g numeric(6, 1) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.profiles enable row level security;
alter table public.food_entries enable row level security;
alter table public.weight_logs enable row level security;
alter table public.water_logs enable row level security;
alter table public.saved_foods enable row level security;

create policy "Own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Own food entries" on public.food_entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own weight logs" on public.weight_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own water logs" on public.water_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own saved foods" on public.saved_foods for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Private bucket for meal photos; each user can only touch their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Read own meal photos" on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Upload own meal photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own meal photos" on storage.objects for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
