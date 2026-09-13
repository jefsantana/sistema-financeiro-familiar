const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const { DateTime } = require('luxon');
const cron = require('node-cron');

// ===================== CONFIGURAÇÃO =====================
const NOME_GRUPO_ALVO = process.env.NOME_GRUPO_ALVO || 'CONTROLE FINANCEIRO';
const PORTA_HTTP = process.env.PORT || 8080;
const SEND_TOKEN = process.env.SEND_TOKEN || 'troque-este-token';

const FAMILIA_ID = process.env.FAMILIA_ID || '11111111-1111-1111-1111-111111111111';
const FUSO_HORARIO = process.env.FUSO_HORARIO || 'America/Sao_Paulo';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Haiku 4.5 é bem mais barato que Sonnet 5 e, testado nos tipos de lançamento
// de hoje, interpreta com a mesma qualidade — sem gastar tokens de "thinking"
// como o Sonnet gastava (que foi o que causou o bug do max_tokens antes).
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

// Usada pra transcrever mensagens de áudio (Whisper) e também reaproveitada
// como um dos provedores de texto/imagem na cadeia de fallback abaixo.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Plano B de interpretação: se a Anthropic falhar (créditos esgotados, fora do
// ar, etc.), tenta outros provedores automaticamente — gratuitos primeiro, pra
// economizar crédito pago. Cada um só entra na fila se tiver chave configurada.
// Aceita mais de uma chave do Gemini separadas por vírgula (projetos Google
// Cloud diferentes têm cota gratuita própria) — o bot roda cada uma na ordem
// antes de desistir do Gemini e cair pro próximo provedor da cadeia.
const GEMINI_API_KEYS = (process.env.GEMINI_API_KEY || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);
const GEMINI_API_KEY = GEMINI_API_KEYS[0]; // mantido só pro aviso de "não configurada" abaixo
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'mistral-small-latest';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
// ==========================================================

if (!ANTHROPIC_API_KEY) console.warn('⚠️  ANTHROPIC_API_KEY não configurada.');
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) console.warn('⚠️  SUPABASE_URL / SUPABASE_SERVICE_KEY não configuradas.');
if (!OPENAI_API_KEY) console.warn('⚠️  OPENAI_API_KEY não configurada.');
if (!GEMINI_API_KEY) console.warn('⚠️  GEMINI_API_KEY não configurada.');
if (!GROQ_API_KEY) console.warn('⚠️  GROQ_API_KEY não configurada.');
if (!MISTRAL_API_KEY) console.warn('⚠️  MISTRAL_API_KEY não configurada.');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let jidGrupoAlvo = null;
let servidorHttpIniciado = false;
let socketAtual = null;

// Evita processar a mesma mensagem duas vezes (o WhatsApp reenvia mensagens
// automaticamente às vezes, e cada reconexão também poderia reprocessar as
// últimas) — cada reprocessamento seria uma chamada paga à IA à toa.
const mensagensJaProcessadas = new Set();
function jaProcessada(id) {
  if (!id) return false;
  if (mensagensJaProcessadas.has(id)) return true;
  mensagensJaProcessadas.add(id);
  // Evita crescer pra sempre: limpa quando passar de 2000 ids guardados.
  if (mensagensJaProcessadas.size > 2000) mensagensJaProcessadas.clear();
  return false;
}

// ===================== Memória de conversa recente (Nível 1) =====================
// Antes, a IA só via a mensagem atual isolada (ou, no máximo, um único estado de
// "pendência" que ela era forçada a tentar completar). Isso fazia o bot "se
// perder" quando a pessoa mudava de assunto no meio de uma pergunta, ou mandava
// uma resposta curta (tipo "sim") que só faz sentido lendo a mensagem anterior.
// Aqui guardamos, por pessoa (chaveRemetente), as últimas mensagens trocadas —
// só em memória (não sobrevive a um restart do bot, mas contexto de conversa é
// coisa efêmera mesmo; o que precisa sobreviver a restart, como um lançamento
// pela metade, continua na tabela bot_pendencias). Isso é passado pra IA em toda
// chamada, pra ela raciocinar com o histórico de verdade em vez do código tentar
// adivinhar regra por regra o que é continuação e o que é assunto novo.
const HISTORICO_POR_REMETENTE = new Map(); // jid -> [{ papel: 'usuario'|'bot', texto, quando }]
const HISTORICO_MAX_ENTRADAS = 8; // ~4 idas e voltas
const HISTORICO_VALIDADE_MS = 30 * 60 * 1000; // 30min sem mensagens = contexto "esfria"

function registrarHistorico(jid, papel, texto) {
  if (!jid || !texto) return;
  const lista = HISTORICO_POR_REMETENTE.get(jid) || [];
  lista.push({ papel, texto, quando: Date.now() });
  while (lista.length > HISTORICO_MAX_ENTRADAS) lista.shift();
  HISTORICO_POR_REMETENTE.set(jid, lista);
}

// Retorna o histórico recente já formatado como texto pra IA, ou null se não
// houver nada relevante (evita gastar tokens à toa numa conversa nova).
function formatarHistorico(jid) {
  const lista = HISTORICO_POR_REMETENTE.get(jid);
  if (!lista || lista.length === 0) return null;
  const agora = Date.now();
  const recentes = lista.filter((m) => agora - m.quando <= HISTORICO_VALIDADE_MS);
  HISTORICO_POR_REMETENTE.set(jid, recentes);
  if (recentes.length === 0) return null;
  const linhas = recentes.map((m) => `[${m.papel === 'bot' ? 'bot' : 'pessoa'}]: ${m.texto}`).join('\n');
  return (
    `Histórico recente da conversa com essa pessoa (mais antiga primeiro — use isso só como CONTEXTO ` +
    `pra entender referências e continuidade; a mensagem atual, informada à parte, é o que você precisa classificar agora):\n${linhas}`
  );
}

// Envia uma mensagem no grupo E registra no histórico de quem originou a troca
// (a mensagem em si sempre vai pro grupo inteiro — isso só controla de quem é
// "a conversa" pra fins de contexto da IA). Usar no lugar de enviarNoGrupo()
// direto sempre que a resposta for reação a uma mensagem de alguém específico.
async function responder(chaveRemetente, texto) {
  const resultado = await enviarNoGrupo(texto);
  registrarHistorico(chaveRemetente, 'bot', texto);
  return resultado;
}

