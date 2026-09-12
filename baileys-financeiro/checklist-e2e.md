# Checklist de Testes End-to-End — Sistema Financeiro via WhatsApp

Testado até aqui, automaticamente (sem depender do WhatsApp real):
- ✅ 14/14 testes unitários da lógica crítica (formatação, cálculo de fatura,
  ajuste de saldo do cartão alimentação, arredondamento de dia de vencimento)
- ✅ Schema do Supabase confere com todas as colunas que o código usa

O que falta abaixo só dá pra validar com o sistema rodando de verdade (Fly +
WhatsApp conectado). Manda cada mensagem no grupo "CONTROLE FINANCEIRO", uma
de cada vez, espera a resposta, e marca o [ ] quando confirmar que bateu com
o esperado. Se quiser, me chama depois de cada bloco que eu confiro no
Supabase se gravou certo.

## 1. Os 7 lançamentos básicos

- [ ] `gastei 45 no mercado` → cartão vermelho (🔴), categoria Alimentação
- [ ] `recebi 3000 de salário` → cartão verde (🟢)
- [ ] `cadastra a internet, 100, todo dia 10` → "Conta Fixa Cadastrada", vence dia 10
- [ ] `comprei um tênis no Nubank, 200` → "Compra no Cartão Registrada" com a fatura certa
- [ ] `TV parcelada em 10x de 150` → "Parcelamento Cadastrado", total R$ 1.500
- [ ] `quero juntar 5000 pra viagem` → "Meta Cadastrada"
- [ ] `quero limitar 800 por mês em alimentação` → "Orçamento Definido"

## 2. Cartão alimentação (saldo)

- [ ] `recarreguei o Ticket com 600` → saldo novo = 600
- [ ] `gastei 40 no Ticket` → saldo novo = 560
- [ ] Confirmar no site, na página "Cartão Alimentação", que o saldo bate

## 3. Pergunta quando falta informação

- [ ] `gastei 50` (sem categoria) → bot pergunta a categoria
- [ ] Responder `mercado` → completa o lançamento com a categoria certa
- [ ] `aluguel 1500` (tipo ambíguo) → bot pergunta se é gasto, entrada ou conta fixa

## 4. Consulta de saldo sob demanda

- [ ] `qual meu saldo?` → responde na hora com entradas/gastos/saldo
- [ ] `quanto tenho no Ticket?` → responde só o saldo do cartão alimentação

## 5. Correção

- [ ] Mandar `gastei 45 no mercado`, depois (sem responder a mensagem)
      mandar `corrige, era 60 não 45` → corrige o valor do último lançamento seu
- [ ] Mandar um gasto qualquer, esperar o cartão de confirmação, **responder
      (reply/arrastar) direto naquela mensagem** com `errei a categoria, é Saúde`
      → corrige aquele lançamento específico
- [ ] Corrigir o valor de um `gasto_alimentacao` → conferir que o saldo do
      cartão foi ajustado pela diferença, não só o lançamento

## 6. Foto de comprovante

- [ ] Mandar uma foto de qualquer nota fiscal/recibo → bot lê valor e
      estabelecimento sozinho

## 7. Robustez (nunca deve ficar em silêncio)

- [ ] Mandar uma mensagem sem nexo nenhum (ex: "kkkkk") → bot responde algo
      casual/simpático (não é transação, mas o bot sempre responde — decisão
      explícita: nunca deixar parecer travado)
- [ ] Mandar a mesma mensagem duas vezes rapidinho (dá pra simular reenviando
      manualmente) → não deve gerar dois lançamentos duplicados

## 8. Cadeia de IA (gratuitas primeiro)

- [ ] Rodar `fly logs -a sistema-financeiro-baileys` durante um teste e
      confirmar que aparece `✅ Interpretado com Gemini.` (ou Groq/Mistral)
      na maioria das vezes — só deve cair pra Anthropic se as gratuitas
      falharem

## 9. Lembretes agendados (mais lento de testar)

- [ ] Esperar até 20h e conferir se o resumo do saldo chega sozinho
- [ ] Cadastrar uma conta fixa com vencimento daqui a exatamente 5 dias e
      esperar até 8h da manhã pra ver se o aviso dispara

---

Me avisa o resultado de cada bloco (ou só me diz "bloco 1 ok", "bloco 5 deu
erro tal") que eu ajudo a investigar o que não bateu.
