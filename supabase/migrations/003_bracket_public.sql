-- Controla se o chaveamento (confrontos e resultados) está visível na página pública.
-- Torneios já existentes continuam visíveis (default true); os novos são criados
-- ocultos pelo backend até o administrador os publicar.
-- Seguro de executar mais do que uma vez.
alter table public.tournaments
  add column if not exists bracket_public boolean not null default true;

-- Visitantes (chave anon) só leem partidas de torneios com o chaveamento publicado.
-- O backend usa a service role, que ignora o RLS.
drop policy if exists "public read matches" on public.matches;
create policy "public read matches" on public.matches for select using (
  exists (
    select 1 from public.tournaments t
    where t.id = matches.tournament_id and t.bracket_public
  )
);

notify pgrst, 'reload schema';
