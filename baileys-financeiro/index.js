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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
// ==========================================================

if (!ANTHROPIC_API_KEY) console.warn('⚠️  ANTHROPIC_API_KEY não configurada.');
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) console.warn('⚠️  SUPABASE_URL / SUPABASE_SERVICE_KEY não configuradas.');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let jidGrupoAlvo = null;
let servidorHttpIniciado = false;
let socketAtual = null;

// ===================== IA: interpretar a mensagem =====================
const SYSTEM_PROMPT = `Você lê mensagens de um grupo de WhatsApp de um casal (Jeferson e Raquel) que registra as finanças da casa mandando mensagens curtas. Sua tarefa é identificar se a mensagem descreve uma transação financeira (um gasto ou uma entrada de dinheiro) e extrair os dados estruturados.

Responda APENAS com um JSON válido, sem nenhum texto antes ou depois, no formato:
{
  "ehTransacao": true ou false,
  "tipo": "gasto" ou "entrada",
  "descricao": "resumo curto",
  "valor": numero (ponto decimal, sem R$ ou vírgula),
  "categoria": "categoria mais adequada",
  "pessoa": "Jeferson" ou "Raquel" (infira pelo remetente informado; vazio se não souber),
  "comentario": "reação curta, espontânea e bem-humorada (máx 10 palavras, 1-2 emojis), adaptada à categoria. Ex: 'Tá abastecido e pronto para novas aventuras! 🚗⛽', 'Hummm, parece que o lanche estava gostoso! 🍔😋'"
}

Categorias de GASTO: Alimentação, Apartamento, Educação, Internet, Lazer, Moradia, Outros, Saúde, Transporte.
Categorias de ENTRADA: Café, Freelance, Netflix, Salário.
Se nenhuma categoria de gasto fizer sentido, use "Outros".

Se a mensagem não for uma transação financeira, retorne ehTransacao: false e os demais campos vazios/zero.`;

async function interpretarMensagem(texto, remetente) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Mensagem do WhatsApp (remetente: ${remetente}):\n"${texto}"` },
      ],
    }),
  });

  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${erro}`);
  }

  const data = await resp.json();
  const textoResposta = data.content?.find((b) => b.type === 'text')?.text || '';
  const jsonLimpo = textoResposta.replace(/```json|```/g, '').trim();
  return JSON.parse(jsonLimpo);
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

async function enviarNoGrupo(texto) {
  if (!socketAtual || !jidGrupoAlvo) {
    console.warn('⚠️  Não foi possível enviar mensagem: socket ou grupo indisponível.');
    return;
  }
  await socketAtual.sendMessage(jidGrupoAlvo, { text: texto });
}

// ===================== Tarefas agendadas =====================

// Todo dia às 20h: saldo do dia (entradas - gastos)
cron.schedule(
  '0 20 * * *',
  async () => {
    try {
      const [{ data: entradas, error: e1 }, { data: gastos, error: e2 }] = await Promise.all([
        supabase.from('entradas').select('valor').eq('familia_id', FAMILIA_ID).is('excluido_em', null),
        supabase.from('gastos').select('valor').eq('familia_id', FAMILIA_ID).is('excluido_em', null),
      ]);
      if (e1 || e2) throw new Error((e1 || e2).message);

      const somaEntradas = entradas.reduce((acc, i) => acc + Number(i.valor), 0);
      const somaGastos = gastos.reduce((acc, i) => acc + Number(i.valor), 0);
      const saldo = somaEntradas - somaGastos;

      const texto =
        `📊 *Saldo do dia*\n` +
        `💚 Entradas: R$ ${formatarReais(somaEntradas)}\n` +
        `💸 Gastos: R$ ${formatarReais(somaGastos)}\n` +
        `${saldo >= 0 ? '✅' : '⚠️'} Saldo atual: R$ ${formatarReais(saldo)}`;

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

  const sock = makeWASocket({ auth: state, printQRInTerminal: false });
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
    const tipoMsg = Object.keys(msg.message)[0];

    let texto = '';
    if (tipoMsg === 'conversation' || tipoMsg === 'extendedTextMessage') {
      texto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    } else {
      // Imagem/áudio: suporte a interpretar mídia fica para uma próxima etapa.
      return;
    }
    if (!texto.trim()) return;

    console.log(`➡️  Interpretando mensagem de ${nomeRemetente}: "${texto}"`);

    let dados;
    try {
      dados = await interpretarMensagem(texto, nomeRemetente);
    } catch (err) {
      console.error('Erro ao chamar a IA:', err.message);
      return;
    }

    if (!dados.ehTransacao) {
      console.log('ℹ️  Mensagem não é uma transação financeira, ignorando.');
      return;
    }

    let registro;
    try {
      registro = await salvarTransacao(dados);
    } catch (err) {
      console.error('Erro ao salvar no Supabase:', err.message);
      return;
    }

    try {
      if (dados.comentario) {
        await enviarNoGrupo(dados.comentario);
      }
      await enviarNoGrupo(montarCartao(registro, dados.tipo));
      console.log('✅ Transação registrada e confirmada no grupo.');
    } catch (err) {
      console.error('Erro ao enviar confirmação:', err.message);
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
