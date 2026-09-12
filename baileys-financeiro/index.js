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
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

// Usada apenas para transcrever mensagens de áudio (Whisper). Se não configurada,
// mensagens de áudio são ignoradas (texto e foto continuam funcionando normalmente).
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
// ==========================================================

if (!ANTHROPIC_API_KEY) console.warn('⚠️  ANTHROPIC_API_KEY não configurada.');
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) console.warn('⚠️  SUPABASE_URL / SUPABASE_SERVICE_KEY não configuradas.');
if (!OPENAI_API_KEY) console.warn('⚠️  OPENAI_API_KEY não configurada — mensagens de áudio serão ignoradas.');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let jidGrupoAlvo = null;
let servidorHttpIniciado = false;
let socketAtual = null;

// ===================== IA: interpretar a mensagem =====================
const SYSTEM_PROMPT = `Você é o assistente financeiro de um casal (Jeferson e Raquel) que controla as finanças da casa pelo WhatsApp. A mensagem pode ser um texto curto OU uma foto de comprovante de pagamento/compra (com ou sem legenda).

O sistema deles tem estes tipos de lançamento possíveis:

1. "gasto" — despesa pontual à vista (ex: mercado, gasolina, farmácia). Campos: descricao, valor, categoria, pessoa.
2. "entrada" — dinheiro recebido pontualmente (ex: salário, freelance). Campos: descricao, valor, categoria, pessoa.
3. "conta_fixa" — conta que se repete todo mês num mesmo dia (ex: aluguel, internet, streaming). NÃO lança um gasto agora, só cadastra a recorrência. Campos: descricao, valor, dia_vencimento (1-31), categoria.
4. "compra_cartao" — uma compra feita no cartão de crédito (à vista, mas que só é debitada na fatura, não na hora). Campos: descricao, valor, cartao (nome do cartão, ex: "Nubank", "Inter"), categoria, pessoa.
5. "parcelamento" — uma compra dividida em várias parcelas (ex: "comprei uma TV em 10x de 150"). Campos: descricao, valor_total (o valor cheio da compra — se o usuário disser só o valor da parcela, multiplique pelo número de parcelas), numero_parcelas, categoria, cartao (opcional), dia_vencimento (opcional).
6. "meta" — uma meta de economia que o casal quer atingir (ex: "quero juntar 5000 pra viagem"). Campos: descricao, valor_alvo.
7. "orcamento" — um limite de gasto mensal para uma categoria (ex: "quero limitar 800 por mês em alimentação"). Campos: categoria, limite_mensal.
8. "gasto_alimentacao" — um gasto pago com cartão alimentação/refeição (ex: Ticket, VR, Alelo, Sodexo). Desconta do saldo desse cartão em vez de ser um gasto comum. Campos: descricao, valor, categoria (normalmente "Alimentação"), pessoa.
9. "recarga_alimentacao" — quando o cartão alimentação recebe crédito/recarga (ex: "recarreguei o Ticket com 600", "caiu o vale alimentação"). Adiciona ao saldo em vez de descontar. Campos: valor.
10. "consulta_saldo" — quando a pessoa PERGUNTA sobre o saldo atual ou pede um resumo, sem estar registrando nada novo (ex: "qual meu saldo", "como está minha conta", "resumo financeiro", "quanto tenho no Ticket"). Não precisa de nenhum campo obrigatório, nunca fica faltando nada. Campo opcional "escopo": "geral" (saldo geral de entradas menos gastos) ou "alimentacao" (saldo do cartão alimentação) — use "geral" se não ficar claro.

A data de gasto/entrada/compra_cartao/gasto_alimentacao é preenchida automaticamente pelo sistema com a data de hoje — nunca pergunte por ela nem tente adivinhá-la.

Você também pode receber, antes da mensagem, um bloco de contexto informando quais cartões (de crédito e alimentação) já estão cadastrados no sistema — use isso pra reconhecer o cartão certo mesmo com pequenas variações de escrita, ou pra perguntar entre as opções reais quando não for citado.

Categorias de GASTO/CONTA FIXA/COMPRA NO CARTÃO/PARCELAMENTO/ORÇAMENTO/GASTO ALIMENTAÇÃO: Alimentação, Assinaturas, Cartão de Crédito, Compras, Contas da Casa, Cuidados Pessoais, Educação, Família, Impostos e Taxas, Investimentos, Lazer, Manutenção, Moradia, Outros, Pets, Presentes, Saúde, Tarifas Bancárias, Transporte, Viagens.
Categorias de ENTRADA: Aluguel Recebido, Benefícios, Estorno, Freelance, Outras Entradas, Presentes Recebidos, Reembolso, Renda Extra, Rendimentos de Investimentos, Salário, Venda de Produtos/Bens.
Gasto no cartão alimentação normalmente é categoria "Alimentação".

Sua tarefa: identificar se a mensagem é sobre finanças, qual dos 10 tipos é, e extrair os campos daquele tipo. NUNCA invente ou "chute" um valor, categoria, cartão, número de parcelas ou dia de vencimento que não esteja claro na mensagem — se um campo obrigatório do tipo identificado estiver faltando, ou se nem for possível saber qual dos tipos é, deixe esse(s) campo(s) como null e explique o que falta em "faltando" e "pergunta". Pergunte só UMA coisa de cada vez, a mais importante primeiro (o tipo, se não estiver claro; senão o próximo campo que falta).

Responda APENAS com um JSON válido, sem nenhum texto antes ou depois, no formato:
{
  "ehTransacao": true ou false,
  "tipo": "gasto" | "entrada" | "conta_fixa" | "compra_cartao" | "parcelamento" | "meta" | "orcamento" | "gasto_alimentacao" | "recarga_alimentacao" | "consulta_saldo" | null,
  "descricao": "resumo curto" ou null,
  "valor": numero (gasto/entrada/compra_cartao/gasto_alimentacao/recarga_alimentacao) ou null,
  "categoria": "categoria mais adequada" ou null,
  "pessoa": "Jeferson" ou "Raquel" (infira pelo remetente informado; vazio se não souber),
  "dia_vencimento": numero de 1 a 31 (conta_fixa obrigatório; parcelamento opcional) ou null,
  "cartao": "nome do cartão" (compra_cartao obrigatório; parcelamento opcional; gasto_alimentacao/recarga_alimentacao use o nome do cartão alimentação citado, ex: "Ticket") ou null,
  "numero_parcelas": numero inteiro (parcelamento obrigatório) ou null,
  "valor_total": numero, valor cheio da compra parcelada (parcelamento obrigatório) ou null,
  "valor_alvo": numero (meta obrigatório) ou null,
  "limite_mensal": numero (orcamento obrigatório) ou null,
  "escopo": "geral" ou "alimentacao" (só para consulta_saldo) ou null,
  "comentario": "reação curta, espontânea e bem-humorada (máx 10 palavras, 1-2 emojis) — só preencha se o lançamento estiver completo (não usar em consulta_saldo)",
  "faltando": ["nomes dos campos que ainda faltam"] (array vazio se completo),
  "pergunta": "pergunta curta e natural em português pedindo exatamente o que falta" ou null (se não faltar nada),
  "respostaCasual": "resposta curta, natural e simpática em português" (só quando ehTransacao for false) ou null
}

Se a mensagem não for sobre finanças (conversa comum, cumprimento tipo "oi"/"bom dia", pergunta não relacionada, etc.), retorne ehTransacao: false, os demais campos null/vazio, faltando: [], pergunta: null, e preencha "respostaCasual" com uma resposta breve e humana à mensagem (ex: para "oie" responda algo como "Oi! 😊 Tudo bem por aí?"; para um cumprimento de bom dia, responda o cumprimento de volta). NUNCA deixe "respostaCasual" vazio quando ehTransacao for false — o bot sempre precisa responder alguma coisa, mesmo que seja só um bate-papo casual.`;

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
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contentBlocks }],
    }),
  });

  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${erro}`);
  }

  const data = await resp.json();
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

async function interpretarMensagem(texto, remetente) {
  const [cartoes, cartoesAlimentacao] = await Promise.all([buscarCartoesAtivos(), buscarCartoesAlimentacaoAtivos()]);
  return chamarAnthropic([
    { type: 'text', text: contextoCartoes(cartoes, cartoesAlimentacao) },
    { type: 'text', text: `Mensagem de texto do WhatsApp (remetente: ${remetente}):\n"${texto}"` },
  ]);
}

async function interpretarImagem(base64, mimetype, legenda, remetente) {
  const [cartoes, cartoesAlimentacao] = await Promise.all([buscarCartoesAtivos(), buscarCartoesAlimentacaoAtivos()]);
  return chamarAnthropic([
    { type: 'text', text: contextoCartoes(cartoes, cartoesAlimentacao) },
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
async function continuarComResposta(dadosParciais, resposta, remetente) {
  const [cartoes, cartoesAlimentacao] = await Promise.all([buscarCartoesAtivos(), buscarCartoesAlimentacaoAtivos()]);
  const contexto =
    `Você estava preenchendo um lançamento financeiro e ainda faltava informação. Estado atual em JSON:\n${JSON.stringify(dadosParciais)}\n\n` +
    `Você perguntou: "${dadosParciais.pergunta}"\n` +
    `O usuário (${remetente}) respondeu: "${resposta}"\n\n` +
    `Atualize o JSON combinando o que já tinha com essa resposta nova. Se ainda faltar algo, pergunte de novo (preencha 'faltando' e 'pergunta'). Se já estiver tudo completo, deixe 'faltando' como array vazio, 'pergunta' como null, e preencha o 'comentario'.`;
  return chamarAnthropic([
    { type: 'text', text: contextoCartoes(cartoes, cartoesAlimentacao) },
    { type: 'text', text: contexto },
  ]);
}

// ===================== Transcrição de áudio (Whisper) =====================
async function transcreverAudio(buffer, mimetype) {
  const extensao = mimetype.includes('ogg') ? 'ogg' : mimetype.includes('mp4') ? 'm4a' : 'oga';
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimetype }), `audio.${extensao}`);
  form.append('model', 'whisper-1');
  form.append('language', 'pt');

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error(`OpenAI Whisper ${resp.status}: ${erro}`);
  }

  const data = await resp.json();
  return data.text || '';
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

const REGEX_AFIRMATIVO = /^(sim|s|confirma(do)?|correto|certo|isso|isso mesmo|ok(ay)?|beleza|blz|pode|manda|manda ver)\b/i;
const REGEX_NEGATIVO = /^(não|nao|n|cancela(r)?|errado|incorreto|espera|péra)\b/i;

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

const ROTULO_TIPO = {
  gasto: '💸 Gasto',
  entrada: '💚 Entrada',
  conta_fixa: '📅 Conta Fixa',
  compra_cartao: '💳 Compra no Cartão',
  parcelamento: '🔢 Parcelamento',
  meta: '🎯 Meta',
  orcamento: '🏷️ Orçamento',
  gasto_alimentacao: '🍽️ Gasto no Cartão Alimentação',
  recarga_alimentacao: '➕ Recarga no Cartão Alimentação',
};

// Resumo mostrado ANTES de gravar qualquer coisa no banco — só depois que a
// pessoa confirmar (respondendo "sim") o lançamento é de fato salvo. Isso
// evita registrar algo errado por causa de uma interpretação equivocada.
function montarResumoConfirmacao(dados) {
  const linhas = [`📝 *Confirma esse lançamento?*`, '', ROTULO_TIPO[dados.tipo] || 'Lançamento'];

  if (dados.descricao) linhas.push(`Descrição: ${dados.descricao}`);
  if (dados.valor) linhas.push(`Valor: R$ ${formatarReais(dados.valor)}`);
  if (dados.valor_total) linhas.push(`Valor total: R$ ${formatarReais(dados.valor_total)} em ${dados.numero_parcelas}x`);
  if (dados.valor_alvo) linhas.push(`Valor alvo: R$ ${formatarReais(dados.valor_alvo)}`);
  if (dados.limite_mensal) linhas.push(`Limite mensal: R$ ${formatarReais(dados.limite_mensal)}`);
  if (dados.categoria) linhas.push(`Categoria: ${dados.categoria}`);
  if (dados.cartao) linhas.push(`Cartão: ${dados.cartao}`);
  if (dados.dia_vencimento) linhas.push(`Vence todo dia: ${dados.dia_vencimento}`);
  if (dados.pessoa) linhas.push(`Pessoa: ${dados.pessoa}`);

  linhas.push('', 'Responda *sim* pra confirmar ou *não* pra cancelar.');
  return linhas.join('\n');
}

async function enviarNoGrupo(texto) {
  if (!socketAtual || !jidGrupoAlvo) {
    console.warn('⚠️  Não foi possível enviar mensagem: socket ou grupo indisponível.');
    return;
  }
  await socketAtual.sendMessage(jidGrupoAlvo, { text: texto });
}

// ===================== Tarefas agendadas =====================

// ===================== Resumos (usados no agendado e sob demanda) =====================
async function gerarResumoGeral() {
  const [{ data: entradas, error: e1 }, { data: gastos, error: e2 }] = await Promise.all([
    supabase.from('entradas').select('valor').eq('familia_id', FAMILIA_ID).is('excluido_em', null),
    supabase.from('gastos').select('valor').eq('familia_id', FAMILIA_ID).is('excluido_em', null),
  ]);
  if (e1 || e2) throw new Error((e1 || e2).message);

  const somaEntradas = entradas.reduce((acc, i) => acc + Number(i.valor), 0);
  const somaGastos = gastos.reduce((acc, i) => acc + Number(i.valor), 0);
  const saldo = somaEntradas - somaGastos;

  return (
    `📊 *Saldo do dia*\n` +
    `💚 Entradas: R$ ${formatarReais(somaEntradas)}\n` +
    `💸 Gastos: R$ ${formatarReais(somaGastos)}\n` +
    `${saldo >= 0 ? '✅' : '⚠️'} Saldo atual: R$ ${formatarReais(saldo)}`
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

// Todo dia às 20h: saldo do dia (entradas - gastos)
cron.schedule(
  '0 20 * * *',
  async () => {
    try {
      const texto = await gerarResumoGeral();
      await enviarNoGrupo(texto);
      console.log('📊 Saldo diário enviado.');
    } catch (err) {
      console.error('Erro ao calcular/enviar saldo diário:', err.message);
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
        for (const deltaMes of [0, 1]) {
          const inicioMes = hoje.plus({ months: deltaMes }).startOf('month');
          const ultimoDia = inicioMes.endOf('month').day;
          const dia = Math.min(conta.dia_vencimento, ultimoDia);
          const vencimento = inicioMes.set({ day: dia });
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
    const remetenteJid = msg.key.remoteJid;
    if (!jidGrupoAlvo || remetenteJid !== jidGrupoAlvo) return;

    const nomeRemetente = msg.pushName || 'Desconhecido';
    const chaveRemetente = msg.key.participant || remetenteJid;
    const tipoMsg = Object.keys(msg.message)[0];
    const ehTexto = tipoMsg === 'conversation' || tipoMsg === 'extendedTextMessage';

    let dados;
    let vindoDeConfirmacao = false;

    // Se essa pessoa tinha uma pergunta pendente ou uma confirmação em aberto,
    // trata a mensagem atual como resposta a isso (a pendência vive no Supabase,
    // então sobrevive a reinícios do bot).
    const pendente = await buscarPendencia(chaveRemetente);
    if (pendente && ehTexto) {
      const resposta = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
      if (!resposta) return;

      if (pendente.estado === 'aguardando_confirmacao') {
        if (REGEX_AFIRMATIVO.test(resposta)) {
          await apagarPendencia(chaveRemetente);
          dados = pendente.dados;
          vindoDeConfirmacao = true;
        } else if (REGEX_NEGATIVO.test(resposta)) {
          await apagarPendencia(chaveRemetente);
          await enviarNoGrupo('Ok, cancelado. Se quiser, é só mandar de novo. 👍');
          return;
        } else {
          await enviarNoGrupo(
            `Não entendi. Responda *sim* pra confirmar ou *não* pra cancelar:\n\n${montarResumoConfirmacao(pendente.dados)}`
          );
          return;
        }
      } else {
        if (/^cancela(r)?$/i.test(resposta)) {
          await apagarPendencia(chaveRemetente);
          await enviarNoGrupo('Ok, cancelado.');
          return;
        }
        console.log(`➡️  Continuando lançamento pendente de ${nomeRemetente}: "${resposta}"`);
        try {
          dados = await continuarComResposta(pendente.dados, resposta, nomeRemetente);
          await apagarPendencia(chaveRemetente);
        } catch (err) {
          console.error('Erro ao continuar lançamento pendente:', err.message);
          await enviarNoGrupo('🤔 Não entendi sua resposta. Pode tentar de novo, com outras palavras?');
          return; // mantém a pendência ativa pra pessoa poder tentar de novo
        }
      }
    } else if (ehTexto) {
      const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      if (!texto.trim()) return;

      console.log(`➡️  Interpretando texto de ${nomeRemetente}: "${texto}"`);
      try {
        dados = await interpretarMensagem(texto, nomeRemetente);
      } catch (err) {
        console.error('Erro ao chamar a IA (texto):', err.message);
        await enviarNoGrupo('🤔 Não consegui entender essa mensagem. Pode tentar reformular, tipo "gastei 50 no mercado"?');
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
      } catch (err) {
        console.error('Erro ao processar imagem:', err.message);
        await enviarNoGrupo('🤔 Não consegui ler essa imagem direito. Pode mandar de novo, ou digitar o gasto por texto?');
        return;
      }
    } else if (tipoMsg === 'audioMessage') {
      if (!OPENAI_API_KEY) {
        console.log('ℹ️  Áudio recebido, mas OPENAI_API_KEY não configurada — ignorando.');
        return;
      }
      const mimetype = msg.message.audioMessage.mimetype || 'audio/ogg';

      console.log(`➡️  Transcrevendo áudio de ${nomeRemetente}...`);
      try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        const textoTranscrito = await transcreverAudio(buffer, mimetype);
        if (!textoTranscrito.trim()) {
          console.log('ℹ️  Transcrição veio vazia, ignorando.');
          await enviarNoGrupo('🤔 Não consegui entender o áudio. Pode tentar falar de novo, ou mandar por texto?');
          return;
        }
        console.log(`📝 Transcrito: "${textoTranscrito}"`);
        dados = await interpretarMensagem(textoTranscrito, nomeRemetente);
      } catch (err) {
        console.error('Erro ao processar áudio:', err.message);
        await enviarNoGrupo('🤔 Não consegui entender o áudio. Pode tentar falar de novo, ou mandar por texto?');
        return;
      }
    } else {
      // Outros tipos (figurinha, localização, etc.): sem suporte por enquanto.
      return;
    }

    if (!dados.ehTransacao) {
      console.log('ℹ️  Mensagem não é uma transação financeira, respondendo de forma casual.');
      await enviarNoGrupo(dados.respostaCasual || 'Oi! 😊');
      return;
    }

    // "Pergunta" sobre saldo/resumo: responde na hora, sem gravar nada no banco.
    if (dados.tipo === 'consulta_saldo') {
      try {
        const texto =
          dados.escopo === 'alimentacao' ? await gerarResumoCartaoAlimentacao() : await gerarResumoGeral();
        await enviarNoGrupo(texto);
        console.log('📊 Resumo enviado sob demanda.');
      } catch (err) {
        console.error('Erro ao gerar resumo sob demanda:', err.message);
      }
      return;
    }

    // Ainda falta alguma informação: pergunta e guarda o estado pra continuar depois.
    if (dados.faltando && dados.faltando.length > 0) {
      console.log(`❓ Faltando [${dados.faltando.join(', ')}], perguntando: "${dados.pergunta}"`);
      await salvarPendencia(chaveRemetente, 'aguardando_campos', dados);
      if (dados.pergunta) {
        await enviarNoGrupo(dados.pergunta);
      }
      return;
    }

    // A IA disse que está completo — ainda assim revalida antes de confirmar ou
    // salvar (ela pode errar). Se achar algo inválido, volta pro fluxo de pergunta.
    if (!vindoDeConfirmacao) {
      const { valido, invalidos } = validarDados(dados);
      if (!valido) {
        console.log(`⚠️  Validação encontrou campo(s) inválido(s): ${invalidos.join(', ')}`);
        dados.faltando = invalidos;
        dados.pergunta = PERGUNTAS_POR_CAMPO[invalidos[0]] || `Pode confirmar: ${invalidos.join(', ')}?`;
        await salvarPendencia(chaveRemetente, 'aguardando_campos', dados);
        await enviarNoGrupo(dados.pergunta);
        return;
      }

      // Completo e válido: pede confirmação antes de gravar qualquer coisa.
      await salvarPendencia(chaveRemetente, 'aguardando_confirmacao', dados);
      await enviarNoGrupo(montarResumoConfirmacao(dados));
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
        default: // 'gasto' ou 'entrada'
          registro = await salvarTransacao(dados);
          cartaoMsg = montarCartao(registro, dados.tipo);
      }

      if (dados.comentario) await enviarNoGrupo(dados.comentario);
      await enviarNoGrupo(cartaoMsg);
      console.log('✅ Lançamento registrado e confirmado no grupo.');
    } catch (err) {
      console.error('Erro ao salvar/confirmar lançamento:', err.message);
      try {
        await enviarNoGrupo('⚠️ Entendi o lançamento, mas tive um problema ao salvar no sistema. Pode tentar de novo em instantes?');
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
