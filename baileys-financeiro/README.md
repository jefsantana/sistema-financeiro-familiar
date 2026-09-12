# Controle Financeiro via WhatsApp — versão sem n8n

Essa versão faz tudo sozinha, num único processo Node.js rodando no Fly.io:

1. Conecta ao WhatsApp (grupo "CONTROLE FINANCEIRO")
2. Interpreta cada mensagem (texto, foto de comprovante, ou áudio se configurado)
   chamando a API da Anthropic diretamente — entende os 7 tipos de lançamento do
   sistema: **gasto**, **entrada**, **conta fixa**, **compra no cartão**,
   **parcelamento**, **meta** e **orçamento**
3. Se faltar alguma informação (ex: categoria, cartão, número de parcelas, ou
   qual dos 7 tipos é), pergunta de volta no grupo e espera a resposta da
   pessoa antes de gravar
4. Grava o lançamento na tabela certa do Supabase (`entradas`, `gastos`,
   `contas_fixas`, `compras_cartao`, `parcelamentos`, `metas` ou `orcamentos`)
5. Manda de volta o comentário + o cartão de confirmação no grupo
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
  OPENAI_API_KEY="sk-..." \
  SEND_TOKEN="escolha-um-token-secreto" \
  -a sistema-financeiro-baileys
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sim | Sua API key da Anthropic (console.anthropic.com) |
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Sim | Service role key (Project Settings > API) — bypassa RLS |
| `OPENAI_API_KEY` | Não (mas sem ela, áudio é ignorado) | Usada só para transcrever mensagens de áudio (Whisper) |
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

- A transcrição de áudio (Whisper) recebe o arquivo no formato original
  do WhatsApp (geralmente `.ogg`/opus). Na grande maioria dos casos isso
  funciona direto, mas se algum áudio específico falhar na transcrição,
  pode ser necessário converter o arquivo antes (ex: com `ffmpeg`) —
  ainda não implementado nessa versão.
