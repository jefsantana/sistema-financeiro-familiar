-- ============================================================
-- Sistema Financeiro Familiar — Schema inicial do Supabase
--
-- O que este arquivo faz, em palavras simples:
--   1. Cria as "gavetas" (tabelas) que vão guardar os dados:
--      entradas, gastos, categorias, contas fixas, parcelamentos,
--      cartões, metas, orçamentos e transferências.
--   2. Cria a família "Jeferson e Raquel" (primeira família do sistema).
--   3. Sempre que alguém se cadastra pela tela de login, cria
--      automaticamente uma família NOVA e isolada pra essa pessoa
--      (com os nomes informados no cadastro) — os dados de uma
--      família nunca aparecem para outra.
--   4. Ativa a proteção (RLS) que garante que só quem está
--      logado e pertence à família consegue ver ou mexer nos
--      dados — ninguém de fora tem acesso, mesmo tendo a chave
--      pública do projeto.
--
-- Como usar: copie este arquivo inteiro e cole no SQL Editor
-- do Supabase (menu lateral → SQL Editor → New query), depois
-- clique em "Run".
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- FAMÍLIA
-- ------------------------------------------------------------
create table familias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  pessoa_1 text,
  pessoa_2 text,
  foto_casal text,
  foto_casal_posicao int not null default 50,
  foto_pessoa_1 text,
  foto_pessoa_2 text,
  criado_em timestamptz not null default now()
);

insert into familias (id, nome, pessoa_1, pessoa_2)
values ('11111111-1111-1111-1111-111111111111', 'Jeferson e Raquel', 'Jeferson', 'Raquel');

-- ------------------------------------------------------------
-- PERFIS
-- Uma linha por pessoa que faz login. Liga o usuário do
-- Supabase (auth.users) à família e guarda o nome de exibição.
-- ------------------------------------------------------------
create table perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  familia_id uuid not null references familias(id),
  nome text not null,
  criado_em timestamptz not null default now()
);

-- Sempre que alguém cria login pela tela de cadastro, este gatilho
-- cria uma família NOVA e isolada pra essa pessoa (usando o nome dela
-- e, se informado, o nome da segunda pessoa) e liga o perfil a essa
-- família nova — nunca à de outra pessoa.
create function public.criar_perfil_automatico()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  nome_pessoa text := coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1));
  nome_pessoa_2 text := nullif(new.raw_user_meta_data->>'pessoa2', '');
  nome_familia text := coalesce(
    nullif(new.raw_user_meta_data->>'nome_familia', ''),
    case when nome_pessoa_2 is not null then nome_pessoa || ' e ' || nome_pessoa_2 else nome_pessoa end
  );
  nova_familia_id uuid;
begin
  insert into public.familias (nome, pessoa_1, pessoa_2)
  values (nome_familia, nome_pessoa, nome_pessoa_2)
  returning id into nova_familia_id;

  insert into public.perfis (id, familia_id, nome)
  values (new.id, nova_familia_id, nome_pessoa);

  insert into public.categorias (familia_id, nome, tipo)
  values
    (nova_familia_id, 'Salário', 'entrada'),
    (nova_familia_id, 'Freelance', 'entrada'),
    (nova_familia_id, 'Alimentação', 'gasto'),
    (nova_familia_id, 'Moradia', 'gasto'),
    (nova_familia_id, 'Transporte', 'gasto'),
    (nova_familia_id, 'Saúde', 'gasto'),
    (nova_familia_id, 'Lazer', 'gasto'),
    (nova_familia_id, 'Educação', 'gasto');

  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_automatico();

-- Função auxiliar: descobre a família da pessoa logada.
-- É usada em todas as regras de segurança abaixo.
create function public.minha_familia()
returns uuid
language sql
security definer set search_path = public
stable
as $$
  select familia_id from public.perfis where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- TABELAS DE DADOS FINANCEIROS
-- Todas seguem o mesmo padrão: familia_id (dono do registro) e
-- excluido_em/excluido_por (exclusão suave, para a Lixeira).
-- ------------------------------------------------------------

create table categorias (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id),
  nome text not null,
  tipo text not null check (tipo in ('entrada', 'gasto')),
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);

create table entradas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id),
  descricao text not null,
  valor numeric(12,2) not null,
  data date not null,
  categoria text,
  pessoa text,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);

create table gastos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id),
  descricao text not null,
  valor numeric(12,2) not null,
  data date not null,
  categoria text,
  cartao text,
  pessoa text,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);

create table contas_fixas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id),
  descricao text not null,
  valor numeric(12,2) not null,
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  categoria text,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);

create table parcelamentos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id),
  descricao text not null,
  valor_total numeric(12,2) not null,
  numero_parcelas int not null,
  parcela_atual int not null default 1,
  dia_vencimento int check (dia_vencimento between 1 and 31),
  cartao text,
  categoria text,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);

create table cartoes (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id),
  nome text not null,
  limite numeric(12,2),
  dia_fechamento int check (dia_fechamento between 1 and 31),
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);

create table metas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id),
  descricao text not null,
  valor_alvo numeric(12,2) not null,
  valor_atual numeric(12,2) not null default 0,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);

create table orcamentos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id),
  categoria text not null,
  limite_mensal numeric(12,2) not null,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);

create table transferencias (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id),
  descricao text not null,
  valor numeric(12,2) not null,
  data date not null,
  pessoa_origem text,
  pessoa_destino text,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);

create table pagamentos_contas_fixas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id),
  conta_fixa_id uuid not null references contas_fixas(id),
  mes_ano text not null,
  pessoa text,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);

create table pagamentos_parcelamentos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id),
  parcelamento_id uuid not null references parcelamentos(id),
  mes_ano text not null,
  pessoa text,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por text
);

-- ------------------------------------------------------------
-- SEGURANÇA (Row Level Security)
-- A partir daqui, cada tabela só pode ser lida ou alterada por
-- alguém logado que pertença à mesma família do registro.
-- ------------------------------------------------------------

alter table familias enable row level security;
alter table perfis enable row level security;
alter table categorias enable row level security;
alter table entradas enable row level security;
alter table gastos enable row level security;
alter table contas_fixas enable row level security;
alter table parcelamentos enable row level security;
alter table cartoes enable row level security;
alter table metas enable row level security;
alter table orcamentos enable row level security;
alter table transferencias enable row level security;
alter table pagamentos_contas_fixas enable row level security;
alter table pagamentos_parcelamentos enable row level security;

create policy "ver_proprio_perfil" on perfis
  for select using (id = auth.uid());

create policy "familia_ve_a_propria_familia" on familias
  for select using (id = public.minha_familia());

create policy "familia_atualiza_a_propria_familia" on familias
  for update using (id = public.minha_familia()) with check (id = public.minha_familia());

do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'categorias', 'entradas', 'gastos', 'contas_fixas', 'parcelamentos',
    'cartoes', 'metas', 'orcamentos', 'transferencias',
    'pagamentos_contas_fixas', 'pagamentos_parcelamentos'
  ]
  loop
    execute format(
      'create policy "familia_acessa_%1$s" on %1$s for all using (familia_id = public.minha_familia()) with check (familia_id = public.minha_familia());',
      tabela
    );
  end loop;
end $$;
