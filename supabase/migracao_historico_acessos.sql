-- Migração: histórico de acessos (login)
-- Rode este script inteiro no SQL Editor do Supabase (uma vez só).

create table if not exists historico_acessos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfis(id) on delete cascade,
  navegador text,
  sistema text,
  dispositivo text,
  criado_em timestamptz not null default now()
);

alter table historico_acessos enable row level security;

create policy "usuario_ve_proprio_historico_acessos" on historico_acessos
  for select using (perfil_id = auth.uid());

create policy "usuario_registra_proprio_acesso" on historico_acessos
  for insert with check (perfil_id = auth.uid());
