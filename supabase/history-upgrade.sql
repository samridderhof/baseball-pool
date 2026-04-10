alter table public.league_memberships
  add column if not exists import_label text;

create table if not exists public.historical_week_results (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  week_number integer not null check (week_number > 0),
  membership_id uuid not null references public.league_memberships(id) on delete cascade,
  correct_picks integer,
  points integer not null,
  cash_delta integer not null,
  source_label text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (league_id, week_number, membership_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_historical_week_results_updated_at on public.historical_week_results;
create trigger set_historical_week_results_updated_at
before update on public.historical_week_results
for each row
execute function public.set_updated_at();

alter table public.historical_week_results enable row level security;

drop policy if exists "users can view historical results in their league" on public.historical_week_results;
create policy "users can view historical results in their league"
on public.historical_week_results
for select
to authenticated
using (
  exists (
    select 1
    from public.league_memberships memberships
    where memberships.league_id = historical_week_results.league_id
      and memberships.user_id = auth.uid()
  )
);

drop policy if exists "users can insert historical results in their league" on public.historical_week_results;
create policy "users can insert historical results in their league"
on public.historical_week_results
for insert
to authenticated
with check (
  exists (
    select 1
    from public.league_memberships memberships
    where memberships.league_id = historical_week_results.league_id
      and memberships.user_id = auth.uid()
  )
);

drop policy if exists "users can update historical results in their league" on public.historical_week_results;
create policy "users can update historical results in their league"
on public.historical_week_results
for update
to authenticated
using (
  exists (
    select 1
    from public.league_memberships memberships
    where memberships.league_id = historical_week_results.league_id
      and memberships.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.league_memberships memberships
    where memberships.league_id = historical_week_results.league_id
      and memberships.user_id = auth.uid()
  )
);
