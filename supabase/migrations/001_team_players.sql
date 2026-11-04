-- Nomes dos jogadores de cada dupla (ex.: "João, Pedro").
-- Seguro de executar mais do que uma vez.
alter table public.teams
  add column if not exists players text not null default '';

alter table public.teams
  drop constraint if exists teams_players_len;
alter table public.teams
  add constraint teams_players_len check (char_length(players) <= 120);

-- Pede ao PostgREST (API do Supabase) para recarregar o esquema já,
-- sem isto o erro "schema cache" pode continuar alguns minutos.
notify pgrst, 'reload schema';