// ===================== IA: interpretar a mensagem =====================
const SYSTEM_PROMPT = `Você é o assistente financeiro de um casal (Jeferson e Raquel) que controla as finanças da casa pelo WhatsApp. A mensagem pode ser um texto curto OU uma foto de comprovante de pagamento/compra (com ou sem legenda).

O sistema deles tem estes tipos de lançamento possíveis:

1. "gasto" — despesa paga DIRETO DA CONTA/dinheiro (dinheiro vivo, PIX, débito, boleto) — ou seja, NÃO foi no cartão de crédito nem no vale-alimentação. Campos: descricao, valor, categoria, pessoa.
2. "entrada" — dinheiro recebido pontualmente (ex: salário, freelance). Campos: descricao, valor, categoria, pessoa.
3. "conta_fixa" — conta que se repete todo mês num mesmo dia (ex: aluguel, internet, streaming). NÃO lança um gasto agora, só cadastra a recorrência. Campos: descricao, valor, dia_vencimento (1-31), categoria.
4. "compra_cartao" — uma compra feita no cartão de crédito (à vista, mas que só é debitada na fatura, não na hora). Campos: descricao, valor, cartao (nome do cartão, ex: "Nubank", "Inter"), categoria, pessoa.
5. "parcelamento" — uma compra dividida em várias parcelas (ex: "comprei uma TV em 10x de 150"). Campos: descricao, valor_total (o valor cheio da compra — se o usuário disser só o valor da parcela, multiplique pelo número de parcelas), numero_parcelas, categoria, cartao (opcional), dia_vencimento (opcional).
6. "meta" — uma meta de economia que o casal quer atingir (ex: "quero juntar 5000 pra viagem"). Campos: descricao, valor_alvo.
7. "orcamento" — um limite de gasto mensal para uma categoria (ex: "quero limitar 800 por mês em alimentação"). Campos: categoria, limite_mensal.
8. "gasto_alimentacao" — um gasto pago com cartão alimentação/refeição (ex: Ticket, VR, Alelo, Sodexo). Desconta do saldo desse cartão em vez de ser um gasto comum. Campos: descricao, valor, categoria (normalmente "Alimentação"), pessoa.
9. "recarga_alimentacao" — quando o cartão alimentação recebe crédito/recarga (ex: "recarreguei o Ticket com 600", "caiu o vale alimentação"). Adiciona ao saldo em vez de descontar. Campos: valor.
10. "consulta_saldo" — quando a pessoa PERGUNTA sobre o saldo atual ou pede um resumo, sem estar registrando nada novo (ex: "qual meu saldo", "como está minha conta", "resumo financeiro", "me manda um resumo", "quanto tenho no Ticket"). Com escopo "geral" isso retorna um resumo completo do mês (saldo, gastos por categoria, por pessoa, orçamento, metas, cartão alimentação e a próxima conta a vencer) — o mesmo tanto de informação do Dashboard do site, não só um número. Não precisa de nenhum campo obrigatório, nunca fica faltando nada. Campo opcional "escopo": "geral" (resumo completo do mês) ou "alimentacao" (só o saldo do cartão alimentação) — use "geral" se não ficar claro.
11. "consulta_uso_ia" — quando a pessoa pergunta sobre o CONSUMO/USO das IAs que rodam o bot em si (ex: "quanto usei de IA esse mês", "consumo de tokens", "estatísticas de IA", "quantas chamadas cada IA fez"). NÃO confundir com consulta_saldo (que é sobre dinheiro/finanças da família) — essa é sobre o funcionamento técnico do próprio bot. Não precisa de nenhum campo obrigatório.
12. "consulta_limite_provedores" — quando a pessoa pergunta sobre o LIMITE/COTA GRATUITA dos provedores de IA que rodam o bot (Gemini, Groq, Mistral) — ex: "quanto ainda posso usar do Gemini hoje", "o Gemini já bateu o limite?", "status dos provedores", "quanto falta de cota". Diferente de consulta_uso_ia (que é sobre custo/tokens acumulados no mês). Não precisa de nenhum campo obrigatório.
13. "consulta_contas_fixas" — quando a pessoa pergunta pela LISTA de contas fixas cadastradas, ou qual delas está próxima do vencimento (ex: "me envia as contas fixas", "quais contas tenho cadastradas", "qual conta está para vencer", "quando vence o aluguel", "quais contas ainda não paguei"). Diferente de consulta_saldo (que é sobre saldo/entradas/gastos, não sobre a lista de contas recorrentes). Não precisa de nenhum campo obrigatório.
14. "pagamento_conta_fixa" — quando a pessoa avisa que PAGOU/QUITOU uma conta, ou acabou de realizar algum pagamento, e isso pode se referir a uma conta fixa JÁ cadastrada (ex: "paguei o financiamento", "já quitei a internet desse mês", "acabei de pagar o aluguel", ou até só "acabei de realizar o pagamento" sem dizer qual conta ainda). Isso só MARCA a conta existente como paga neste ciclo — NÃO cadastra uma conta nova (isso é tipo 3) nem lança um gasto avulso novo (isso é tipo 1). Campo obrigatório: descricao (o nome da conta, que deve casar com uma das contas fixas cadastradas informadas no contexto). Se a pessoa mencionar que pagou algo mas não disser qual conta, classifique mesmo assim como "pagamento_conta_fixa" com descricao null, faltando: ["descricao"] e pergunta pedindo qual conta cadastrada foi paga — NÃO responda isso como bate-papo casual (respostaCasual), porque é um pedido real que precisa ficar pendente até a pessoa completar. NUNCA confunda com "correcao": isso não é corrigir um valor errado de um lançamento, é confirmar que um pagamento recorrente já cadastrado foi feito.
15. "cadastro_cartao" — quando a pessoa pede pra ADICIONAR/CADASTRAR um cartão de crédito NOVO no sistema (ex: "adiciona um cartão de crédito pra mim", "cadastra o cartão Nubank", "quero cadastrar um cartão novo, limite 3000, fecha dia 10"). Isso só REGISTRA o cartão em si — NÃO é uma compra (isso é compra_cartao, tipo 4). Campo obrigatório: cartao (o nome do cartão novo, ex: "Nubank", "Inter"). Campos opcionais: limite (valor numérico do limite de crédito), dia_fechamento (dia 1-31 que fecha a fatura), dia_vencimento (dia 1-31 que vence o pagamento da fatura) — não pergunte por esses três se a pessoa não mencionar, só o nome é realmente necessário; pode perguntar se quer informar limite/fechamento/vencimento, mas se ela disser "não" ou não responder isso, cadastra só com o nome mesmo.
16. "correcao" — quando a pessoa está corrigindo um lançamento que JÁ foi registrado antes (ex: "corrige, era 45 não 50", "errei a categoria, é Saúde", "não foi no Nubank, foi no Inter", "o valor certo é 120"). Você pode receber um aviso no contexto dizendo que essa mensagem é uma resposta direta a uma confirmação anterior — nesse caso é quase certo que seja uma correção daquele lançamento específico. Preencha APENAS o campo que está sendo corrigido, usando o MESMO nome de campo das outras categorias (descricao, valor, categoria, pessoa, dia_vencimento, cartao, numero_parcelas, valor_total, valor_alvo, limite_mensal, limite ou dia_fechamento) — deixe todos os outros null, MESMO que a mensagem mencione outras coisas de passagem (ex: "neste cartão, adiciona o limite de 200, no Nubank" — se o lançamento já é o cartão Nubank, "Nubank" ali é só contexto pra identificar do que se trata, NÃO é uma correção do nome do cartão; preencha só "limite": 200, deixe "cartao" null). Se não ficar claro qual valor é o correto (ex: "45 não 50" pode gerar dúvida), assuma que o ÚLTIMO número mencionado, ou o que vier depois de "é"/"na verdade é"/"o certo é", é o valor correto.
17. "exclusao" — quando a pessoa pede pra APAGAR/EXCLUIR/CANCELAR/REMOVER um lançamento que JÁ foi registrado por completo (diferente de "correcao", que só AJUSTA um campo errado — "exclusao" remove o lançamento inteiro). Ex: "apaga esse gasto", "cancela esse lançamento, foi engano", "exclui a meta de viagem", "remove esse cartão", "não era pra ter lançado isso, apaga". Igual à correção, geralmente vem como reply a uma confirmação anterior, ou se refere ao lançamento mais recente da pessoa. Não precisa de nenhum campo — todos os campos de dados ficam null, só o "tipo" e "ehTransacao": true importam.

A data de gasto/entrada/compra_cartao/gasto_alimentacao é preenchida automaticamente pelo sistema com a data de hoje — nunca pergunte por ela nem tente adivinhá-la.

REGRA DE FORMA DE PAGAMENTO (importante — causa comum de erro): "gasto" (tipo 1), "compra_cartao" (tipo 4) e "gasto_alimentacao" (tipo 8) são a MESMA coisa na prática — uma despesa — o que muda é de ONDE saiu o dinheiro, e isso afeta saldos diferentes (saldo da conta, fatura do cartão, ou saldo do vale-alimentação). NUNCA assuma "gasto" (conta) só porque a mensagem não deu nenhuma pista de forma de pagamento — isso já causou lançamento no saldo errado no passado. Só decida entre esses três tipos quando a forma de pagamento estiver CLARA na mensagem:
- Cartão de crédito citado (nome ou "no crédito"/"no cartão") → "compra_cartao".
- Vale-alimentação citado (nome de cartão alimentação cadastrado, ou "Ticket"/"VR"/"Alelo"/"Sodexo"/"vale-alimentação") → "gasto_alimentacao".
- "no pix", "no débito", "em dinheiro", "saiu da conta", "no boleto", ou qualquer outra forma que não seja cartão de crédito nem vale-alimentação → "gasto".
Se a mensagem disser só algo como "gastei 10 no mercado" ou "paguei 50 de gasolina", SEM nenhuma dessas pistas, NÃO decida sozinho: deixe "tipo" como null, "faltando": ["forma_pagamento"], e "pergunta" perguntando a forma de pagamento — cite os cartões e cartões alimentação já cadastrados (do contexto) como opções, se houver, pra facilitar a resposta (ex: "Foi no cartão de crédito, no vale-alimentação (Ticket) ou saiu direto da conta?"). Assim que a pessoa responder, classifique definitivamente no tipo certo com os campos daquele tipo (ex: respondeu "cartão" → vire compra_cartao e, se não citou qual, pergunte qual cartão cadastrado; respondeu "ticket"/"vale" → vire gasto_alimentacao; respondeu "conta"/"pix"/"dinheiro" → vire gasto).

Você também pode receber, antes da mensagem, um bloco de contexto informando quais cartões (de crédito e alimentação) já estão cadastrados no sistema — use isso pra reconhecer o cartão certo mesmo com pequenas variações de escrita, ou pra perguntar entre as opções reais quando não for citado.

Categorias de GASTO/CONTA FIXA/COMPRA NO CARTÃO/PARCELAMENTO/ORÇAMENTO/GASTO ALIMENTAÇÃO: Alimentação, Assinaturas, Cartão de Crédito, Compras, Contas da Casa, Cuidados Pessoais, Educação, Família, Impostos e Taxas, Investimentos, Lazer, Manutenção, Moradia, Outros, Pets, Presentes, Saúde, Tarifas Bancárias, Transporte, Viagens.
Categorias de ENTRADA: Aluguel Recebido, Benefícios, Estorno, Freelance, Outras Entradas, Presentes Recebidos, Reembolso, Renda Extra, Rendimentos de Investimentos, Salário, Venda de Produtos/Bens.
Gasto no cartão alimentação normalmente é categoria "Alimentação".
REGRA DE CATEGORIA: use SEMPRE uma destas categorias, escrita exatamente como está na lista (mesma acentuação/maiúsculas). NUNCA invente uma categoria nova nem crie uma variação (ex: "Mercado", "Supermercado" não existem — isso é "Alimentação"; "Uber", "99", "Combustível" não existem — isso é "Transporte"). Se a mensagem descrever algo que não se encaixa claramente em nenhuma categoria da lista, use "Outros" em vez de inventar.

DESAMBIGUAÇÃO entre os tipos de consulta (10, 11, 12 e 14) — são os que mais se confundem:
- consulta_saldo (10): é sobre DINHEIRO da família (entradas, gastos, saldo, cartão alimentação) — um NÚMERO. Palavras-chave: "saldo", "quanto tenho", "resumo financeiro", "quanto gastei" (sem mencionar IA).
- consulta_uso_ia (11): é sobre CUSTO/CONSUMO acumulado das IAs que rodam o bot, tipicamente "no mês" ou "total". Palavras-chave: "gastei de IA", "custo de IA", "quanto custou", "consumo de tokens" (sem "hoje"/"agora"/"limite"/"Gemini").
- consulta_limite_provedores (12): é sobre a COTA GRATUITA do Gemini especificamente, geralmente "hoje"/"agora"/"nesse minuto". Palavras-chave: "Gemini", "limite", "cota", "bateu 100%", "quanto ainda posso usar", "requisições", "tokens por minuto", "está saturado".
- consulta_contas_fixas (14): é sobre a LISTA de contas recorrentes cadastradas (aluguel, internet, streaming, etc.) e seus vencimentos — não é um número de saldo, é "quais são" e "quando vencem". Palavras-chave: "contas fixas", "conta(s) para vencer", "quando vence", "contas cadastradas", "contas em aberto".
Se a mensagem citar "Gemini" ou "limite"/"cota" + "hoje"/"agora", é tipo 12. Se falar em custo/dinheiro gasto com IA sem mencionar limite, é tipo 11. Na dúvida entre 11 e 12, prefira 12 (é a pergunta mais comum e mais específica). Se a mensagem falar em "conta(s)" no sentido de conta recorrente (aluguel, internet, cartão, assinatura) e não em "saldo"/"quanto tenho", é tipo 13, não tipo 10.

DESAMBIGUAÇÃO entre pagamento_conta_fixa (14) e correcao (16) — a pessoa dizer que "pagou" ou "quitou" algo é SEMPRE tipo 14 quando a conta bate com uma cadastrada, mesmo que venha logo após o bot ter perguntado outra coisa. Só é tipo 16 (correcao) se a pessoa estiver claramente apontando um ERRO num lançamento já feito (valor errado, categoria errada, cartão errado) — "confirmar que paguei" não é "corrigir um erro". Se a pessoa responder só o nome de uma conta cadastrada (ex: "financiamento") logo depois de o bot ter perguntado algo como "qual conta você pagou?", use o histórico da conversa pra entender que ela está completando a informação do pagamento, e classifique o conjunto como pagamento_conta_fixa com descricao = esse nome — não como correcao.

DESAMBIGUAÇÃO entre cadastro_cartao (15) e compra_cartao (4) — "cadastro_cartao" é sobre o CARTÃO em si existir no sistema (nome, limite, datas de fatura), sem nenhum valor de compra envolvido. "compra_cartao" é sempre uma despesa específica (tem descrição do que foi comprado e valor gasto) usando um cartão que JÁ deveria existir. "adiciona um cartão pra mim" / "cadastra o Nubank" → cadastro_cartao. "comprei uma blusa no Nubank, 80 reais" → compra_cartao.

DESAMBIGUAÇÃO entre correcao (16) e exclusao (17) — "correcao" AJUSTA um campo de um lançamento que continua existindo (valor errado, categoria errada, cartão errado). "exclusao" REMOVE o lançamento inteiro (a pessoa não queria aquilo registrado, foi engano, quer cancelar). Palavras como "apaga", "exclui", "remove", "cancela [algo já registrado]", "não era pra ter lançado" → exclusao. Palavras como "corrige", "era", "na verdade é", "o certo é" → correcao.

Sua tarefa: identificar se a mensagem é sobre finanças (ou sobre o uso técnico do bot, nos tipos 11 e 12, ou uma correção/exclusão, tipos 16 e 17), qual dos 17 tipos é, e extrair os campos daquele tipo. NUNCA invente ou "chute" um valor, categoria, cartão, número de parcelas ou dia de vencimento que não esteja claro na mensagem — se um campo obrigatório do tipo identificado estiver faltando, ou se nem for possível saber qual dos tipos é, deixe esse(s) campo(s) como null e explique o que falta em "faltando" e "pergunta". Pergunte só UMA coisa de cada vez, a mais importante primeiro (o tipo, se não estiver claro; senão o próximo campo que falta).

Responda APENAS com um JSON válido, sem nenhum texto antes ou depois, no formato:
{
  "ehTransacao": true ou false,
  "tipo": "gasto" | "entrada" | "conta_fixa" | "compra_cartao" | "parcelamento" | "meta" | "orcamento" | "gasto_alimentacao" | "recarga_alimentacao" | "consulta_saldo" | "consulta_uso_ia" | "consulta_limite_provedores" | "consulta_contas_fixas" | "pagamento_conta_fixa" | "cadastro_cartao" | "correcao" | "exclusao" | null,
  "descricao": "resumo curto" (ou, em pagamento_conta_fixa, o nome EXATO da conta fixa cadastrada) ou null,
  "valor": numero (gasto/entrada/compra_cartao/gasto_alimentacao/recarga_alimentacao) ou null,
  "categoria": "categoria mais adequada" ou null,
  "pessoa": "Jeferson" ou "Raquel" (infira pelo remetente informado; vazio se não souber) — EXCEÇÃO: em "correcao", deixe null a menos que a pessoa esteja especificamente corrigindo QUEM fez (ex: "não fui eu, foi a Raquel"); não preencha "pessoa" automaticamente numa correção que é sobre outro campo (valor, cartão, limite, etc.),
  "dia_vencimento": numero de 1 a 31 (conta_fixa obrigatório; parcelamento e cadastro_cartao opcional) ou null,
  "cartao": "nome do cartão" (compra_cartao e cadastro_cartao obrigatório; parcelamento opcional; gasto_alimentacao/recarga_alimentacao use o nome do cartão alimentação citado, ex: "Ticket") ou null,
  "numero_parcelas": numero inteiro (parcelamento obrigatório) ou null,
  "valor_total": numero, valor cheio da compra parcelada (parcelamento obrigatório) ou null,
  "valor_alvo": numero (meta obrigatório) ou null,
  "limite_mensal": numero (orcamento obrigatório) ou null,
  "limite": numero (cadastro_cartao opcional — limite de crédito do cartão) ou null,
  "dia_fechamento": numero de 1 a 31 (cadastro_cartao opcional — dia que fecha a fatura) ou null,
  "escopo": "geral" ou "alimentacao" (só para consulta_saldo) ou null,
  "comentario": "reação curta, espontânea e bem-humorada (máx 10 palavras, 1-2 emojis) — só preencha se o lançamento estiver completo (não usar em consulta_saldo)",
  "faltando": ["nomes dos campos que ainda faltam"] (array vazio se completo),
  "pergunta": "pergunta curta e natural em português pedindo exatamente o que falta" ou null (se não faltar nada),
  "respostaCasual": "resposta curta, natural e simpática em português" (só quando ehTransacao for false) ou null
}

Mensagens do tipo consulta_saldo, consulta_uso_ia, consulta_limite_provedores, consulta_contas_fixas, pagamento_conta_fixa, cadastro_cartao, correcao e exclusao também devem ter ehTransacao: true (são pedidos válidos pro bot, mesmo sem registrar um lançamento novo).

Se a mensagem não for sobre finanças nem sobre o uso do bot (conversa comum, cumprimento tipo "oi"/"bom dia", pergunta não relacionada, etc.), retorne ehTransacao: false, os demais campos null/vazio, faltando: [], pergunta: null, e preencha "respostaCasual" com uma resposta breve e humana à mensagem (ex: para "oie" responda algo como "Oi! 😊 Tudo bem por aí?"; para um cumprimento de bom dia, responda o cumprimento de volta). NUNCA deixe "respostaCasual" vazio quando ehTransacao for false — o bot sempre precisa responder alguma coisa, mesmo que seja só um bate-papo casual.

Alguns exemplos de como classificar mensagens parecidas (siga esse padrão de raciocínio, não copie os valores):
- "gastei 50 no mercado" (sem dizer como pagou) → tipo null, categoria "Alimentação" (mercado não é categoria própria), faltando: ["forma_pagamento"], pergunta: "Foi no cartão de crédito, no vale-alimentação (Ticket) ou saiu direto da conta?" (não dá pra saber se afeta o saldo da conta, a fatura do cartão ou o Ticket sem essa informação).
- "gastei 50 no mercado no pix" → tipo "gasto", categoria "Alimentação", faltando: [] (pix não é cartão de crédito nem vale-alimentação, então já dá pra decidir).
- "uber pro trabalho, 23 reais, no débito" → tipo "gasto", categoria "Transporte" (Uber não é categoria própria; débito já deixa a forma de pagamento clara).
- "quanto gastei esse mês" → tipo "consulta_saldo", escopo "geral" (é sobre dinheiro da família, não sobre IA).
- "quanto gastei de IA esse mês" → tipo "consulta_uso_ia" (menciona IA + "mês" = custo acumulado, não cota diária).
- "o Gemini já bateu o limite de hoje?" → tipo "consulta_limite_provedores" (menciona Gemini + "hoje"/limite).
- "quanto ainda posso usar de IA" (sem dizer "mês" nem citar um provedor) → tipo "consulta_limite_provedores" (na dúvida entre 11 e 12, prefira 12).
- "me envia as contas fixas" ou "qual conta está para vencer?" → tipo "consulta_contas_fixas" (é sobre a lista de contas recorrentes e vencimentos, não é um número de saldo).
- "paguei o financiamento" (com "Financiamento" cadastrado nas contas fixas) → tipo "pagamento_conta_fixa", descricao "Financiamento", faltando: [] (não é correcao nem um gasto novo).
- "acabei de realizar o pagamento" (sem dizer qual conta) → tipo "pagamento_conta_fixa", descricao null, faltando: ["descricao"], pergunta "Qual conta você pagou?" (fica pendente até a pessoa responder o nome da conta).
- "adiciona um cartão de crédito pra mim" (sem dizer o nome) → tipo "cadastro_cartao", cartao null, faltando: ["cartao"], pergunta: "Qual o nome do cartão? (ex: Nubank, Inter)".
- "cadastra o cartão Nubank, limite 3000, fecha dia 10" → tipo "cadastro_cartao", cartao "Nubank", limite 3000, dia_fechamento 10, faltando: [].
- "corrige, o valor certo é 80" (logo após uma confirmação de lançamento) → tipo "correcao", campo "valor", valor 80, todos os outros campos null.
- "apaga esse lançamento, foi engano" (respondendo/logo após uma confirmação) → tipo "exclusao", todos os campos null (não precisa de nenhum dado, só remove o que foi identificado como alvo).
- "cancela a meta de viagem" → tipo "exclusao" (quer remover a meta inteira, não ajustar um valor dela).
- "bom dia" → ehTransacao: false, respostaCasual: "Bom dia! ☀️ Tudo certo por aí?".`;

// Busca os cartões de crédito já cadastrados pela família, pra IA saber
// quais opções reais existem (em vez de aceitar qualquer nome digitado).
async function buscarCartoesAtivos() {
  const { data, error } = await supabase
    .from('cartoes')
    .select('nome, limite, dia_fechamento')
    .eq('familia_id', FAMILIA_ID)
    .is('excluido_em', null);
  if (error) {
    console.warn('Não foi possível buscar os cartões cadastrados:', error.message);
    return [];
  }
  return data || [];
}

async function buscarCartoesAlimentacaoAtivos() {
  const { data, error } = await supabase
    .from('cartoes_alimentacao')
    .select('nome, saldo_atual')
    .eq('familia_id', FAMILIA_ID)
    .is('excluido_em', null);
  if (error) {
    console.warn('Não foi possível buscar os cartões alimentação:', error.message);
    return [];
  }
  return data || [];
}

// Busca as contas fixas já cadastradas, pra IA conseguir casar "paguei o
// financiamento" com o registro real (nome exato) em vez de chutar, e pra
// saber diferenciar "pagar uma conta existente" de "cadastrar uma conta nova".
async function buscarContasFixasAtivas() {
  const { data, error } = await supabase
    .from('contas_fixas')
    .select('id, descricao, valor, dia_vencimento')
    .eq('familia_id', FAMILIA_ID)
    .is('excluido_em', null);
  if (error) {
    console.warn('Não foi possível buscar as contas fixas cadastradas:', error.message);
    return [];
  }
  return data || [];
}

function contextoContasFixas(contasFixas) {
  if (!contasFixas.length) {
    return 'Nenhuma conta fixa cadastrada ainda (se a pessoa disser que pagou alguma conta, não tem o que marcar como paga — trate como cadastro de conta_fixa nova, se fizer sentido, ou pergunte).';
  }
  const lista = contasFixas.map((c) => `"${c.descricao}" (vence dia ${c.dia_vencimento})`).join(', ');
  return (
    `Contas fixas já cadastradas: ${lista}. Se a mensagem disser que uma DESSAS contas foi paga/quitada (ex: "paguei o financiamento", "já quitei a internet"), use o tipo "pagamento_conta_fixa" e preencha "descricao" com o nome EXATO cadastrado que mais se parece (aceite pequenas variações de grafia/maiúsculas — não precisa bater 100%). Se a pessoa mencionar uma conta que não está nessa lista, pergunte o nome certo, listando as opções cadastradas.`
  );
}

function contextoCartoes(cartoes, cartoesAlimentacao) {
  const partes = [];
  partes.push(
    cartoes.length
      ? `Cartões de crédito cadastrados: ${cartoes.map((c) => c.nome).join(', ')}.`
      : 'Nenhum cartão de crédito cadastrado ainda.'
  );
  partes.push(
    cartoesAlimentacao.length
      ? `Cartões alimentação/refeição cadastrados: ${cartoesAlimentacao.map((c) => c.nome).join(', ')}.`
      : 'Nenhum cartão alimentação cadastrado ainda (se a pessoa mencionar um, ex: "Ticket", aceite o nome dela).'
  );
  partes.push(
    'Se a mensagem mencionar um cartão, tente casar com um dos nomes acima (aceite pequenas variações de grafia/maiúsculas). Se não citar nenhum cartão em compra_cartao/parcelamento/gasto_alimentacao/recarga_alimentacao, pergunte qual desses cartões cadastrados foi usado, listando os nomes exatos.'
  );
  return partes.join(' ');
}

// Preço estimado (US$ por 1 milhão de tokens) do modelo padrão de cada
// provedor configurado acima. Só dá uma ideia de gasto no "quanto gastei de
// IA" — se você trocar o modelo via variável de ambiente, o valor real pode
// não bater exatamente, mas serve como referência.
const PRECOS_IA = {
  Gemini: { entrada: 0.1, saida: 0.4 },
  Groq: { entrada: 0.075, saida: 0.3 },
  Mistral: { entrada: 0.02, saida: 0.03 },
  OpenAI: { entrada: 0.05, saida: 0.4 },
  Anthropic: { entrada: 1.0, saida: 5.0, entradaCache: 0.1 },
};

