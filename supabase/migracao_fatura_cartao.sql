-- Migração: fatura de cartão de crédito
-- Rode este script inteiro no SQL Editor do Supabase (uma vez só).

alter table cartoes add column if not exists dia_vencimento int check (dia_vencimento between 1 and 31);

create table if not exists compras_cartao (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id),
  descricao text not null,
  valor numeric(12,2) not null,
  categoria text,
  cartao text not null,
  pessoa text,
  data_compra date not null,
  mes_fatura text not null,
  paga boolean not null default false,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);

alter table compras_cartao enable row level security;

create policy "familia_acessa_compras_cartao" on compras_cartao
  for all using (familia_id = public.minha_familia())
  with check (familia_id = public.minha_familia());
