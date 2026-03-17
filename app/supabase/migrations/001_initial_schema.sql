-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- Extends auth.users. Created automatically via trigger.
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  balance     integer not null default 1000,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- GAMES
-- Populated by the score/schedule sync cron job.
-- ============================================================
create table public.games (
  id            uuid primary key default uuid_generate_v4(),
  ncaa_game_id  text unique not null,
  home_team     text not null,
  away_team     text not null,
  start_time    timestamptz not null,
  home_score    integer,
  away_score    integer,
  status        text not null default 'scheduled',  -- scheduled | live | final
  network       text,
  game_date     date not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "Games are publicly readable"
  on public.games for select using (true);

-- Only service role (cron job) can insert/update games
create policy "Service role can manage games"
  on public.games for all using (auth.role() = 'service_role');


-- ============================================================
-- ODDS
-- Latest odds snapshot per game, fetched from The Odds API.
-- ============================================================
create table public.odds (
  id            uuid primary key default uuid_generate_v4(),
  game_id       uuid not null references public.games(id) on delete cascade,
  bookmaker     text not null default 'draftkings',
  -- moneyline
  home_ml       integer,
  away_ml       integer,
  -- spread
  home_spread   numeric(5,1),
  home_spread_price integer,
  away_spread_price integer,
  -- totals
  over_under    numeric(5,1),
  over_price    integer,
  under_price   integer,
  fetched_at    timestamptz not null default now(),
  unique(game_id, bookmaker)
);

alter table public.odds enable row level security;

create policy "Odds are publicly readable"
  on public.odds for select using (true);

create policy "Service role can manage odds"
  on public.odds for all using (auth.role() = 'service_role');


-- ============================================================
-- BETS
-- ============================================================
create table public.bets (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  game_id         uuid not null references public.games(id) on delete cascade,
  market          text not null,      -- h2h | spreads | totals
  pick            text not null,      -- 'home' | 'away' | 'over' | 'under'
  amount          integer not null check (amount > 0),
  odds_at_place   integer not null,   -- American odds (e.g. -110, +150)
  result          text,               -- null | 'win' | 'loss' | 'push'
  payout          integer,            -- credited on settlement
  placed_at       timestamptz not null default now(),
  settled_at      timestamptz
);

alter table public.bets enable row level security;

create policy "Users can view all bets"
  on public.bets for select using (true);

create policy "Users can place their own bets"
  on public.bets for insert with check (
    auth.uid() = user_id
    -- Prevent betting on games that have already started
    and exists (
      select 1 from public.games g
      where g.id = game_id
      and g.status = 'scheduled'
      and g.start_time > now()
    )
  );

create policy "Service role can settle bets"
  on public.bets for update using (auth.role() = 'service_role');


-- ============================================================
-- HELPER: deduct balance when a bet is placed
-- ============================================================
create or replace function public.deduct_balance_on_bet()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set balance = balance - new.amount
  where id = new.user_id
    and balance >= new.amount;

  if not found then
    raise exception 'Insufficient balance';
  end if;

  return new;
end;
$$;

create trigger on_bet_placed
  after insert on public.bets
  for each row execute procedure public.deduct_balance_on_bet();


-- ============================================================
-- HELPER: credit balance when a bet is settled
-- ============================================================
create or replace function public.credit_balance_on_settlement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.result is not null and old.result is null then
    if new.result = 'win' and new.payout is not null then
      update public.profiles
      set balance = balance + new.payout
      where id = new.user_id;
    elsif new.result = 'push' then
      -- Return original stake on a push
      update public.profiles
      set balance = balance + new.amount
      where id = new.user_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_bet_settled
  after update on public.bets
  for each row execute procedure public.credit_balance_on_settlement();