// Registra o uso de tokens (e o custo estimado) de cada chamada de IA, pra
// dar pra consultar depois via "consulta_uso_ia" no grupo.
async function registrarUsoIA(provedor, modelo, tokensEntrada, tokensSaida, tokensCache = 0) {
  try {
    // "Gemini 1", "Gemini 2"... usam o mesmo preço de "Gemini" — só o nome
    // muda pra dar pra ver o uso de cada chave separadamente no relatório.
    const chavePrecos = provedor.replace(/\s+\d+$/, '');
    const precos = PRECOS_IA[chavePrecos];
    let custo = 0;
    if (precos) {
      const entradaNormal = Math.max(tokensEntrada - tokensCache, 0);
      custo =
        (entradaNormal / 1_000_000) * precos.entrada +
        (tokensCache / 1_000_000) * (precos.entradaCache ?? precos.entrada) +
        (tokensSaida / 1_000_000) * precos.saida;
    }
    const { error } = await supabase.from('uso_ia').insert({
      familia_id: FAMILIA_ID,
      provedor,
      modelo,
      tokens_entrada: tokensEntrada || 0,
      tokens_saida: tokensSaida || 0,
      custo_usd: custo,
    });
    if (error) console.warn('Não foi possível registrar uso de IA:', error.message);
  } catch (err) {
    console.warn('Não foi possível registrar uso de IA:', err.message);
  }
}

async function chamarAnthropic(contentBlocks, tentativa = 1) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      // 1500 dá espaço de sobra pro "thinking" do modelo + o JSON completo —
      // com 500 (valor antigo) a resposta era cortada no meio (stop_reason:
      // "max_tokens") e o JSON.parse abaixo quebrava com "Unexpected end of
      // JSON input". Não reduzir sem testar a chamada real de novo.
      max_tokens: 1500,
      // cache_control marca o system prompt (fixo em toda chamada) pra cache
      // de 5 min da Anthropic — chamadas seguintes dentro da janela pagam bem
      // menos por ele em vez de reprocessar o texto inteiro toda vez.
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: contentBlocks }],
    }),
  });

  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${erro}`);
  }

  const data = await resp.json();
  if (data.usage) {
    const { input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens } = data.usage;
    console.log(
      `💳 Tokens: entrada=${input_tokens || 0} saída=${output_tokens || 0} cache_lido=${cache_read_input_tokens || 0} cache_criado=${cache_creation_input_tokens || 0}`
    );
    await registrarUsoIA('Anthropic', ANTHROPIC_MODEL, input_tokens, output_tokens, cache_read_input_tokens);
  }
  const textoResposta = data.content?.find((b) => b.type === 'text')?.text || '';
  const jsonLimpo = textoResposta.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(jsonLimpo);
  } catch (err) {
    // A IA às vezes escreve algo antes/depois do JSON, apesar da instrução.
    // Antes de desistir, tenta 1x pedindo pra ela se corrigir.
    if (tentativa === 1) {
      console.warn('⚠️  Resposta da IA não veio em JSON válido, tentando de novo...');
      return chamarAnthropic(
        [
          ...contentBlocks,
          {
            type: 'text',
            text: `Sua resposta anterior não era um JSON válido:\n"${textoResposta}"\n\nResponda de novo, agora APENAS com o JSON no formato pedido, sem nenhum texto antes ou depois.`,
          },
        ],
        2
      );
    }
    throw new Error(`Resposta da IA não é um JSON válido mesmo após nova tentativa: ${textoResposta.slice(0, 200)}`);
  }
}

async function chamarGeminiComChave(contentBlocks, apiKey, indice) {
  const parts = contentBlocks
    .map((b) => {
      if (b.type === 'text') return { text: b.text };
      if (b.type === 'image') return { inline_data: { mime_type: b.source.media_type, data: b.source.data } };
      return null;
    })
    .filter(Boolean);

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    }
  );

  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error(`Gemini API ${resp.status}: ${erro}`);
  }

  const data = await resp.json();
  if (data.usageMetadata) {
    // Rotula por chave ("Gemini 1", "Gemini 2"...) pra dar pra ver no "quanto
    // gastei de IA" quanto cada projeto Google Cloud está sendo usado —
    // registrarUsoIA sabe achar o preço certo tirando o número do nome.
    await registrarUsoIA(
      `Gemini ${indice + 1}`,
      GEMINI_MODEL,
      data.usageMetadata.promptTokenCount,
      data.usageMetadata.candidatesTokenCount
    );
  }
  const textoResposta = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text || '';
  const jsonLimpo = textoResposta.replace(/```json|```/g, '').trim();
  return JSON.parse(jsonLimpo);
}

// Roda cada chave do Gemini na ordem (projetos diferentes = cota gratuita
// própria) antes de desistir do Gemini e deixar a cadeia cair pro Groq/etc.
async function chamarGemini(contentBlocks) {
  let ultimoErro;
  for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
    try {
      return await chamarGeminiComChave(contentBlocks, GEMINI_API_KEYS[i], i);
    } catch (err) {
      ultimoErro = err;
      if (i < GEMINI_API_KEYS.length - 1) {
        console.warn(`⚠️  Gemini (chave ${i + 1}/${GEMINI_API_KEYS.length}) falhou, tentando próxima chave: ${err.message}`);
      }
    }
  }
  throw ultimoErro || new Error('Nenhuma chave do Gemini configurada.');
}

async function chamarOpenAI(contentBlocks) {
  const content = contentBlocks
    .map((b) => {
      if (b.type === 'text') return { type: 'text', text: b.text };
      if (b.type === 'image') {
        return { type: 'image_url', image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } };
      }
      return null;
    })
    .filter(Boolean);

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
    }),
  });

  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error(`OpenAI API ${resp.status}: ${erro}`);
  }

  const data = await resp.json();
  if (data.usage) {
    await registrarUsoIA('OpenAI', OPENAI_MODEL, data.usage.prompt_tokens, data.usage.completion_tokens);
  }
  const textoResposta = data.choices?.[0]?.message?.content || '';
  const jsonLimpo = textoResposta.replace(/```json|```/g, '').trim();
  return JSON.parse(jsonLimpo);
}

// Groq e Mistral usam formato "chat completions" (estilo OpenAI), só texto
// (sem leitura de imagem nos modelos usados aqui).
async function chamarChatCompletions({ url, apiKey, model, contentBlocks, nomeProvedor }) {
  const textoUnico = contentBlocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n');

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: textoUnico },
      ],
    }),
  });

  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error(`${url} ${resp.status}: ${erro}`);
  }

  const data = await resp.json();
  if (data.usage) {
    await registrarUsoIA(nomeProvedor, model, data.usage.prompt_tokens, data.usage.completion_tokens);
  }
  const textoResposta = data.choices?.[0]?.message?.content || '';
  const jsonLimpo = textoResposta.replace(/```json|```/g, '').trim();
  return JSON.parse(jsonLimpo);
}

async function chamarGroq(contentBlocks) {
  return chamarChatCompletions({
    nomeProvedor: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: GROQ_API_KEY,
    model: GROQ_MODEL,
    contentBlocks,
  });
}

async function chamarMistral(contentBlocks) {
  return chamarChatCompletions({
    nomeProvedor: 'Mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    apiKey: MISTRAL_API_KEY,
    model: MISTRAL_MODEL,
    contentBlocks,
  });
}

// Cadeia de provedores: tenta cada um na ordem até um funcionar. Cada empresa
// só entra na fila se a respectiva chave estiver configurada. Ordem escolhida
// pra economizar: gratuitas primeiro, Anthropic (pago) só como último recurso.
// Groq e Mistral não leem imagem, então são pulados quando a mensagem é uma foto.
async function chamarIA(contentBlocks) {
  const temImagem = contentBlocks.some((b) => b.type === 'image');
  const todosProvedores = [
    { nome: 'Gemini', chave: GEMINI_API_KEY, fn: chamarGemini, suportaImagem: true },
    { nome: 'Groq', chave: GROQ_API_KEY, fn: chamarGroq, suportaImagem: false },
    { nome: 'Mistral', chave: MISTRAL_API_KEY, fn: chamarMistral, suportaImagem: false },
    { nome: 'OpenAI', chave: OPENAI_API_KEY, fn: chamarOpenAI, suportaImagem: true },
    { nome: 'Anthropic', chave: ANTHROPIC_API_KEY, fn: chamarAnthropic, suportaImagem: true },
  ];
  const provedores = todosProvedores.filter((p) => p.chave && (!temImagem || p.suportaImagem));

  let ultimoErro;
  for (let i = 0; i < provedores.length; i++) {
    const provedor = provedores[i];
    try {
      const resultado = await provedor.fn(contentBlocks);
      console.log(`✅ Interpretado com ${provedor.nome}${i > 0 ? ' (fallback)' : ''}.`);
      return resultado;
    } catch (err) {
      console.warn(`⚠️  ${provedor.nome} falhou: ${err.message}`);
      ultimoErro = err;
    }
  }
  throw ultimoErro || new Error('Nenhum provedor de IA configurado.');
}

async function interpretarMensagem(texto, remetente, contextoExtra = null, chaveRemetente = null) {
  const [cartoes, cartoesAlimentacao, contasFixas] = await Promise.all([
    buscarCartoesAtivos(),
    buscarCartoesAlimentacaoAtivos(),
    buscarContasFixasAtivas(),
  ]);
  const blocos = [
    { type: 'text', text: contextoCartoes(cartoes, cartoesAlimentacao) },
    { type: 'text', text: contextoContasFixas(contasFixas) },
  ];
  if (contextoExtra) blocos.push({ type: 'text', text: contextoExtra });
  const historico = chaveRemetente ? formatarHistorico(chaveRemetente) : null;
  if (historico) blocos.push({ type: 'text', text: historico });
  blocos.push({ type: 'text', text: `Mensagem de texto do WhatsApp (remetente: ${remetente}):\n"${texto}"` });
  return chamarIA(blocos);
}

async function interpretarImagem(base64, mimetype, legenda, remetente) {
  const [cartoes, cartoesAlimentacao, contasFixas] = await Promise.all([
    buscarCartoesAtivos(),
    buscarCartoesAlimentacaoAtivos(),
    buscarContasFixasAtivas(),
  ]);
  return chamarIA([
    { type: 'text', text: contextoCartoes(cartoes, cartoesAlimentacao) },
    { type: 'text', text: contextoContasFixas(contasFixas) },
    {
      type: 'image',
      source: { type: 'base64', media_type: mimetype, data: base64 },
    },
    {
      type: 'text',
      text: `Imagem enviada no WhatsApp (remetente: ${remetente}). Legenda: "${legenda || '(sem legenda)'}". Essa imagem é um comprovante de pagamento/compra — leia o valor total e o estabelecimento.`,
    },
  ]);
}

// Continua um lançamento que ficou faltando informação: junta o que já tinha
// com a resposta nova do usuário e pede pra IA completar (ou perguntar de novo).
// IMPORTANTE: a pessoa pode simplesmente mudar de assunto no meio de uma
// pergunta pendente (ex: bot pergunta o valor de uma conta, e ela manda uma
// mensagem completamente diferente, sem responder aquilo). Sem tratar esse
// caso, a IA tentava "forçar" a resposta nova a preencher o campo que faltava
// e o bot ficava girando em loop repetindo a mesma pergunta. Por isso o
// prompt abaixo pede explicitamente pra IA reconhecer quando isso acontece e
// classificar a mensagem do zero, como se a pergunta pendente nunca tivesse
// existido.
async function continuarComResposta(dadosParciais, resposta, remetente, chaveRemetente = null) {
  const [cartoes, cartoesAlimentacao, contasFixas] = await Promise.all([
    buscarCartoesAtivos(),
    buscarCartoesAlimentacaoAtivos(),
    buscarContasFixasAtivas(),
  ]);
  const contexto =
    `Você estava preenchendo um lançamento financeiro e ainda faltava informação. Estado atual em JSON:\n${JSON.stringify(dadosParciais)}\n\n` +
    `Você perguntou: "${dadosParciais.pergunta}"\n` +
    `O usuário (${remetente}) respondeu: "${resposta}"\n\n` +
    `PRIMEIRO decida: essa resposta realmente responde à pergunta acima (mesmo que de forma indireta), ou é um assunto novo, sem relação com o que foi perguntado (ex: perguntou o valor de uma conta e a pessoa mandou algo tipo "contas fixas", "me envia X", ou começou a falar de outro lançamento)?\n` +
    `- Se FOR uma resposta válida à pergunta: atualize o JSON combinando o que já tinha com essa resposta nova. Se ainda faltar algo, pergunte de novo (preencha 'faltando' e 'pergunta'). Se já estiver tudo completo, deixe 'faltando' como array vazio, 'pergunta' como null, e preencha o 'comentario'.\n` +
    `- Se NÃO FOR relacionada (mudou de assunto): IGNORE completamente o estado anterior e classifique "${resposta}" como se fosse uma mensagem nova, começando do zero, normalmente (pode virar qualquer um dos tipos, inclusive consulta ou conversa casual). Não tente encaixar à força no lançamento antigo.`;
  const historico = chaveRemetente ? formatarHistorico(chaveRemetente) : null;
  const blocos = [
    { type: 'text', text: contextoCartoes(cartoes, cartoesAlimentacao) },
    { type: 'text', text: contextoContasFixas(contasFixas) },
  ];
  if (historico) blocos.push({ type: 'text', text: historico });
  blocos.push({ type: 'text', text: contexto });
  return chamarIA(blocos);
}

// ===================== Transcrição de áudio (Whisper) =====================
// Tenta o Groq primeiro (gratuito, mesma API do Whisper), depois a OpenAI (paga).
async function transcreverComWhisper({ url, apiKey, model, buffer, mimetype }) {
  const extensao = mimetype.includes('ogg') ? 'ogg' : mimetype.includes('mp4') ? 'm4a' : 'oga';
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimetype }), `audio.${extensao}`);
  form.append('model', model);
  form.append('language', 'pt');

  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error(`${url} ${resp.status}: ${erro}`);
  }

  const data = await resp.json();
  return data.text || '';
}

async function transcreverAudio(buffer, mimetype) {
  if (GROQ_API_KEY) {
    try {
      return await transcreverComWhisper({
        url: 'https://api.groq.com/openai/v1/audio/transcriptions',
        apiKey: GROQ_API_KEY,
        model: 'whisper-large-v3-turbo',
        buffer,
        mimetype,
      });
    } catch (err) {
      console.warn('⚠️  Transcrição no Groq falhou, tentando OpenAI:', err.message);
    }
  }
  if (OPENAI_API_KEY) {
    return transcreverComWhisper({
      url: 'https://api.openai.com/v1/audio/transcriptions',
      apiKey: OPENAI_API_KEY,
      model: 'whisper-1',
      buffer,
      mimetype,
    });
  }
  throw new Error('Nenhum provedor de transcrição configurado (GROQ_API_KEY ou OPENAI_API_KEY).');
}

// ===================== Supabase: gravar transação =====================
async function salvarTransacao(dados) {
  const tabela = dados.tipo === 'entrada' ? 'entradas' : 'gastos';
  // A data sempre vem do relógio do servidor (fuso configurado), nunca da IA —
  // isso evita datas erradas/alucinadas quando a mensagem não menciona uma data.
  const dataDeHoje = DateTime.now().setZone(FUSO_HORARIO).toFormat('yyyy-MM-dd');
  const { data, error } = await supabase
    .from(tabela)
    .insert({
      familia_id: FAMILIA_ID,
      descricao: dados.descricao,
      valor: dados.valor,
      data: dataDeHoje,
      categoria: dados.categoria,
      pessoa: dados.pessoa || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert (${tabela}): ${error.message}`);
  return data;
}

