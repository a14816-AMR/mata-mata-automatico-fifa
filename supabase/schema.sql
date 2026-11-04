-- =====================================================================
--  Torneio FIFA/EA FC em duplas — esquema Supabase
--  Executar no SQL Editor do projeto Supabase (pode ser re-executado).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Torneios
-- status: setup (registo de duplas) → draft (sorteio/drag&drop)
--         → in_progress (resultados) → finished (final concluída)
-- ---------------------------------------------------------------------
create table if not exists public.tournaments (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  status       text not null default 'setup'
               check (status in ('setup', 'draft', 'in_progress', 'finished')),
  team_count   integer not null default 0 check (team_count >= 0 and team_count <= 128),
  bracket_size integer check (bracket_size is null or bracket_size >= 2),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Duplas (cada dupla tem exatamente um clube)
-- ---------------------------------------------------------------------
create table if not exists public.teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  club_id       text not null,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists teams_tournament_idx on public.teams(tournament_id);
-- Nomes dos jogadores (também em supabase/migrations/001_team_players.sql).
alter table public.teams add column if not exists players text not null default '';
alter table public.teams drop constraint if exists teams_players_len;
alter table public.teams add constraint teams_players_len check (char_length(players) <= 120);

-- ---------------------------------------------------------------------
-- Partidas. round 1 = primeira fase; o vencedor de (round, position)
-- avança para (round + 1, position / 2), slot team1 se position par.
-- ---------------------------------------------------------------------
create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round         integer not null check (round >= 1),
  position      integer not null check (position >= 0),
  team1_id      uuid references public.teams(id) on delete set null,
  team2_id      uuid references public.teams(id) on delete set null,
  score1        integer check (score1 is null or score1 >= 0),
  score2        integer check (score2 is null or score2 >= 0),
  had_penalties boolean not null default false,
  pen1          integer check (pen1 is null or pen1 >= 0),
  pen2          integer check (pen2 is null or pen2 >= 0),
  winner_id     uuid references public.teams(id) on delete set null,
  status        text not null default 'pending'
                check (status in ('pending', 'completed', 'bye')),
  updated_at    timestamptz not null default now(),
  unique (tournament_id, round, position),
  -- Uma partida concluída tem de ter vencedor; empate exige penáltis.
  constraint completed_has_winner check (status <> 'completed' or winner_id is not null),
  constraint draw_needs_penalties check (
    status <> 'completed' or score1 <> score2 or (had_penalties and pen1 is not null and pen2 is not null and pen1 <> pen2)
  )
);
create index if not exists matches_tournament_idx on public.matches(tournament_id);
-- Partida a decorrer (também em supabase/migrations/002_match_live.sql).
alter table public.matches add column if not exists live boolean not null default false;

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists tournaments_touch on public.tournaments;
create trigger tournaments_touch before update on public.tournaments
  for each row execute function public.touch_updated_at();

drop trigger if exists matches_touch on public.matches;
create trigger matches_touch before update on public.matches
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Segurança: leitura pública, escrita apenas pelo backend (service role,
-- que ignora RLS). Visitantes nunca conseguem alterar dados.
-- ---------------------------------------------------------------------
alter table public.tournaments enable row level security;
alter table public.teams       enable row level security;
alter table public.matches     enable row level security;

drop policy if exists "public read tournaments" on public.tournaments;
create policy "public read tournaments" on public.tournaments for select using (true);

drop policy if exists "public read teams" on public.teams;
create policy "public read teams" on public.teams for select using (true);

drop policy if exists "public read matches" on public.matches;
create policy "public read matches" on public.matches for select using (true);

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['tournaments', 'teams', 'matches'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


notify pgrst, 'reload schema';
