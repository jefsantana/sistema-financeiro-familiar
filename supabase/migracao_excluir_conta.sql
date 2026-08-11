-- Migração: permite que cada pessoa exclua a própria conta de login
-- Rode este script inteiro no SQL Editor do Supabase (uma vez só).

create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.excluir_minha_conta() to authenticated;