async function salvarContaFixa(dados) {
  const { data, error } = await supabase
    .from('contas_fixas')
    .insert({
      familia_id: FAMILIA_ID,
      descricao: dados.descricao,
      valor: dados.valor,
      dia_vencimento: dados.dia_vencimento,
      categoria: dados.categoria || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert (contas_fixas): ${error.message}`);
  return data;
}

// Marca uma conta fixa já cadastrada como paga no ciclo (mês) atual dela. Usa
// a MESMA lógica de "próximo vencimento" que o resumo (gerarResumoContasFixas)
// e o aviso automático das 8h usam — assim, marcar como pago aqui reflete
// imediatamente no resumo e evita o aviso de "vencendo" repetir à toa.
async function salvarPagamentoContaFixa(dados) {
  const { data: contas, error: erroBusca } = await supabase
    .from('contas_fixas')
    .select('id, descricao, valor, dia_vencimento, categoria')
    .eq('familia_id', FAMILIA_ID)
    .is('excluido_em', null);
  if (erroBusca) throw new Error(`Supabase select (contas_fixas): ${erroBusca.message}`);

  const alvo = (contas || []).find(
    (c) => c.descricao.trim().toLowerCase() === (dados.descricao || '').trim().toLowerCase()
  );
  if (!alvo) {
    throw new Error(`Conta fixa "${dados.descricao}" não encontrada entre as cadastradas.`);
  }

  const vencimento = calcularProximoVencimento(alvo.dia_vencimento);
  const mesAno = vencimento.toFormat('yyyy-MM');

  const { data: existente, error: erroExistente } = await supabase
    .from('pagamentos_contas_fixas')
    .select('id')
    .eq('familia_id', FAMILIA_ID)
    .eq('conta_fixa_id', alvo.id)
    .eq('mes_ano', mesAno)
    .maybeSingle();
  if (erroExistente) throw new Error(`Supabase select (pagamentos_contas_fixas): ${erroExistente.message}`);

  if (existente) {
    return { conta: alvo, vencimento, jaEstavaPago: true };
  }

  const { error: erroInsert } = await supabase.from('pagamentos_contas_fixas').insert({
    familia_id: FAMILIA_ID,
    conta_fixa_id: alvo.id,
    mes_ano: mesAno,
    pessoa: dados.pessoa || null,
  });
  if (erroInsert) throw new Error(`Supabase insert (pagamentos_contas_fixas): ${erroInsert.message}`);

  return { conta: alvo, vencimento, jaEstavaPago: false };
}

// Cadastra um cartão de crédito novo (só a "ficha" do cartão em si — nome,
// limite, dia de fechamento/vencimento — nenhuma compra é lançada aqui).
async function salvarCartao(dados) {
  const { data, error } = await supabase
    .from('cartoes')
    .insert({
      familia_id: FAMILIA_ID,
      nome: dados.cartao,
      limite: dados.limite || null,
      dia_fechamento: dados.dia_fechamento || null,
      dia_vencimento: dados.dia_vencimento || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert (cartoes): ${error.message}`);
  return data;
}

async function salvarCompraCartao(dados) {
  const hoje = DateTime.now().setZone(FUSO_HORARIO);
  const dataDeHoje = hoje.toFormat('yyyy-MM-dd');

  // Descobre o dia de fechamento e o limite do cartão (se ele já estiver
  // cadastrado) pra saber a fatura certa e se essa compra estourou o limite.
  let mesFatura = hoje.toFormat('yyyy-MM');
  let limiteCartao = null;
  try {
    const { data: cartaoInfo } = await supabase
      .from('cartoes')
      .select('dia_fechamento, limite')
      .eq('familia_id', FAMILIA_ID)
      .ilike('nome', dados.cartao)
      .is('excluido_em', null)
      .maybeSingle();
    if (cartaoInfo?.dia_fechamento && hoje.day > cartaoInfo.dia_fechamento) {
      mesFatura = hoje.plus({ months: 1 }).toFormat('yyyy-MM');
    }
    limiteCartao = cartaoInfo?.limite || null;
  } catch (e) {
    console.warn('Não foi possível checar o cartão:', e.message);
  }

  const { data, error } = await supabase
    .from('compras_cartao')
    .insert({
      familia_id: FAMILIA_ID,
      descricao: dados.descricao,
      valor: dados.valor,
      categoria: dados.categoria || null,
      cartao: dados.cartao,
      pessoa: dados.pessoa || null,
      data_compra: dataDeHoje,
      mes_fatura: mesFatura,
      paga: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert (compras_cartao): ${error.message}`);

  // Soma quanto já foi gasto nessa fatura (incluindo a compra que acabou de entrar)
  // pra avisar se passou do limite do cartão.
  if (limiteCartao) {
    try {
      const { data: comprasDoMes } = await supabase
        .from('compras_cartao')
        .select('valor')
        .eq('familia_id', FAMILIA_ID)
        .ilike('cartao', dados.cartao)
        .eq('mes_fatura', mesFatura)
        .is('excluido_em', null);
      const totalFatura = (comprasDoMes || []).reduce((acc, c) => acc + Number(c.valor), 0);
      data.totalFaturaAtual = totalFatura;
      data.limiteCartao = limiteCartao;
      data.estourouLimite = totalFatura > limiteCartao;
    } catch (e) {
      console.warn('Não foi possível somar a fatura do cartão:', e.message);
    }
  }

  return data;
}

async function salvarParcelamento(dados) {
  const { data, error } = await supabase
    .from('parcelamentos')
    .insert({
      familia_id: FAMILIA_ID,
      descricao: dados.descricao,
      valor_total: dados.valor_total,
      valor_original: dados.valor_total,
      numero_parcelas: dados.numero_parcelas,
      parcela_atual: 1,
      dia_vencimento: dados.dia_vencimento || null,
      cartao: dados.cartao || null,
      categoria: dados.categoria || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert (parcelamentos): ${error.message}`);
  return data;
}

async function salvarMeta(dados) {
  const { data, error } = await supabase
    .from('metas')
    .insert({
      familia_id: FAMILIA_ID,
      descricao: dados.descricao,
      valor_alvo: dados.valor_alvo,
      valor_atual: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert (metas): ${error.message}`);
  return data;
}

async function salvarOrcamento(dados) {
  const { data, error } = await supabase
    .from('orcamentos')
    .insert({
      familia_id: FAMILIA_ID,
      categoria: dados.categoria,
      limite_mensal: dados.limite_mensal,
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert (orcamentos): ${error.message}`);
  return data;
}

// Busca (ou cria) o cartão alimentação pelo nome, pra saber o saldo atual.
async function buscarOuCriarCartaoAlimentacao(nome) {
  const { data: existente } = await supabase
    .from('cartoes_alimentacao')
    .select('*')
    .eq('familia_id', FAMILIA_ID)
    .ilike('nome', nome)
    .is('excluido_em', null)
    .maybeSingle();
  if (existente) return existente;

  const { data: novo, error } = await supabase
    .from('cartoes_alimentacao')
    .insert({ familia_id: FAMILIA_ID, nome, saldo_atual: 0 })
    .select()
    .single();
  if (error) throw new Error(`Supabase insert (cartoes_alimentacao): ${error.message}`);
  return novo;
}

async function salvarGastoAlimentacao(dados) {
  const nomeCartao = dados.cartao || 'Ticket';
  const cartao = await buscarOuCriarCartaoAlimentacao(nomeCartao);
  const dataDeHoje = DateTime.now().setZone(FUSO_HORARIO).toFormat('yyyy-MM-dd');
  const novoSaldo = Number(cartao.saldo_atual) - Number(dados.valor);

  const { error: errUpdate } = await supabase
    .from('cartoes_alimentacao')
    .update({ saldo_atual: novoSaldo })
    .eq('id', cartao.id);
  if (errUpdate) throw new Error(`Supabase update (cartoes_alimentacao): ${errUpdate.message}`);

  const { data, error } = await supabase
    .from('movimentos_cartao_alimentacao')
    .insert({
      familia_id: FAMILIA_ID,
      cartao_alimentacao_id: cartao.id,
      tipo: 'gasto',
      descricao: dados.descricao,
      valor: dados.valor,
      pessoa: dados.pessoa || null,
      data: dataDeHoje,
    })
    .select()
    .single();
  if (error) throw new Error(`Supabase insert (movimentos_cartao_alimentacao): ${error.message}`);

  data.cartaoNome = cartao.nome;
  data.saldoRestante = novoSaldo;
  return data;
}

async function salvarRecargaAlimentacao(dados) {
  const nomeCartao = dados.cartao || 'Ticket';
  const cartao = await buscarOuCriarCartaoAlimentacao(nomeCartao);
  const dataDeHoje = DateTime.now().setZone(FUSO_HORARIO).toFormat('yyyy-MM-dd');
  const novoSaldo = Number(cartao.saldo_atual) + Number(dados.valor);

  const { error: errUpdate } = await supabase
    .from('cartoes_alimentacao')
    .update({ saldo_atual: novoSaldo })
    .eq('id', cartao.id);
  if (errUpdate) throw new Error(`Supabase update (cartoes_alimentacao): ${errUpdate.message}`);

  const { data, error } = await supabase
    .from('movimentos_cartao_alimentacao')
    .insert({
      familia_id: FAMILIA_ID,
      cartao_alimentacao_id: cartao.id,
      tipo: 'recarga',
      descricao: 'Recarga do cartão alimentação',
      valor: dados.valor,
      pessoa: dados.pessoa || null,
      data: dataDeHoje,
    })
    .select()
    .single();
  if (error) throw new Error(`Supabase insert (movimentos_cartao_alimentacao): ${error.message}`);

  data.cartaoNome = cartao.nome;
  data.saldoRestante = novoSaldo;
  return data;
}

// ===================== Pendências (perguntas em aberto e confirmações) =====================
// Guardadas no Supabase (tabela bot_pendencias), não em memória — assim o bot não
// "se perde" no meio de uma pergunta se reiniciar/reconectar (o que acontece com
// alguma frequência). Uma pendência por pessoa (familia_id + jid), expira em 15min.
const VALIDADE_PENDENCIA_MS = 15 * 60 * 1000;

async function buscarPendencia(jid) {
  const { data, error } = await supabase
    .from('bot_pendencias')
    .select('*')
    .eq('familia_id', FAMILIA_ID)
    .eq('jid', jid)
    .maybeSingle();
  if (error) {
    console.warn('Não foi possível buscar pendência:', error.message);
    return null;
  }
  if (!data) return null;
  if (Date.now() - new Date(data.criado_em).getTime() > VALIDADE_PENDENCIA_MS) {
    await apagarPendencia(jid);
    return null;
  }
  return data;
}

async function salvarPendencia(jid, estado, dados) {
  const { error } = await supabase
    .from('bot_pendencias')
    .upsert(
      { familia_id: FAMILIA_ID, jid, estado, dados, criado_em: new Date().toISOString() },
      { onConflict: 'familia_id,jid' }
    );
  if (error) console.error('Erro ao salvar pendência:', error.message);
}

async function apagarPendencia(jid) {
  const { error } = await supabase.from('bot_pendencias').delete().eq('familia_id', FAMILIA_ID).eq('jid', jid);
  if (error) console.error('Erro ao apagar pendência:', error.message);
}

// Segunda camada de validação, independente da IA: garante que nada com campo
// obrigatório vazio/inválido chegue a ser salvo no banco (a IA pode errar ou
// "achar" que está completo quando não está).
const CAMPOS_OBRIGATORIOS_POR_TIPO = {
  gasto: ['descricao', 'valor', 'categoria'],
  entrada: ['descricao', 'valor', 'categoria'],
  conta_fixa: ['descricao', 'valor', 'dia_vencimento'],
  compra_cartao: ['descricao', 'valor', 'cartao'],
  parcelamento: ['descricao', 'valor_total', 'numero_parcelas'],
  meta: ['descricao', 'valor_alvo'],
  orcamento: ['categoria', 'limite_mensal'],
  gasto_alimentacao: ['descricao', 'valor'],
  recarga_alimentacao: ['valor'],
  pagamento_conta_fixa: ['descricao'],
  cadastro_cartao: ['cartao'],
};

const PERGUNTAS_POR_CAMPO = {
  descricao: 'Pode descrever melhor do que se trata?',
  valor: 'Qual o valor?',
  valor_total: 'Qual o valor total da compra?',
  categoria: 'Qual categoria usar?',
  cartao: 'Qual cartão foi usado?',
  dia_vencimento: 'Todo dia do mês essa conta vence?',
  numero_parcelas: 'Em quantas parcelas?',
  valor_alvo: 'Qual o valor da meta?',
  limite_mensal: 'Qual o limite mensal?',
};

// Segunda camada de validação específica pra gasto_alimentacao/recarga_alimentacao:
// buscarOuCriarCartaoAlimentacao() CRIA um cartão novo (saldo 0) se o nome não
// bater com nenhum cadastrado, e cai pra "Ticket" por padrão se a IA não
// extrair nenhum nome — com só 1 cartão isso nunca importa, mas com 2+
// cadastrados uma mensagem sem o nome citado (ou a IA falhando em perguntar)
// creditava/debitava o cartão errado, ou criava um cartão fantasma, em
// silêncio. Roda como rede de segurança independente do julgamento da IA,
// igual ao padrão já usado em validarDados() pros outros campos obrigatórios.
async function resolverCartaoAlimentacaoAmbiguo(dados) {
  if (dados.tipo !== 'gasto_alimentacao' && dados.tipo !== 'recarga_alimentacao') return null;
  const cartoes = await buscarCartoesAlimentacaoAtivos();
  if (cartoes.length <= 1) {
    if (cartoes.length === 1 && !dados.cartao) dados.cartao = cartoes[0].nome;
    return null;
  }
  if (dados.cartao && cartoes.some((c) => c.nome.trim().toLowerCase() === dados.cartao.trim().toLowerCase())) {
    return null;
  }
  return `Qual cartão alimentação foi usado? (${cartoes.map((c) => c.nome).join(', ')})`;
}

function validarDados(dados) {
  if (dados.tipo === 'consulta_saldo') return { valido: true, invalidos: [] };
  const camposObrigatorios = CAMPOS_OBRIGATORIOS_POR_TIPO[dados.tipo] || [];
  const invalidos = camposObrigatorios.filter((campo) => {
    const valor = dados[campo];
    if (valor === null || valor === undefined || valor === '') return true;
    if (['valor', 'valor_total', 'valor_alvo', 'limite_mensal'].includes(campo)) return !(Number(valor) > 0);
    if (campo === 'numero_parcelas') return !(Number.isInteger(Number(valor)) && Number(valor) >= 2);
    if (campo === 'dia_vencimento') return !(Number.isInteger(Number(valor)) && Number(valor) >= 1 && Number(valor) <= 31);
    return false;
  });
  return { valido: invalidos.length === 0, invalidos };
}

// ===================== Mensagens de confirmação =====================
function formatarReais(valor) {
  return Number(valor).toFixed(2).replace('.', ',');
}

function formatarDataBR(dataISO) {
  return dataISO.split('-').reverse().join('/');
}

function montarCartao(registro, tipo) {
  const linhaStatus = tipo === 'entrada' ? 'Recebido: 🟢' : 'Pago: 🔴';
  return (
    `📋 *Registro de Transação Concluído*\n` +
    `📝 Descrição: ${registro.descricao}\n` +
    `💵 Valor: R$ ${formatarReais(registro.valor)}\n` +
    `📊 Tipo: ${tipo === 'entrada' ? 'Receita' : 'Despesa'}\n` +
    `🏷️ Categoria: ${registro.categoria}\n` +
    `👤 Pessoa: ${registro.pessoa || '-'}\n` +
    `📅 Data: ${formatarDataBR(registro.data)}\n` +
    linhaStatus
  );
}

function montarCartaoContaFixa(registro) {
  return (
    `📋 *Conta Fixa Cadastrada*\n` +
    `📝 Descrição: ${registro.descricao}\n` +
    `💵 Valor: R$ ${formatarReais(registro.valor)}\n` +
    `📅 Vence todo dia: ${registro.dia_vencimento}\n` +
    `🏷️ Categoria: ${registro.categoria || '-'}\n` +
    `🔁 Recorrência: Mensal`
  );
}

function montarCartaoCadastroCartao(registro) {
  const linhas = [`📋 *Cartão de Crédito Cadastrado*`, `💳 Nome: ${registro.nome}`];
  if (registro.limite) linhas.push(`💰 Limite: R$ ${formatarReais(registro.limite)}`);
  if (registro.dia_fechamento) linhas.push(`📅 Fechamento: dia ${registro.dia_fechamento}`);
  if (registro.dia_vencimento) linhas.push(`📅 Vencimento: dia ${registro.dia_vencimento}`);
  return linhas.join('\n');
}

function montarCartaoCompraCartao(registro) {
  let mensagem =
    `📋 *Compra no Cartão Registrada*\n` +
    `📝 Descrição: ${registro.descricao}\n` +
    `💳 Cartão: ${registro.cartao}\n` +
    `💵 Valor: R$ ${formatarReais(registro.valor)}\n` +
    `🏷️ Categoria: ${registro.categoria || '-'}\n` +
    `👤 Pessoa: ${registro.pessoa || '-'}\n` +
    `🧾 Fatura de: ${registro.mes_fatura}`;

  if (registro.limiteCartao) {
    mensagem += `\n💰 Total da fatura: R$ ${formatarReais(registro.totalFaturaAtual)} de R$ ${formatarReais(registro.limiteCartao)}`;
    if (registro.estourouLimite) {
      mensagem += `\n⚠️ *Atenção: essa fatura já ultrapassou o limite do cartão!*`;
    }
  }

  return mensagem;
}

function montarCartaoParcelamento(registro) {
  const valorParcela = registro.numero_parcelas ? registro.valor_total / registro.numero_parcelas : registro.valor_total;
  return (
    `📋 *Parcelamento Cadastrado*\n` +
    `📝 Descrição: ${registro.descricao}\n` +
    `💵 Valor total: R$ ${formatarReais(registro.valor_total)}\n` +
    `🔢 Parcelas: ${registro.numero_parcelas}x de R$ ${formatarReais(valorParcela)}\n` +
    `💳 Cartão: ${registro.cartao || '-'}\n` +
    `🏷️ Categoria: ${registro.categoria || '-'}`
  );
}

function montarCartaoMeta(registro) {
  return (
    `📋 *Meta Cadastrada*\n` +
    `🎯 ${registro.descricao}\n` +
    `💵 Valor alvo: R$ ${formatarReais(registro.valor_alvo)}\n` +
    `📈 Progresso atual: R$ 0,00`
  );
}

function montarCartaoOrcamento(registro) {
  return (
    `📋 *Orçamento Definido*\n` +
    `🏷️ Categoria: ${registro.categoria}\n` +
    `💵 Limite mensal: R$ ${formatarReais(registro.limite_mensal)}`
  );
}

function montarCartaoGastoAlimentacao(registro) {
  const saldoBaixo = registro.saldoRestante < 0;
  return (
    `📋 *Gasto no Cartão Alimentação*\n` +
    `📝 Descrição: ${registro.descricao}\n` +
    `💳 Cartão: ${registro.cartaoNome}\n` +
    `💵 Valor: R$ ${formatarReais(registro.valor)}\n` +
    `👤 Pessoa: ${registro.pessoa || '-'}\n` +
    `${saldoBaixo ? '⚠️' : '💰'} Saldo restante: R$ ${formatarReais(registro.saldoRestante)}` +
    (saldoBaixo ? `\n⚠️ *Saldo negativo, cuidado!*` : '')
  );
}

function montarCartaoRecargaAlimentacao(registro) {
  return (
    `📋 *Recarga no Cartão Alimentação*\n` +
    `💳 Cartão: ${registro.cartaoNome}\n` +
    `➕ Valor recarregado: R$ ${formatarReais(registro.valor)}\n` +
    `💰 Novo saldo: R$ ${formatarReais(registro.saldoRestante)}`
  );
}

async function enviarNoGrupo(texto) {
  if (!socketAtual || !jidGrupoAlvo) {
    console.warn('⚠️  Não foi possível enviar mensagem: socket ou grupo indisponível.');
    return null;
  }
  return socketAtual.sendMessage(jidGrupoAlvo, { text: texto });
}

// Mapeia o tipo de lançamento pra tabela do Supabase correspondente (usado
// pra rastrear qual registro uma mensagem de confirmação representa).
function tabelaDoTipo(tipo) {
  switch (tipo) {
    case 'entrada':
      return 'entradas';
    case 'gasto':
      return 'gastos';
    case 'conta_fixa':
      return 'contas_fixas';
    case 'compra_cartao':
      return 'compras_cartao';
    case 'parcelamento':
      return 'parcelamentos';
    case 'meta':
      return 'metas';
    case 'orcamento':
      return 'orcamentos';
    case 'gasto_alimentacao':
    case 'recarga_alimentacao':
      return 'movimentos_cartao_alimentacao';
    case 'cadastro_cartao':
      return 'cartoes';
    default:
      return null;
  }
}

// Guarda o último lançamento salvo, tanto por quem mandou (pra "corrige, era
// X") quanto pelo ID da mensagem de confirmação enviada (pra corrigir
// respondendo/arrastando aquela mensagem específica no WhatsApp). Fica no
// Supabase, não em memória — um Map em RAM se perde toda vez que o bot
// reinicia (o que acontece com frequência), e uma correção que caía nesse
// buraco acabava sendo aplicada no lançamento errado (o mais recente da
// pessoa) em vez do que ela realmente queria corrigir.
async function lembrarRegistro({ chaveRemetente, mensagemEnviada, tabela, registroId }) {
  if (!tabela || !registroId) return;
  try {
    const { error } = await supabase.from('bot_correcoes_rastreadas').insert({
      familia_id: FAMILIA_ID,
      jid: chaveRemetente,
      mensagem_id: mensagemEnviada?.key?.id || null,
      tabela,
      registro_id: registroId,
    });
    if (error) console.warn('Não foi possível lembrar registro pra correção:', error.message);
  } catch (err) {
    console.warn('Não foi possível lembrar registro pra correção:', err.message);
  }
}

// Busca o alvo de uma correção: primeiro tenta pelo ID exato da mensagem
// respondida (reply), senão cai pro lançamento mais recente da pessoa.
async function buscarAlvoCorrecao(stanzaId, chaveRemetente) {
  if (stanzaId) {
    const { data } = await supabase
      .from('bot_correcoes_rastreadas')
      .select('tabela, registro_id')
      .eq('familia_id', FAMILIA_ID)
      .eq('mensagem_id', stanzaId)
      .maybeSingle();
    if (data) return { tabela: data.tabela, registroId: data.registro_id, ehReply: true };
  }
  const { data } = await supabase
    .from('bot_correcoes_rastreadas')
    .select('tabela, registro_id')
    .eq('familia_id', FAMILIA_ID)
    .eq('jid', chaveRemetente)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { tabela: data.tabela, registroId: data.registro_id, ehReply: false } : null;
}

// ORDEM IMPORTA: aplicarCorrecao() usa o primeiro campo desta lista que vier
// preenchido em "dados" pra decidir o que corrigir. "pessoa" fica por ÚLTIMO
// de propósito — a IA infere "pessoa" pelo remetente em TODA resposta (é uma
// regra geral do prompt, não específica de correção), então ela quase sempre
// vem preenchida mesmo quando a pessoa só quis corrigir outro campo (ex:
// "adiciona limite de 200 no cartão"). Com "pessoa" antes de campos como
// dia_vencimento/cartao/numero_parcelas/valor_total/valor_alvo/limite_mensal/
// limite/dia_fechamento, a correção pretendida era ignorada e "pessoa" era
// aplicada no lugar — inofensivo (e invisível) em tabelas que têm coluna
// "pessoa", mas quebra com erro em tabelas que não têm (como "cartoes"), que
// foi exatamente o bug visto ao tentar definir o limite de um cartão.
const CAMPOS_CORRIGIVEIS = [
  'descricao',
  'valor',
  'categoria',
  'dia_vencimento',
  'cartao',
  'numero_parcelas',
  'valor_total',
  'valor_alvo',
  'limite_mensal',
  'limite',
  'dia_fechamento',
  'pessoa',
];

function rotuloCampo(campo) {
  const rotulos = {
    descricao: '📝 Descrição',
    valor: '💵 Valor',
    categoria: '🏷️ Categoria',
    pessoa: '👤 Pessoa',
    dia_vencimento: '📅 Dia de vencimento',
    cartao: '💳 Cartão',
    numero_parcelas: '🔢 Número de parcelas',
    valor_total: '💵 Valor total',
    valor_alvo: '🎯 Valor alvo',
    limite_mensal: '💵 Limite mensal',
    limite: '💰 Limite do cartão',
    dia_fechamento: '📅 Dia de fechamento',
  };
  return rotulos[campo] || campo;
}

function formatarValorCampo(campo, valor) {
  const camposMonetarios = ['valor', 'valor_total', 'valor_alvo', 'limite_mensal', 'limite'];
  return camposMonetarios.includes(campo) ? `R$ ${formatarReais(valor)}` : valor;
}

// Aplica uma correção num lançamento já salvo. Se for um movimento de cartão
// alimentação, também ajusta o saldo do cartão pela diferença.
async function aplicarCorrecao(alvo, dados) {
  const campo = CAMPOS_CORRIGIVEIS.find((c) => dados[c] !== undefined && dados[c] !== null);
  if (!campo) throw new Error('Não identifiquei o que corrigir.');
  const novoValor = dados[campo];

  if (alvo.tabela === 'movimentos_cartao_alimentacao' && campo === 'valor') {
    const { data: movimentoAntigo, error: errBusca } = await supabase
      .from('movimentos_cartao_alimentacao')
      .select('*')
      .eq('id', alvo.registroId)
      .single();
    if (errBusca) throw new Error(errBusca.message);

    const delta = Number(novoValor) - Number(movimentoAntigo.valor);
    const ajusteSaldo = movimentoAntigo.tipo === 'gasto' ? -delta : delta;
    const { data: cartao, error: errCartao } = await supabase
      .from('cartoes_alimentacao')
      .select('*')
      .eq('id', movimentoAntigo.cartao_alimentacao_id)
      .single();
    if (errCartao) throw new Error(errCartao.message);

    const { error: errUpdateSaldo } = await supabase
      .from('cartoes_alimentacao')
      .update({ saldo_atual: Number(cartao.saldo_atual) + ajusteSaldo })
      .eq('id', cartao.id);
    if (errUpdateSaldo) throw new Error(errUpdateSaldo.message);
  }

  // Na tabela "cartoes" (cadastro_cartao) o nome do cartão fica na coluna
  // "nome", não "cartao" (esse é o nome do CAMPO no JSON da IA, reaproveitado
  // do resto do sistema pra evitar mais um nome de campo).
  const colunaReal = alvo.tabela === 'cartoes' && campo === 'cartao' ? 'nome' : campo;

  const { data, error } = await supabase
    .from(alvo.tabela)
    .update({ [colunaReal]: novoValor })
    .eq('id', alvo.registroId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  return { campo, novoValor, registro: data };
}

// Exclui (soft-delete, igual ao "excluir" do site — vai pra lixeira, dá pra
// restaurar) um lançamento já salvo, usando o mesmo alvo (reply ou mais
// recente da pessoa) que a correção já resolve. Se for um movimento de
// cartão alimentação, desfaz o efeito no saldo ANTES de excluir — senão o
// saldo do cartão ficaria errado pra sempre (um gasto excluído continuaria
// descontado, uma recarga excluída continuaria somada).
async function excluirRegistro(alvo, pessoa) {
  if (alvo.tabela === 'movimentos_cartao_alimentacao') {
    const { data: movimento, error: errBusca } = await supabase
      .from('movimentos_cartao_alimentacao')
      .select('*')
      .eq('id', alvo.registroId)
      .single();
    if (errBusca) throw new Error(errBusca.message);

    const { data: cartao, error: errCartao } = await supabase
      .from('cartoes_alimentacao')
      .select('*')
      .eq('id', movimento.cartao_alimentacao_id)
      .single();
    if (errCartao) throw new Error(errCartao.message);

    const ajusteSaldo = movimento.tipo === 'gasto' ? Number(movimento.valor) : -Number(movimento.valor);
    const { error: errUpdateSaldo } = await supabase
      .from('cartoes_alimentacao')
      .update({ saldo_atual: Number(cartao.saldo_atual) + ajusteSaldo })
      .eq('id', cartao.id);
    if (errUpdateSaldo) throw new Error(errUpdateSaldo.message);
  }

  const { data, error } = await supabase
    .from(alvo.tabela)
    .update({ excluido_em: new Date().toISOString(), excluido_por: pessoa || null })
    .eq('id', alvo.registroId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  return data;
}

// ===================== Tarefas agendadas =====================

// Dado o dia de vencimento cadastrado (1-31) de uma conta fixa, acha a próxima
// data de vencimento a partir de "hoje" (podendo ser hoje mesmo), lidando com
// meses mais curtos (ex: dia_vencimento 31 em fevereiro vira o último dia do mês).
function calcularProximoVencimento(diaVencimento, hoje = DateTime.now().setZone(FUSO_HORARIO).startOf('day')) {
  for (const deltaMes of [0, 1]) {
    const inicioMes = hoje.plus({ months: deltaMes }).startOf('month');
    const ultimoDia = inicioMes.endOf('month').day;
    const dia = Math.min(diaVencimento, ultimoDia);
    const vencimento = inicioMes.set({ day: dia });
    if (vencimento >= hoje) return vencimento;
  }
  return null;
}

// ===================== Resumos (usados no agendado e sob demanda) =====================
// Lista as contas fixas cadastradas com o próximo vencimento e se já foi paga
// nesse mês — respondendo perguntas tipo "me envia as contas fixas" ou "qual
// conta está para vencer", que são sobre a LISTA de contas, não sobre saldo.
async function gerarResumoContasFixas() {
  const hoje = DateTime.now().setZone(FUSO_HORARIO).startOf('day');
  const [{ data: contas, error: e1 }, { data: pagamentos, error: e2 }] = await Promise.all([
    supabase.from('contas_fixas').select('*').eq('familia_id', FAMILIA_ID).is('excluido_em', null),
    supabase.from('pagamentos_contas_fixas').select('*').eq('familia_id', FAMILIA_ID),
  ]);
  if (e1 || e2) throw new Error((e1 || e2).message);
  if (!contas || contas.length === 0) return '📋 Nenhuma conta fixa cadastrada ainda.';

  const itens = contas
    .map((conta) => {
      const vencimento = calcularProximoVencimento(conta.dia_vencimento, hoje);
      const mesAno = vencimento ? vencimento.toFormat('yyyy-MM') : null;
      const jaPaga = mesAno ? (pagamentos || []).some((p) => p.conta_fixa_id === conta.id && p.mes_ano === mesAno) : false;
      return { conta, vencimento, jaPaga };
    })
    .sort((a, b) => (a.vencimento && b.vencimento ? a.vencimento.toMillis() - b.vencimento.toMillis() : 0));

  const linhas = itens.map(({ conta, vencimento, jaPaga }) => {
    const status = jaPaga ? '✅ paga' : '🔴 em aberto';
    const dataFmt = vencimento ? vencimento.toFormat('dd/MM') : `dia ${conta.dia_vencimento}`;
    return `• *${conta.descricao}* — R$ ${formatarReais(conta.valor)} (${conta.categoria})\n  Vence: ${dataFmt} — ${status}`;
  });

  const proximaEmAberto = itens.find((i) => !i.jaPaga && i.vencimento);
  const destaque = proximaEmAberto
    ? `\n\n⏰ Próxima a vencer: *${proximaEmAberto.conta.descricao}* em ${proximaEmAberto.vencimento.toFormat('dd/MM')}.`
    : '';

  return `📋 *Contas fixas cadastradas*\n\n${linhas.join('\n\n')}${destaque}`;
}

// Resumo completo da conta — "resumo"/"como está minha conta" merecem mais
// que um número só, no mesmo espírito do Dashboard do site: saldo do mês,
// gastos por categoria e por pessoa, orçamento, metas, cartão alimentação e
// a próxima conta a vencer. Gastos do cartão alimentação entram nas
// quebras por categoria/pessoa (informativo) mas NÃO no saldo/gastos do mês
// — mesma regra do site: esse dinheiro já saiu da conta quando o cartão foi
// recarregado, contar de novo aqui inflaria o gasto sem uma recarga
// correspondente pra compensar.
async function gerarResumoGeral() {
  const agora = DateTime.now().setZone(FUSO_HORARIO);
  const inicioMesISO = agora.startOf('month').toFormat('yyyy-MM-dd');
  const hojeISO = agora.toFormat('yyyy-MM-dd');

  const [
    { data: entradasMes, error: e1 },
    { data: gastosMes, error: e2 },
    { data: movimentosAlimentacao, error: e3 },
    { data: cartoesAlimentacao, error: e4 },
    { data: metas, error: e5 },
    { data: orcamentos, error: e6 },
    { data: contas, error: e7 },
    { data: pagamentosContas, error: e8 },
  ] = await Promise.all([
    supabase
      .from('entradas')
      .select('valor')
      .eq('familia_id', FAMILIA_ID)
      .is('excluido_em', null)
      .gte('data', inicioMesISO)
      .lte('data', hojeISO),
    supabase
      .from('gastos')
      .select('valor, categoria, pessoa')
      .eq('familia_id', FAMILIA_ID)
      .is('excluido_em', null)
      .gte('data', inicioMesISO)
      .lte('data', hojeISO),
    supabase
      .from('movimentos_cartao_alimentacao')
      .select('valor, tipo, pessoa, data')
      .eq('familia_id', FAMILIA_ID)
      .is('excluido_em', null)
      .gte('data', inicioMesISO)
      .lte('data', hojeISO),
    supabase.from('cartoes_alimentacao').select('nome, saldo_atual').eq('familia_id', FAMILIA_ID).is('excluido_em', null),
    supabase.from('metas').select('descricao, valor_alvo, valor_atual').eq('familia_id', FAMILIA_ID).is('excluido_em', null),
    supabase.from('orcamentos').select('categoria, limite_mensal').eq('familia_id', FAMILIA_ID).is('excluido_em', null),
    supabase.from('contas_fixas').select('*').eq('familia_id', FAMILIA_ID).is('excluido_em', null),
    supabase.from('pagamentos_contas_fixas').select('*').eq('familia_id', FAMILIA_ID),
  ]);
  const primeiroErro = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8;
  if (primeiroErro) throw new Error(primeiroErro.message);

  const totalEntradas = entradasMes.reduce((acc, e) => acc + Number(e.valor), 0);
  const totalGastos = gastosMes.reduce((acc, g) => acc + Number(g.valor), 0);
  const saldoMes = totalEntradas - totalGastos;
  const gastosAlimentacaoMes = (movimentosAlimentacao || []).filter((m) => m.tipo === 'gasto');

  const porCategoria = {};
  for (const g of gastosMes) {
    const cat = g.categoria || 'Outros';
    porCategoria[cat] = (porCategoria[cat] || 0) + Number(g.valor);
  }
  for (const m of gastosAlimentacaoMes) {
    porCategoria['Alimentação'] = (porCategoria['Alimentação'] || 0) + Number(m.valor);
  }
  // Barrinha + percentual do total, igual ao gráfico "Gastos por Categoria"
  // do Dashboard do site (é uma proporção do total gasto, não um limite —
  // por isso usa barraEmoji "cru", sem o critério de cor do orçamento).
  const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
  const totalCategorias = categoriasOrdenadas.reduce((acc, [, valor]) => acc + valor, 0);
  const linhasCategorias = categoriasOrdenadas
    .slice(0, 5)
    .map(([cat, valor]) => {
      const percentual = totalCategorias > 0 ? (valor / totalCategorias) * 100 : 0;
      return (
        `${emojiDaCategoria(cat)} ${cat}: R$ ${formatarReais(valor)} (${percentual.toFixed(0)}%)\n` +
        `${barraEmoji(percentual)}`
      );
    })
    .join('\n\n');

  const porPessoa = {};
  for (const g of gastosMes) {
    const p = g.pessoa || 'Não informado';
    porPessoa[p] = (porPessoa[p] || 0) + Number(g.valor);
  }
  for (const m of gastosAlimentacaoMes) {
    const p = m.pessoa || 'Não informado';
    porPessoa[p] = (porPessoa[p] || 0) + Number(m.valor);
  }
  const pessoasOrdenadas = Object.entries(porPessoa).sort((a, b) => b[1] - a[1]);
  const totalPessoas = pessoasOrdenadas.reduce((acc, [, valor]) => acc + valor, 0);
  const linhasPessoas = pessoasOrdenadas
    .map(([p, valor]) => {
      const percentual = totalPessoas > 0 ? (valor / totalPessoas) * 100 : 0;
      return `👤 ${p}: R$ ${formatarReais(valor)} (${percentual.toFixed(0)}%)\n${barraEmoji(percentual)}`;
    })
    .join('\n\n');

  let blocoOrcamento = '';
  if (orcamentos && orcamentos.length > 0) {
    const linhas = orcamentos
      .map((o) => {
        const usado = porCategoria[o.categoria] || 0;
        const percentual = o.limite_mensal > 0 ? (usado / o.limite_mensal) * 100 : 0;
        return `${statusEmojiPercentual(percentual)} ${o.categoria}: R$ ${formatarReais(usado)} de R$ ${formatarReais(o.limite_mensal)} (${percentual.toFixed(0)}%)`;
      })
      .join('\n');
    blocoOrcamento = `\n\n🎯 *Orçamento*\n${linhas}`;
  }

  let blocoMetas = '';
  if (metas && metas.length > 0) {
    const linhas = metas
      .map((m) => {
        const percentual = m.valor_alvo > 0 ? (Number(m.valor_atual) / Number(m.valor_alvo)) * 100 : 0;
        return `🏆 ${m.descricao}: R$ ${formatarReais(m.valor_atual)} de R$ ${formatarReais(m.valor_alvo)} (${percentual.toFixed(0)}%)`;
      })
      .join('\n');
    blocoMetas = `\n\n🏆 *Metas*\n${linhas}`;
  }

  let blocoAlimentacao = '';
  if (cartoesAlimentacao && cartoesAlimentacao.length > 0) {
    const linhas = cartoesAlimentacao
      .map((c) => `${Number(c.saldo_atual) < 0 ? '⚠️' : '💳'} ${c.nome}: R$ ${formatarReais(c.saldo_atual)}`)
      .join('\n');
    blocoAlimentacao = `\n\n🍽️ *Cartão Alimentação*\n${linhas}`;
  }

  // Lista TODAS as contas fixas em aberto (não só a mais próxima) — mostrar
  // só uma escondia as outras pendentes, dando a impressão de que só existia
  // uma conta a vencer quando na real havia mais.
  let blocoProximaConta = '';
  const hoje = agora.startOf('day');
  const proximas = (contas || [])
    .map((conta) => {
      const vencimento = calcularProximoVencimento(conta.dia_vencimento, hoje);
      const mesAno = vencimento ? vencimento.toFormat('yyyy-MM') : null;
      const jaPaga = mesAno ? (pagamentosContas || []).some((p) => p.conta_fixa_id === conta.id && p.mes_ano === mesAno) : false;
      return { conta, vencimento, jaPaga };
    })
    .filter((i) => !i.jaPaga && i.vencimento)
    .sort((a, b) => a.vencimento.toMillis() - b.vencimento.toMillis());
  if (proximas.length > 0) {
    const linhas = proximas
      .map((p) => `📌 ${p.conta.descricao} — R$ ${formatarReais(p.conta.valor)} em ${p.vencimento.toFormat('dd/MM')}`)
      .join('\n');
    const titulo = proximas.length === 1 ? 'Conta a vencer' : `Contas a vencer (${proximas.length})`;
    blocoProximaConta = `\n\n📅 *${titulo}*\n${linhas}`;
  }

  return (
    `📊 *Resumo da sua conta — ${agora.setLocale('pt-BR').toFormat('LLLL/yyyy')}*\n\n` +
    `💚 Entradas: R$ ${formatarReais(totalEntradas)}\n` +
    `💸 Gastos: R$ ${formatarReais(totalGastos)}\n` +
    `${saldoMes >= 0 ? '✅' : '⚠️'} Saldo do mês: R$ ${formatarReais(saldoMes)}\n\n` +
    `🛒 *Gastos por categoria*\n${linhasCategorias || 'Nenhum gasto este mês.'}\n\n` +
    `👤 *Gastos por pessoa*\n${linhasPessoas || 'Nenhum gasto este mês.'}` +
    blocoOrcamento +
    blocoMetas +
    blocoAlimentacao +
    blocoProximaConta
  );
}

// Emoji por categoria pro resumo diário — a coluna "icone" das categorias no
// banco ainda está toda com o valor padrão "Tag", então por enquanto o mapa
// fica fixo aqui em vez de vir do banco. Se um dia os ícones reais forem
// preenchidos lá, dá pra trocar essa função por uma consulta na tabela.
const EMOJI_CATEGORIA = {
  Alimentação: '🍔',
  Compras: '🛒',
  Transporte: '🚗',
  Lazer: '🎮',
  Saúde: '💊',
  Moradia: '🏠',
  Apartamento: '🏠',
  'Contas da Casa': '🧾',
  Assinaturas: '📺',
  'Cartão de Crédito': '💳',
  'Cuidados Pessoais': '🧴',
  Educação: '📚',
  Família: '👨‍👩‍👧',
  'Impostos e Taxas': '🏛️',
  Internet: '🌐',
  Investimentos: '📈',
  Manutenção: '🔧',
  Outros: '📦',
  Pets: '🐾',
  Presentes: '🎁',
  'Tarifas Bancárias': '🏦',
  Viagens: '✈️',
};
function emojiDaCategoria(categoria) {
  return EMOJI_CATEGORIA[categoria] || '🏷️';
}

// Resumo diário completo (usado no agendado das 20h) — total do dia por
// pessoa, principais categorias do dia, totais do mês, orçamento e um alerta
// simples quando o dia fica acima da média diária do mês.
async function gerarResumoDiario() {
  const agora = DateTime.now().setZone(FUSO_HORARIO);
  const hojeISO = agora.toFormat('yyyy-MM-dd');
  const inicioMesISO = agora.startOf('month').toFormat('yyyy-MM-dd');
  const diasDecorridos = agora.day; // dia do mês = quantos dias já passaram, incluindo hoje

  const [{ data: gastosDoMes, error: e1 }, { data: entradasDoMes, error: e2 }, { data: orcamentos, error: e3 }] =
    await Promise.all([
      supabase
        .from('gastos')
        .select('valor, categoria, pessoa, data')
        .eq('familia_id', FAMILIA_ID)
        .is('excluido_em', null)
        .gte('data', inicioMesISO)
        .lte('data', hojeISO),
      supabase
        .from('entradas')
        .select('valor')
        .eq('familia_id', FAMILIA_ID)
        .is('excluido_em', null)
        .gte('data', inicioMesISO)
        .lte('data', hojeISO),
      supabase.from('orcamentos').select('limite_mensal').is('excluido_em', null).eq('familia_id', FAMILIA_ID),
    ]);
  if (e1 || e2 || e3) throw new Error((e1 || e2 || e3).message);

  const gastosDeHoje = gastosDoMes.filter((g) => g.data === hojeISO);
  const totalHoje = gastosDeHoje.reduce((acc, g) => acc + Number(g.valor), 0);
  const totalMes = gastosDoMes.reduce((acc, g) => acc + Number(g.valor), 0);
  const totalEntradasMes = entradasDoMes.reduce((acc, e) => acc + Number(e.valor), 0);
  const saldoMes = totalEntradasMes - totalMes;

  if (gastosDeHoje.length === 0) {
    return (
      `📊 *RESUMO FINANCEIRO — ${agora.toFormat('dd/MM')}*\n\n` +
      `Nenhum gasto registrado hoje. 🎉\n\n` +
      `📅 *NO MÊS*\n💸 Gastos: R$ ${formatarReais(totalMes)}\n📥 Entradas: R$ ${formatarReais(totalEntradasMes)}\n` +
      `${saldoMes >= 0 ? '💰' : '⚠️'} Saldo: R$ ${formatarReais(saldoMes)}`
    );
  }

  // Total de hoje por pessoa
  const porPessoa = {};
  for (const g of gastosDeHoje) {
    porPessoa[g.pessoa || 'Não informado'] = (porPessoa[g.pessoa || 'Não informado'] || 0) + Number(g.valor);
  }
  const linhasPessoa = Object.entries(porPessoa)
    .sort((a, b) => b[1] - a[1])
    .map(([pessoa, valor]) => `👤 ${pessoa}: R$ ${formatarReais(valor)}`)
    .join('\n');

  // Principais categorias de hoje (agrupado por categoria, não por descrição)
  const porCategoriaHoje = {};
  for (const g of gastosDeHoje) {
    const cat = g.categoria || 'Outros';
    porCategoriaHoje[cat] = (porCategoriaHoje[cat] || 0) + Number(g.valor);
  }
  const categoriasOrdenadas = Object.entries(porCategoriaHoje).sort((a, b) => b[1] - a[1]);
  const linhasCategorias = categoriasOrdenadas
    .slice(0, 5)
    .map(([cat, valor]) => `${emojiDaCategoria(cat)} ${cat}: R$ ${formatarReais(valor)}`)
    .join('\n');

  // Orçamento: soma de todas as categorias com limite mensal cadastrado.
  const orcamentoTotal = (orcamentos || []).reduce((acc, o) => acc + Number(o.limite_mensal), 0);
  let blocoOrcamento = '';
  if (orcamentoTotal > 0) {
    const usadoPercent = (totalMes / orcamentoTotal) * 100;
    const restante = orcamentoTotal - totalMes;
    const statusEmoji = usadoPercent >= 100 ? '🔴' : usadoPercent >= 80 ? '🟡' : '🟢';
    const statusTexto = usadoPercent >= 100 ? 'Orçamento estourado' : usadoPercent >= 80 ? 'Perto do limite' : 'Dentro do orçamento';
    blocoOrcamento =
      `\n\n🎯 *ORÇAMENTO*\n` +
      `Usado: ${usadoPercent.toFixed(1)}%\n` +
      `Restante: R$ ${formatarReais(restante)}\n` +
      `${statusEmoji} ${statusTexto}`;
  }

  // Média diária do mês (sem contar hoje) — base pro alerta e pro resumo da IA.
  const totalMesSemHoje = totalMes - totalHoje;
  const diasAnteriores = diasDecorridos - 1;
  const mediaDiaria = diasAnteriores > 0 ? totalMesSemHoje / diasAnteriores : null;
  const categoriaTopoHoje = categoriasOrdenadas[0]?.[0];
  const acimaDaMedia = mediaDiaria !== null && totalHoje > mediaDiaria;

  const blocoAtencao = acimaDaMedia
    ? `\n\n⚠️ *ATENÇÃO*\n${categoriaTopoHoje} está acima da média diária.`
    : '';

  // "Resumo da IA": frase montada por template (sem gastar chamada de IA de
  // verdade) pra não consumir cota do Gemini/Anthropic só pra escrever isso.
  const resumoIA =
    mediaDiaria !== null
      ? acimaDaMedia
        ? `Hoje gastamos R$ ${formatarReais(totalHoje)}, acima da média diária de R$ ${formatarReais(mediaDiaria)}. O principal gasto foi ${categoriaTopoHoje?.toLowerCase()}.`
        : `Hoje gastamos R$ ${formatarReais(totalHoje)}, dentro da média diária de R$ ${formatarReais(mediaDiaria)}. Bom controle!`
      : `Hoje gastamos R$ ${formatarReais(totalHoje)}. Ainda não há dias suficientes este mês pra calcular uma média.`;

  const rodapes = [
    '📌 Amanhã é um novo dia. Vamos controlar os gastos! 💪',
    '📌 Bora fechar o mês no azul! 💪',
    '📌 Cada real economizado hoje é uma meta mais perto amanhã. 💪',
  ];
  const rodape = rodapes[agora.day % rodapes.length];

  return (
    `📊 *RESUMO FINANCEIRO — ${agora.toFormat('dd/MM')}*\n\n` +
    `💰 *GASTOS DO DIA*\n` +
    `Total: R$ ${formatarReais(totalHoje)}\n\n` +
    `${linhasPessoa}\n\n` +
    `🛒 *PRINCIPAIS GASTOS*\n${linhasCategorias}\n\n` +
    `📅 *NO MÊS*\n` +
    `💸 Gastos: R$ ${formatarReais(totalMes)}\n` +
    `📥 Entradas: R$ ${formatarReais(totalEntradasMes)}\n` +
    `${saldoMes >= 0 ? '💰' : '⚠️'} Saldo: R$ ${formatarReais(saldoMes)}` +
    blocoOrcamento +
    blocoAtencao +
    `\n\n🤖 *RESUMO DA IA*\n${resumoIA}\n` +
    `━━━━━━━━━━━━━━\n` +
    rodape
  );
}

async function gerarResumoCartaoAlimentacao() {
  const { data: cartoes, error } = await supabase
    .from('cartoes_alimentacao')
    .select('nome, saldo_atual')
    .eq('familia_id', FAMILIA_ID)
    .is('excluido_em', null);
  if (error) throw new Error(error.message);

  if (!cartoes || cartoes.length === 0) {
    return '📋 Você ainda não tem nenhum cartão alimentação cadastrado.';
  }

  const linhas = cartoes
    .map((c) => `${Number(c.saldo_atual) < 0 ? '⚠️' : '💳'} ${c.nome}: R$ ${formatarReais(c.saldo_atual)}`)
    .join('\n');
  return `📋 *Saldo do Cartão Alimentação*\n${linhas}`;
}

// Desenha uma barrinha tipo ██████░░░░ a partir de uma porcentagem (0 a 100).
// OBS: os caracteres █/░ ficam bons no terminal, mas em vários celulares
// (WhatsApp iOS, algumas fontes Android) o "vazio" ░ aparece tão escuro
// quanto o "cheio" █ — a barra parece sempre 100% preenchida. Por isso as
// barras enviadas pro WhatsApp usam barraEmoji() abaixo, que usa quadrados
// coloridos (🟩/⬜) — esses sim renderizam de forma consistente em qualquer
// aparelho. Mantido aqui só por compatibilidade, caso algo ainda use.
function barraPorcentagem(percentual, tamanho = 10) {
  const preenchido = Math.round((percentual / 100) * tamanho);
  return '█'.repeat(preenchido) + '░'.repeat(tamanho - preenchido);
}

// Versão com emoji da barra de progresso — essa é a que deve ser usada em
// qualquer mensagem enviada pro WhatsApp (ver comentário acima).
function barraEmoji(percentual, tamanho = 10) {
  const p = Math.max(0, Math.min(100, percentual));
  const preenchido = Math.max(0, Math.min(tamanho, Math.round((p / 100) * tamanho)));
  return '🟩'.repeat(preenchido) + '⬜'.repeat(tamanho - preenchido);
}

// 🟢 tranquilo / 🟡 perto do limite / 🔴 estourou — mesmo critério usado no
// bloco de orçamento do resumo diário, reaproveitado aqui pro status de uso.
function statusEmojiPercentual(percentual) {
  if (percentual >= 100) return '🔴';
  if (percentual >= 80) return '🟡';
  return '🟢';
}

// "Gemini 1", "Gemini 2"... usam o mesmo emoji de "Gemini" (o número no fim
// é só o rótulo da chave, não muda a empresa).
function emojiDoProvedor(provedor) {
  const base = provedor.replace(/\s+\d+$/, '');
  const emojis = { Gemini: '🟢', Groq: '🟡', Mistral: '🔵', OpenAI: '⚪', Anthropic: '🟣' };
  return emojis[base] || '⚙️';
}

// Ordem fixa de exibição — todos os provedores/chaves aparecem sempre, mesmo
// com 0% quando ainda não tiverem uso registrado, pra dar a visão completa
// da cadeia. Cada chave do Gemini vira uma linha própria (Gemini 1, 2, 3...).
const PROVEDORES_ORDEM = [...GEMINI_API_KEYS.map((_, i) => `Gemini ${i + 1}`), 'Groq', 'Mistral', 'OpenAI', 'Anthropic'];

async function gerarResumoUsoIA() {
  const inicioMes = DateTime.now().setZone(FUSO_HORARIO).startOf('month').toISO();
  const { data: usos, error } = await supabase
    .from('uso_ia')
    .select('provedor, custo_usd')
    .eq('familia_id', FAMILIA_ID)
    .gte('criado_em', inicioMes);
  if (error) throw new Error(error.message);

  if (!usos || usos.length === 0) {
    return '📋 Nenhum uso de IA registrado ainda este mês.';
  }

  const porProvedor = {};
  for (const nome of PROVEDORES_ORDEM) porProvedor[nome] = 0;
  let total = 0;
  for (const u of usos) {
    porProvedor[u.provedor] = (porProvedor[u.provedor] || 0) + Number(u.custo_usd);
    total += Number(u.custo_usd);
  }

  const linhas = Object.entries(porProvedor)
    .sort((a, b) => b[1] - a[1])
    .map(([provedor, custo]) => {
      const percentual = total > 0 ? (custo / total) * 100 : 0;
      const emoji = emojiDoProvedor(provedor);
      const nome = provedor.padEnd(9, ' ');
      return `${emoji} ${nome} ${barraEmoji(percentual)} ${percentual.toFixed(0)}%`;
    })
    .join('\n');

  // Com muito uso gratuito, o total pode ficar bem abaixo de 1 centavo — com
  // só 2 casas decimais isso vira "US$ 0.00" e parece que não registrou nada.
  const totalFormatado = total > 0 && total < 0.01 ? total.toFixed(4) : total.toFixed(2);

  return (
    `🤖 *Uso de IA este mês*\n${linhas}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `💰 Total estimado: US$ ${totalFormatado}\n` +
    `_(valor aproximado, baseado no modelo padrão de cada empresa — não é o saldo real da conta, só confere isso no painel de cada provedor)_`
  );
}

// Limite diário gratuito de requisições (RPD) e de tokens por minuto (TPM)
// por modelo Gemini — valores do nível gratuito do Google AI Studio em
// setembro/2026 (aistudio.google.com/rate-limit). O Google muda esses
// números de vez em quando; se o valor real divergir muito do que aparecer
// aqui, confira lá e atualize os mapas.
const LIMITE_RPD_GEMINI = {
  'gemini-3.5-flash-lite': 500,
  'gemini-3.6-flash': 20,
  'gemini-2.5-flash-lite': 500,
  'gemini-2.5-flash': 20,
};
const LIMITE_RPD_GEMINI_PADRAO = 100; // fallback se o modelo não estiver no mapa acima

const LIMITE_TPM_GEMINI = {
  'gemini-3.5-flash-lite': 250000,
  'gemini-3.6-flash': 250000,
  'gemini-2.5-flash-lite': 250000,
  'gemini-2.5-flash': 250000,
};
const LIMITE_TPM_GEMINI_PADRAO = 250000; // fallback se o modelo não estiver no mapa acima

// Formata um número inteiro com ponto de milhar (3.520), sem depender de
// locale/ICU do Node (que nem sempre vem completo no ambiente do Fly.io).
function formatarInteiro(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Groq: limite é da CONTA inteira (não por chave/projeto como o Gemini) —
// valores documentados do free tier em setembro/2026 (console.groq.com/docs/rate-limits).
const LIMITE_GROQ = { rpm: 30, tpm: 6000, rpd: 14400 };

async function gerarResumoLimitesGratuitos() {
  const agora = DateTime.now().setZone(FUSO_HORARIO);
  const inicioDoDia = agora.startOf('day').toISO();
  const umMinutoAtras = agora.minus({ seconds: 60 }).toISO();

  const [{ data: usosHoje, error: e1 }, { data: usosUltimoMinuto, error: e2 }] = await Promise.all([
    supabase.from('uso_ia').select('provedor').eq('familia_id', FAMILIA_ID).gte('criado_em', inicioDoDia),
    supabase
      .from('uso_ia')
      .select('provedor, tokens_entrada, tokens_saida')
      .eq('familia_id', FAMILIA_ID)
      .gte('criado_em', umMinutoAtras),
  ]);
  if (e1 || e2) throw new Error((e1 || e2).message);

  const blocosPorSecao = [];

  // ===== Gemini (uma chave = um projeto Google Cloud, cada um com cota própria) =====
  if (GEMINI_API_KEYS.length > 0) {
    const limiteRPD = LIMITE_RPD_GEMINI[GEMINI_MODEL] || LIMITE_RPD_GEMINI_PADRAO;
    const limiteTPM = LIMITE_TPM_GEMINI[GEMINI_MODEL] || LIMITE_TPM_GEMINI_PADRAO;
    const chaves = GEMINI_API_KEYS.map((_, i) => `Gemini ${i + 1}`);

    const requisicoesHojePorChave = {};
    for (const chave of chaves) requisicoesHojePorChave[chave] = 0;
    for (const u of usosHoje || []) {
      if (u.provedor?.startsWith('Gemini')) requisicoesHojePorChave[u.provedor] = (requisicoesHojePorChave[u.provedor] || 0) + 1;
    }

    const tokensUltimoMinutoPorChave = {};
    for (const chave of chaves) tokensUltimoMinutoPorChave[chave] = 0;
    for (const u of usosUltimoMinuto || []) {
      if (u.provedor?.startsWith('Gemini')) {
        tokensUltimoMinutoPorChave[u.provedor] =
          (tokensUltimoMinutoPorChave[u.provedor] || 0) + Number(u.tokens_entrada || 0) + Number(u.tokens_saida || 0);
      }
    }

    const blocosGemini = chaves.map((chave) => {
      const tokensUsados = tokensUltimoMinutoPorChave[chave] || 0;
      const percentual = Math.min((tokensUsados / limiteTPM) * 100, 100);
      const disponivel = Math.max(limiteTPM - tokensUsados, 0);
      const status = statusEmojiPercentual(percentual);
      return (
        `*${chave}*\n` +
        `${status} Usados: ${formatarInteiro(tokensUsados)} tokens\n` +
        `⏱️ Limite: ${formatarInteiro(limiteTPM)} tokens/minuto\n` +
        `📊 Uso naquele intervalo: ${percentual.toFixed(1)}%\n` +
        `${status} Disponível naquele momento: aproximadamente ${formatarInteiro(disponivel)} tokens`
      );
    });

    let totalRequisicoesHoje = 0;
    for (const chave of chaves) totalRequisicoesHoje += requisicoesHojePorChave[chave];
    const totalDisponivelRPD = limiteRPD * chaves.length;
    const restamRPD = Math.max(totalDisponivelRPD - totalRequisicoesHoje, 0);
    const percentualRPD = totalDisponivelRPD > 0 ? (totalRequisicoesHoje / totalDisponivelRPD) * 100 : 0;
    const alertaGemini =
      percentualRPD >= 100
        ? '\n⚠️ Limite gratuito do dia (requisições) batido — o bot vai cair pro próximo da fila até virar o dia.'
        : '';

    blocosPorSecao.push(
      `🟢 *Gemini* _(modelo: ${GEMINI_MODEL})_\n\n${blocosGemini.join('\n\n')}\n\n` +
        `📅 Hoje (todas as chaves): ${totalRequisicoesHoje}/${totalDisponivelRPD} requisições (${percentualRPD.toFixed(0)}%)\n` +
        `✅ Restam ${restamRPD} requisições até meia-noite.${alertaGemini}`
    );
  }

  // ===== Groq (conta inteira, sem separação por chave) =====
  if (GROQ_API_KEY) {
    const usosGroqHoje = (usosHoje || []).filter((u) => u.provedor === 'Groq');
    const usosGroqMinuto = (usosUltimoMinuto || []).filter((u) => u.provedor === 'Groq');
    const requisicoesMinuto = usosGroqMinuto.length;
    const tokensMinuto = usosGroqMinuto.reduce((acc, u) => acc + Number(u.tokens_entrada || 0) + Number(u.tokens_saida || 0), 0);
    const requisicoesHoje = usosGroqHoje.length;

    const percRpm = Math.min((requisicoesMinuto / LIMITE_GROQ.rpm) * 100, 100);
    const percTpm = Math.min((tokensMinuto / LIMITE_GROQ.tpm) * 100, 100);
    const percRpd = Math.min((requisicoesHoje / LIMITE_GROQ.rpd) * 100, 100);
    const status = statusEmojiPercentual(Math.max(percRpm, percTpm, percRpd));

    blocosPorSecao.push(
      `🟡 *Groq*\n\n` +
        `${status} Requisições/min: ${requisicoesMinuto}/${LIMITE_GROQ.rpm} (${percRpm.toFixed(0)}%)\n` +
        `${status} Tokens/min: ${formatarInteiro(tokensMinuto)}/${formatarInteiro(LIMITE_GROQ.tpm)} (${percTpm.toFixed(0)}%)\n` +
        `📅 Requisições hoje: ${requisicoesHoje}/${LIMITE_GROQ.rpd} (${percRpd.toFixed(0)}%)\n` +
        `_(limite é da conta inteira, a Groq não separa por chave/projeto como o Gemini)_`
    );
  }

  // ===== Mistral (a empresa parou de publicar os números exatos do free tier —
  // não dá pra mostrar um percentual confiável sem arriscar informar errado) =====
  if (MISTRAL_API_KEY) {
    const requisicoesHoje = (usosHoje || []).filter((u) => u.provedor === 'Mistral').length;
    blocosPorSecao.push(
      `🔵 *Mistral*\n\n` +
        `📅 Requisições hoje: ${requisicoesHoje}\n` +
        `⚠️ A Mistral não publica mais os limites exatos do free tier (mudam por conta) — confira o valor real em console.mistral.ai → Limits.`
    );
  }

  if (blocosPorSecao.length === 0) {
    return '📋 Nenhum provedor gratuito (Gemini/Groq/Mistral) configurado.';
  }

  return (
    `🔎 *Status dos provedores gratuitos*\n\n${blocosPorSecao.join('\n\n━━━━━━━━━━━━━━━━━━\n\n')}\n\n` +
    `_(baseado só no que o próprio bot registrou — pra número oficial, confira o painel de cada provedor)_`
  );
}

// Todo dia às 20h: resumo financeiro completo do dia
cron.schedule(
  '0 20 * * *',
  async () => {
    try {
      const texto = await gerarResumoDiario();
      await enviarNoGrupo(texto);
      console.log('📊 Resumo diário enviado.');
    } catch (err) {
      console.error('Erro ao calcular/enviar resumo diário:', err.message);
    }
  },
  { timezone: FUSO_HORARIO }
);

// Todo dia às 8h: contas fixas vencendo em 5 dias e ainda não pagas
cron.schedule(
  '0 8 * * *',
  async () => {
    try {
      const [{ data: contas, error: e1 }, { data: pagamentos, error: e2 }] = await Promise.all([
        supabase.from('contas_fixas').select('*').eq('familia_id', FAMILIA_ID).is('excluido_em', null),
        supabase.from('pagamentos_contas_fixas').select('*').eq('familia_id', FAMILIA_ID),
      ]);
      if (e1 || e2) throw new Error((e1 || e2).message);

      const hoje = DateTime.now().setZone(FUSO_HORARIO).startOf('day');
      const avisos = [];

      for (const conta of contas) {
        const vencimento = calcularProximoVencimento(conta.dia_vencimento, hoje);
        if (!vencimento) continue;
        const diff = vencimento.diff(hoje, 'days').days;

        if (diff === 5) {
          const mesAno = vencimento.toFormat('yyyy-MM');
          const jaPago = pagamentos.some((p) => p.conta_fixa_id === conta.id && p.mes_ano === mesAno);
          if (!jaPago) {
            avisos.push({
              descricao: conta.descricao,
              valor: conta.valor,
              categoria: conta.categoria,
              vencimento: vencimento.toFormat('dd/MM'),
            });
          }
        }
      }

      if (avisos.length > 0) {
        const linhas = avisos
          .map((a) => `🔴 ${a.descricao} - R$ ${formatarReais(a.valor)} (${a.categoria}) vence em ${a.vencimento}`)
          .join('\n');
        await enviarNoGrupo(`🔔 *Contas a vencer em 5 dias*\n${linhas}`);
        console.log('🔔 Aviso de contas a vencer enviado.');
      }
    } catch (err) {
      console.error('Erro ao verificar contas a vencer:', err.message);
    }
  },
  { timezone: FUSO_HORARIO }
);

// ===================== Baileys: conexão com o WhatsApp =====================
async function iniciar() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  // markOnlineOnConnect: false evita que o WhatsApp marque esse dispositivo
  // vinculado como "online" o tempo todo — quando algum aparelho está online,
  // o WhatsApp suprime as notificações push nos outros (inclusive de
  // mensagens particulares), achando que você já está vendo por ali.
  const sock = makeWASocket({ auth: state, printQRInTerminal: false, markOnlineOnConnect: false });
  socketAtual = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 Escaneie este QR Code no WhatsApp (Aparelhos conectados):\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const motivo = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const foiDeslogado = motivo === DisconnectReason.loggedOut;
      console.log('Conexão encerrada.', motivo, 'Deslogado?', foiDeslogado);

      if (foiDeslogado) {
        console.log('Sessão inválida — limpando credenciais e reiniciando pareamento automaticamente.');
        try {
          const fs = require('fs');
          fs.rmSync('auth_info_baileys', { recursive: true, force: true });
        } catch (e) {
          console.error('Erro ao limpar sessão antiga:', e.message);
        }
      }
      iniciar();
    } else if (connection === 'open') {
      console.log('✅ Conectado ao WhatsApp com sucesso!');
      try {
        await sock.sendPresenceUpdate('unavailable');
      } catch (e) {
        console.warn('Não foi possível marcar presença como indisponível:', e.message);
      }
      resolverGrupoAlvo(sock);
      if (!servidorHttpIniciado) {
        iniciarServidorHttp();
        servidorHttpIniciado = true;
      }
    }
  });

  async function resolverGrupoAlvo(sock) {
    try {
      const grupos = await sock.groupFetchAllParticipating();
      const encontrado = Object.values(grupos).find(
        (g) => g.subject?.trim().toLowerCase() === NOME_GRUPO_ALVO.trim().toLowerCase()
      );
      if (encontrado) {
        jidGrupoAlvo = encontrado.id;
        console.log(`🎯 Grupo "${NOME_GRUPO_ALVO}" localizado: ${jidGrupoAlvo}`);
      } else {
        console.warn(`⚠️  Grupo "${NOME_GRUPO_ALVO}" não encontrado.`);
      }
    } catch (err) {
      console.error('Erro ao buscar grupos:', err.message);
    }
  }

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try {
        await processarMensagem(sock, msg);
      } catch (err) {
        console.error('Erro ao processar mensagem:', err.message);
      }
    }
  });

  async function processarMensagem(sock, msg) {
    if (!msg.message) return;
    if (jaProcessada(msg.key.id)) {
      console.log('↩️  Mensagem repetida (retry do WhatsApp), ignorando.');
      return;
    }
    const remetenteJid = msg.key.remoteJid;
    if (!jidGrupoAlvo || remetenteJid !== jidGrupoAlvo) return;

    const nomeRemetente = msg.pushName || 'Desconhecido';
    const chaveRemetente = msg.key.participant || remetenteJid;
    const tipoMsg = Object.keys(msg.message)[0];
    const ehTexto = tipoMsg === 'conversation' || tipoMsg === 'extendedTextMessage';

    // Se a mensagem é uma resposta (reply/arrastar) a uma confirmação nossa,
    // isso vira o alvo preferencial de uma eventual correção.
    const stanzaId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    const alvoCorrecao = await buscarAlvoCorrecao(stanzaId, chaveRemetente);
    const contextoCorrecao = alvoCorrecao?.ehReply
      ? 'Esta mensagem é uma resposta direta (reply) a uma confirmação de lançamento anterior — é bem provável que seja uma correção daquele lançamento específico.'
      : null;

    let dados;

    // Se essa pessoa tinha uma pergunta pendente, trata a mensagem atual como
    // resposta a isso (a pendência vive no Supabase, então sobrevive a
    // reinícios do bot).
    const pendente = await buscarPendencia(chaveRemetente);
    if (pendente && ehTexto) {
      const resposta = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
      if (!resposta) return;

      if (/^cancela(r)?$/i.test(resposta)) {
        await apagarPendencia(chaveRemetente);
        registrarHistorico(chaveRemetente, 'usuario', resposta);
        await responder(chaveRemetente, 'Ok, cancelado.');
        return;
      }
      console.log(`➡️  Continuando lançamento pendente de ${nomeRemetente}: "${resposta}"`);
      try {
        dados = await continuarComResposta(pendente.dados, resposta, nomeRemetente, chaveRemetente);
        registrarHistorico(chaveRemetente, 'usuario', resposta);
        await apagarPendencia(chaveRemetente);
      } catch (err) {
        console.error('Erro ao continuar lançamento pendente:', err.message);
        await responder(chaveRemetente, '🤔 Não entendi sua resposta. Pode tentar de novo, com outras palavras?');
        return; // mantém a pendência ativa pra pessoa poder tentar de novo
      }
    } else if (ehTexto) {
      const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      if (!texto.trim()) return;

      console.log(`➡️  Interpretando texto de ${nomeRemetente}: "${texto}"`);
      try {
        dados = await interpretarMensagem(texto, nomeRemetente, contextoCorrecao, chaveRemetente);
        registrarHistorico(chaveRemetente, 'usuario', texto);
      } catch (err) {
        console.error('Erro ao chamar a IA (texto):', err.message);
        await responder(chaveRemetente, '🤔 Não consegui entender essa mensagem. Pode tentar reformular, tipo "gastei 50 no mercado"?');
        return;
      }
    } else if (tipoMsg === 'imageMessage') {
      const legenda = msg.message.imageMessage.caption || '';
      const mimetype = msg.message.imageMessage.mimetype || 'image/jpeg';

      console.log(`➡️  Interpretando imagem (comprovante) de ${nomeRemetente}`);
      try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        const base64 = buffer.toString('base64');
        dados = await interpretarImagem(base64, mimetype, legenda, nomeRemetente);
        registrarHistorico(chaveRemetente, 'usuario', `[enviou uma foto de comprovante]${legenda ? ` legenda: ${legenda}` : ''}`);
      } catch (err) {
        console.error('Erro ao processar imagem:', err.message);
        await responder(chaveRemetente, '🤔 Não consegui ler essa imagem direito. Pode mandar de novo, ou digitar o gasto por texto?');
        return;
      }
    } else if (tipoMsg === 'audioMessage') {
      if (!GROQ_API_KEY && !OPENAI_API_KEY) {
        console.log('ℹ️  Áudio recebido, mas nenhum provedor de transcrição configurado — ignorando.');
        return;
      }
      const mimetype = msg.message.audioMessage.mimetype || 'audio/ogg';

      console.log(`➡️  Transcrevendo áudio de ${nomeRemetente}...`);
      try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        const textoTranscrito = await transcreverAudio(buffer, mimetype);
        if (!textoTranscrito.trim()) {
          console.log('ℹ️  Transcrição veio vazia, ignorando.');
          await responder(chaveRemetente, '🤔 Não consegui entender o áudio. Pode tentar falar de novo, ou mandar por texto?');
          return;
        }
        console.log(`📝 Transcrito: "${textoTranscrito}"`);
        dados = await interpretarMensagem(textoTranscrito, nomeRemetente, null, chaveRemetente);
        registrarHistorico(chaveRemetente, 'usuario', textoTranscrito);
      } catch (err) {
        console.error('Erro ao processar áudio:', err.message);
        await responder(chaveRemetente, '🤔 Não consegui entender o áudio. Pode tentar falar de novo, ou mandar por texto?');
        return;
      }
    } else {
      // Outros tipos (figurinha, localização, etc.): sem suporte por enquanto.
      return;
    }

    if (!dados.ehTransacao) {
      console.log('ℹ️  Mensagem não é uma transação financeira, respondendo de forma casual.');
      await responder(chaveRemetente, dados.respostaCasual || 'Oi! 😊');
      return;
    }

    // "Pergunta" sobre saldo/resumo: responde na hora, sem gravar nada no banco.
    if (dados.tipo === 'consulta_saldo') {
      try {
        const texto =
          dados.escopo === 'alimentacao' ? await gerarResumoCartaoAlimentacao() : await gerarResumoGeral();
        await responder(chaveRemetente, texto);
        console.log('📊 Resumo enviado sob demanda.');
      } catch (err) {
        console.error('Erro ao gerar resumo sob demanda:', err.message);
      }
      return;
    }

    // "Pergunta" sobre o consumo de IA do próprio bot (não é sobre dinheiro).
    if (dados.tipo === 'consulta_uso_ia') {
      try {
        await responder(chaveRemetente, await gerarResumoUsoIA());
        console.log('📊 Resumo de uso de IA enviado sob demanda.');
      } catch (err) {
        console.error('Erro ao gerar resumo de uso de IA:', err.message);
      }
      return;
    }

    // "Pergunta" sobre o limite diário gratuito dos provedores (cota da API, não custo).
    if (dados.tipo === 'consulta_limite_provedores') {
      try {
        await responder(chaveRemetente, await gerarResumoLimitesGratuitos());
        console.log('📊 Resumo de limite dos provedores enviado sob demanda.');
      } catch (err) {
        console.error('Erro ao gerar resumo de limite dos provedores:', err.message);
      }
      return;
    }

    // "Pergunta" sobre a lista de contas fixas cadastradas e seus vencimentos.
    if (dados.tipo === 'consulta_contas_fixas') {
      try {
        await responder(chaveRemetente, await gerarResumoContasFixas());
        console.log('📋 Resumo de contas fixas enviado sob demanda.');
      } catch (err) {
        console.error('Erro ao gerar resumo de contas fixas:', err.message);
      }
      return;
    }

    // Confirmação de pagamento de uma conta fixa já cadastrada (marca o ciclo
    // atual como pago — não cria gasto novo nem conta nova).
    if (dados.tipo === 'pagamento_conta_fixa') {
      try {
        const resultado = await salvarPagamentoContaFixa(dados);
        if (resultado.jaEstavaPago) {
          await responder(chaveRemetente, `✅ *${resultado.conta.descricao}* já estava marcada como paga esse mês.`);
        } else {
          await responder(
            chaveRemetente,
            `✅ *${resultado.conta.descricao}* marcada como paga!\n📅 Referente ao vencimento de ${resultado.vencimento.toFormat('dd/MM')}.`
          );
        }
        console.log(`💰 Pagamento de conta fixa registrado: ${resultado.conta.descricao}`);
      } catch (err) {
        console.error('Erro ao registrar pagamento de conta fixa:', err.message);
        await responder(
          chaveRemetente,
          `🤔 Não encontrei "${dados.descricao}" entre as contas fixas cadastradas. Pode confirmar o nome certo?`
        );
      }
      return;
    }

    // Correção de um lançamento já salvo (por reply ou "corrige, era X").
    if (dados.tipo === 'correcao') {
      if (!alvoCorrecao) {
        await responder(chaveRemetente, '🤔 Não encontrei nenhum lançamento recente seu pra corrigir. Pode mandar os dados completos de novo?');
        return;
      }
      try {
        const resultado = await aplicarCorrecao(alvoCorrecao, dados);
        await responder(
          chaveRemetente,
          `✏️ *Lançamento corrigido!*\n${rotuloCampo(resultado.campo)}: ${formatarValorCampo(resultado.campo, resultado.novoValor)}`
        );
        console.log(`✏️  Correção aplicada: ${resultado.campo} → ${resultado.novoValor}`);
      } catch (err) {
        console.error('Erro ao aplicar correção:', err.message);
        await responder(chaveRemetente, '⚠️ Entendi a correção, mas tive um problema ao salvar. Pode tentar de novo?');
      }
      return;
    }

    // Exclusão de um lançamento já salvo (por reply ou "apaga esse lançamento").
    // Vai pra lixeira (soft-delete), igual ao botão excluir do site — dá pra
    // restaurar lá se for engano.
    if (dados.tipo === 'exclusao') {
      if (!alvoCorrecao) {
        await responder(chaveRemetente, '🤔 Não encontrei nenhum lançamento recente seu pra excluir. Pode responder à mensagem de confirmação dele?');
        return;
      }
      try {
        const registro = await excluirRegistro(alvoCorrecao, nomeRemetente);
        await responder(
          chaveRemetente,
          `🗑️ *Lançamento excluído!*${registro?.descricao ? `\n📝 ${registro.descricao}` : ''}\n_(foi pra lixeira — dá pra restaurar no site se foi engano)_`
        );
        console.log('🗑️  Lançamento excluído via WhatsApp.');
      } catch (err) {
        console.error('Erro ao excluir lançamento:', err.message);
        await responder(chaveRemetente, '⚠️ Entendi que você quer excluir, mas tive um problema. Pode tentar de novo?');
      }
      return;
    }

    // Rede de segurança: gasto_alimentacao/recarga_alimentacao não podem cair
    // no cartão alimentação errado quando há mais de um cadastrado (ver
    // resolverCartaoAlimentacaoAmbiguo).
    if ((!dados.faltando || dados.faltando.length === 0) && dados.tipo) {
      const perguntaCartaoAlimentacao = await resolverCartaoAlimentacaoAmbiguo(dados);
      if (perguntaCartaoAlimentacao) {
        dados.faltando = ['cartao'];
        dados.pergunta = perguntaCartaoAlimentacao;
      }
    }

    // Ainda falta alguma informação: pergunta e guarda o estado pra continuar depois.
    if (dados.faltando && dados.faltando.length > 0) {
      console.log(`❓ Faltando [${dados.faltando.join(', ')}], perguntando: "${dados.pergunta}"`);
      await salvarPendencia(chaveRemetente, 'aguardando_campos', dados);
      if (dados.pergunta) {
        await responder(chaveRemetente, dados.pergunta);
      }
      return;
    }

    // Rede de segurança final: só entra no switch de salvar (mais abaixo) um
    // tipo que o código realmente sabe gravar. Sem isso, qualquer tipo que a
    // IA inventasse ou um caso não prontamente tratado cairia no "default" do
    // switch, que salva como um "gasto" comum — ou seja, silenciosamente
    // lançaria uma despesa errada em vez de admitir que não sabe fazer aquilo.
    // Aqui o bot prefere dizer "não sei fazer isso" a fingir que entendeu.
    const TIPOS_LANCAMENTO_SUPORTADOS = [
      'gasto',
      'entrada',
      'conta_fixa',
      'compra_cartao',
      'parcelamento',
      'meta',
      'orcamento',
      'gasto_alimentacao',
      'recarga_alimentacao',
      'cadastro_cartao',
    ];
    if (!TIPOS_LANCAMENTO_SUPORTADOS.includes(dados.tipo)) {
      console.warn(`⚠️  Tipo não suportado retornado pela IA: ${JSON.stringify(dados.tipo)}`);
      await responder(
        chaveRemetente,
        '🤔 Entendi que você quer registrar algo, mas isso ainda não é uma função que eu sei fazer no sistema. Pode descrever de outro jeito (ex: um gasto, uma conta fixa, um cartão, uma meta)?'
      );
      return;
    }

    // A IA disse que está completo — ainda assim revalida antes de salvar (ela
    // pode errar). Se achar algo inválido, volta pro fluxo de pergunta. Se
    // estiver tudo certo, salva direto — corrigir depois é fácil (respondendo
    // a confirmação ou dizendo "corrige, era X"), então não precisa confirmar antes.
    const { valido, invalidos } = validarDados(dados);
    if (!valido) {
      console.log(`⚠️  Validação encontrou campo(s) inválido(s): ${invalidos.join(', ')}`);
      dados.faltando = invalidos;
      dados.pergunta = PERGUNTAS_POR_CAMPO[invalidos[0]] || `Pode confirmar: ${invalidos.join(', ')}?`;
      await salvarPendencia(chaveRemetente, 'aguardando_campos', dados);
      await responder(chaveRemetente, dados.pergunta);
      return;
    }

    try {
      let registro;
      let cartaoMsg;

      switch (dados.tipo) {
        case 'conta_fixa':
          registro = await salvarContaFixa(dados);
          cartaoMsg = montarCartaoContaFixa(registro);
          break;
        case 'compra_cartao':
          registro = await salvarCompraCartao(dados);
          cartaoMsg = montarCartaoCompraCartao(registro);
          break;
        case 'parcelamento':
          registro = await salvarParcelamento(dados);
          cartaoMsg = montarCartaoParcelamento(registro);
          break;
        case 'meta':
          registro = await salvarMeta(dados);
          cartaoMsg = montarCartaoMeta(registro);
          break;
        case 'orcamento':
          registro = await salvarOrcamento(dados);
          cartaoMsg = montarCartaoOrcamento(registro);
          break;
        case 'gasto_alimentacao':
          registro = await salvarGastoAlimentacao(dados);
          cartaoMsg = montarCartaoGastoAlimentacao(registro);
          break;
        case 'recarga_alimentacao':
          registro = await salvarRecargaAlimentacao(dados);
          cartaoMsg = montarCartaoRecargaAlimentacao(registro);
          break;
        case 'cadastro_cartao':
          registro = await salvarCartao(dados);
          cartaoMsg = montarCartaoCadastroCartao(registro);
          break;
        default: // 'gasto' ou 'entrada'
          registro = await salvarTransacao(dados);
          cartaoMsg = montarCartao(registro, dados.tipo);
      }

      if (dados.comentario) await responder(chaveRemetente, dados.comentario);
      const mensagemEnviada = await responder(chaveRemetente, cartaoMsg);
      await lembrarRegistro({
        chaveRemetente,
        mensagemEnviada,
        tabela: tabelaDoTipo(dados.tipo),
        registroId: registro?.id,
      });
      console.log('✅ Lançamento registrado e confirmado no grupo.');
    } catch (err) {
      console.error('Erro ao salvar/confirmar lançamento:', err.message);
      try {
        await responder(chaveRemetente, '⚠️ Entendi o lançamento, mas tive um problema ao salvar no sistema. Pode tentar de novo em instantes?');
      } catch (e2) {
        console.error('Erro ao avisar sobre falha ao salvar:', e2.message);
      }
    }
  }
}

// ===================== Servidor HTTP (healthcheck + envio manual) =====================
function iniciarServidorHttp() {
  const app = express();
  app.use(express.json());

  app.get('/status', (req, res) => {
    res.json({
      conectado: !!socketAtual,
      grupoLocalizado: !!jidGrupoAlvo,
      grupo: NOME_GRUPO_ALVO,
    });
  });

  // Endpoint manual, útil para testes ou avisos extras
  app.post('/enviar', async (req, res) => {
    const token = req.headers['x-send-token'];
    if (token !== SEND_TOKEN) return res.status(401).json({ erro: 'Token inválido' });

    const { texto } = req.body;
    if (!texto) return res.status(400).json({ erro: "Campo 'texto' é obrigatório" });
    if (!jidGrupoAlvo) return res.status(503).json({ erro: 'Grupo alvo ainda não foi localizado' });

    try {
      await enviarNoGrupo(texto);
      res.json({ sucesso: true });
    } catch (err) {
      res.status(500).json({ erro: err.message });
    }
  });

  app.listen(PORTA_HTTP, () => {
    console.log(`🌐 Servidor HTTP ouvindo na porta ${PORTA_HTTP}`);
  });
}

iniciar().catch((err) => console.error('Erro fatal ao iniciar:', err));
