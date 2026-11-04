-- Indica se a partida está a decorrer (mostra a borda vermelha "Ao vivo" no chaveamento).
-- Seguro de executar mais do que uma vez.
alter table public.matches
  add column if not exists live boolean not null default false;

notify pgrst, 'reload schema';
