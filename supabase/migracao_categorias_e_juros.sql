-- Migração: categorias customizáveis + juros no parcelamento
-- Rode este script inteiro no SQL Editor do Supabase (uma vez só).

-- 1) Categorias customizadas (adicionadas pela família, além das fixas)
alter table categorias add column if not exists icone text not null default 'Tag';

-- 2) Preço original da compra (sem juros) nos parcelamentos
alter table parcelamentos add column if not exists valor_original numeric(12,2);

-- 3) O cadastro de usuário não semeia mais categorias fixas em
-- "categorias" — a lista fixa já vem do código, e as linhas antigas
-- (Salário, Freelance, Alimentação, Moradia, Transporte, Saúde,
-- Lazer, Educação) coincidem exatamente com nomes já fixos, então o
-- app já as ignora automaticamente. Não é preciso apagar nada à mão.
create or replace function public.criar_perfil_automatico()
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

  return new;
end;
$$;
