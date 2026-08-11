-- Migração: dias de retenção configuráveis da Lixeira
-- Rode este script inteiro no SQL Editor do Supabase (uma vez só).

alter table familias add column if not exists dias_retencao_lixeira int not null default 30;
