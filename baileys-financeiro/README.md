# Controle Financeiro via WhatsApp — versão sem n8n

Essa versão faz tudo sozinha, num único processo Node.js rodando no Fly.io:

1. Conecta ao WhatsApp (grupo "CONTROLE FINANCEIRO")
2. Interpreta cada mensagem chamando a API da Anthropic diretamente
3. Grava a transação no Supabase (`entradas` ou `gastos`)
4. Manda de volta o comentário + o cartão de confirmação no grupo
5. Roda dois lembretes automáticos:
   - Todo dia às 20h: saldo do dia
   - Todo dia às 8h: contas fixas vencendo em 5 dias e ainda não pagas

O n8n não é mais necessário para nada disso — os dois workflows antigos
("Financeiro - WhatsApp para Supabase (IA)", "Financeiro - Saldo Diário",
"Financeiro - Aviso de Contas a Vencer") podem ser desativados.

## Variáveis de ambiente (Fly secrets)

```bash
fly secrets set \
  ANTHROPIC_API_KEY="sk-ant-..." \
  SUPABASE_URL="https://smptdvscrudvclawdmla.supabase.co" \
  SUPABASE_SERVICE_KEY="sua-service-role-key" \
  SEND_TOKEN="escolha-um-token-secreto" \
  -a sistema-financeiro-baileys
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sim | Sua API key da Anthropic (console.anthropic.com) |
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Sim | Service role key (Project Settings > API) — bypassa RLS |
| `SEND_TOKEN` | Não (tem padrão) | Token do endpoint manual `/enviar` |
| `NOME_GRUPO_ALVO` | Não (padrão "CONTROLE FINANCEIRO") | Nome exato do grupo monitorado |
| `FAMILIA_ID` | Não (já tem padrão) | UUID da família no Supabase |
| `FUSO_HORARIO` | Não (padrão America/Sao_Paulo) | Fuso usado nos agendamentos |
| `ANTHROPIC_MODEL` | Não (padrão claude-sonnet-5) | Modelo usado para interpretar as mensagens |

## Deploy

```bash
fly deploy
```

Se a sessão do WhatsApp precisar reconectar, o próprio código já limpa
a sessão antiga automaticamente e gera um novo QR Code nos logs —
não é mais necessário entrar via SSH para apagar a pasta manualmente.

## Testando

```bash
curl -X POST https://sistema-financeiro-baileys.fly.dev/enviar \
  -H "Content-Type: application/json" \
  -H "x-send-token: SEU_TOKEN" \
  -d '{"texto":"teste manual"}'
```

## Pendências conhecidas

- Comprovante em foto e mensagem de áudio ainda não são interpretados
  nessa versão (só texto). Dá para adicionar depois usando a API de
  visão da Anthropic para imagens e um serviço de transcrição para áudio.
