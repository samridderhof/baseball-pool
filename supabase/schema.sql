create extension if not exists pgcrypto;

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  season_year integer not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.league_memberships (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  import_label text,
  joined_at timestamptz not null default timezone('utc', now()),
  unique (user_id),
  unique (league_id, user_id)
);

create table if not exists public.weekly_slates (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  saturday_date date not null,
  status text not null default 'upcoming',
  tiebreak_game_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  unique (league_id, saturday_date)
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  external_id bigint not null unique,
  week_id uuid not null references public.weekly_slates(id) on delete cascade,
  starts_at timestamptz not null,
  away_team text not null,
  home_team text not null,
  away_score integer,
  home_score integer,
  status text not null default 'Scheduled',
  winner_team text,
  sort_order integer not null default 1,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.weekly_slates
  drop constraint if exists weekly_slates_tiebreak_game_fk;

alter table public.weekly_slates
  add constraint weekly_slates_tiebreak_game_fk
  foreign key (tiebreak_game_id) references public.games(id) on delete set null;

create table if not exists public.weekly_entries (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weekly_slates(id) on delete cascade,
  membership_id uuid not null references public.league_memberships(id) on delete cascade,
  tiebreak_total_runs integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (week_id, membership_id)
);

create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.league_memberships(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  picked_team text not null,
  confidence integer not null check (confidence > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (membership_id, game_id)
);

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

drop trigger if exists set_weekly_entries_updated_at on public.weekly_entries;
create trigger set_weekly_entries_updated_at
before update on public.weekly_entries
for each row
execute function public.set_updated_at();

drop trigger if exists set_picks_updated_at on public.picks;
create trigger set_picks_updated_at
before update on public.picks
for each row
execute function public.set_updated_at();

drop trigger if exists set_historical_week_results_updated_at on public.historical_week_results;
create trigger set_historical_week_results_updated_at
before update on public.historical_week_results
for each row
execute function public.set_updated_at();

alter table public.leagues enable row level security;
alter table public.league_memberships enable row level security;
alter table public.weekly_slates enable row level security;
alter table public.games enable row level security;
alter table public.weekly_entries enable row level security;
alter table public.picks enable row level security;
alter table public.historical_week_results enable row level security;

create policy "public can view leagues"
on public.leagues
for select
using (true);

create policy "users can view memberships in their league"
on public.league_memberships
for select
to authenticated
using (
  exists (
    select 1
    from public.league_memberships memberships
    where memberships.league_id = league_memberships.league_id
      and memberships.user_id = auth.uid()
  )
);

create policy "users can insert their own membership"
on public.league_memberships
for insert
to authenticated
with check (user_id = auth.uid());

create policy "users can update their own membership"
on public.league_memberships
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can view weekly slates in their league"
on public.weekly_slates
for select
to authenticated
using (
  exists (
    select 1
    from public.league_memberships memberships
    where memberships.league_id = weekly_slates.league_id
      and memberships.user_id = auth.uid()
  )
);

create policy "users can view games in their league"
on public.games
for select
to authenticated
using (
  exists (
    select 1
    from public.weekly_slates slates
    join public.league_memberships memberships
      on memberships.league_id = slates.league_id
    where slates.id = games.week_id
      and memberships.user_id = auth.uid()
  )
);

create policy "users can view weekly entries in their league"
on public.weekly_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.league_memberships row_membership
    join public.league_memberships viewer_membership
      on viewer_membership.league_id = row_membership.league_id
    where row_membership.id = weekly_entries.membership_id
      and viewer_membership.user_id = auth.uid()
  )
);

create policy "users can upsert their own weekly entries"
on public.weekly_entries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.league_memberships memberships
    where memberships.id = weekly_entries.membership_id
      and memberships.user_id = auth.uid()
  )
);

create policy "users can update their own weekly entries"
on public.weekly_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.league_memberships memberships
    where memberships.id = weekly_entries.membership_id
      and memberships.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.league_memberships memberships
    where memberships.id = weekly_entries.membership_id
      and memberships.user_id = auth.uid()
  )
);

create policy "users can view picks in their league"
on public.picks
for select
to authenticated
using (
  exists (
    select 1
    from public.games games_table
    join public.weekly_slates slates on slates.id = games_table.week_id
    join public.league_memberships memberships on memberships.league_id = slates.league_id
    where games_table.id = picks.game_id
      and memberships.user_id = auth.uid()
  )
);

create policy "users can insert their own picks"
on public.picks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.league_memberships memberships
    where memberships.id = picks.membership_id
      and memberships.user_id = auth.uid()
  )
);

create policy "users can update their own picks"
on public.picks
for update
to authenticated
using (
  exists (
    select 1
    from public.league_memberships memberships
    where memberships.id = picks.membership_id
      and memberships.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.league_memberships memberships
    where memberships.id = picks.membership_id
      and memberships.user_id = auth.uid()
  )
);

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
