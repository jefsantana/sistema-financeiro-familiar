/**
 * Baileys -> n8n bridge
 *
 * Conecta a uma conta pessoal do WhatsApp (via Baileys, biblioteca não-oficial),
 * escuta as mensagens de texto de UM grupo específico (o grupo do casal) e
 * encaminha cada mensagem, via HTTP POST, para o Webhook do n8n que faz a
 * extração da transação com IA e grava no Supabase.
 *
 * Variáveis de ambiente:
 *  - N8N_WEBHOOK_URL      (obrigatória) URL do webhook do workflow no n8n
 *  - WHATSAPP_GROUP_NAME  (recomendado) nome exato do grupo a escutar (case-insensitive)
 *  - WHATSAPP_GROUP_ID    (alternativa) JID do grupo (ex: 1203630...@g.us), tem prioridade sobre o nome
 *  - AUTH_DIR             (opcional) pasta onde a sessão autenticada é salva (default: ./auth_info)
 *
 * Na primeira execução, um QR code aparece no log/console: escaneie com o
 * WhatsApp do seu celular (Aparelhos conectados -> Conectar um aparelho).
 * As execuções seguintes reusam a sessão salva em AUTH_DIR, então essa pasta
 * PRECISA estar num volume persistente (não se perder a cada deploy).
 */

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const WHATSAPP_GROUP_NAME = (process.env.WHATSAPP_GROUP_NAME || '').trim();
const WHATSAPP_GROUP_ID = (process.env.WHATSAPP_GROUP_ID || '').trim();
const AUTH_DIR = process.env.AUTH_DIR || './auth_info';

if (!N8N_WEBHOOK_URL) {
  console.error('[config] Faltando a variável de ambiente N8N_WEBHOOK_URL. Encerrando.');
  process.exit(1);
}

if (!WHATSAPP_GROUP_NAME && !WHATSAPP_GROUP_ID) {
  console.warn(
    '[config] Nenhum WHATSAPP_GROUP_NAME nem WHATSAPP_GROUP_ID definido.\n' +
    '         O bot vai LISTAR os grupos que vir passar mensagens, mas não vai encaminhar nada\n' +
    '         para o n8n até você configurar uma dessas variáveis.'
  );
}

const logger = pino({ level: process.env.LOG_LEVEL || 'warn' });

// Cache simples de metadata de grupo (nome), pra não bater na API toda hora
const groupNameCache = new Map();

async function resolveGroupName(sock, jid) {
  if (groupNameCache.has(jid)) return groupNameCache.get(jid);
  try {
    const metadata = await sock.groupMetadata(jid);
    groupNameCache.set(jid, metadata.subject);
    return metadata.subject;
  } catch (err) {
    return null;
  }
}

function extractText(message) {
  if (!message) return null;
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  return null;
}

async function forwardToN8n(payload) {
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[n8n] Webhook respondeu ${res.status} ${res.statusText}`);
    } else {
      console.log(`[n8n] Mensagem encaminhada: "${payload.message.text.slice(0, 60)}"`);
    }
  } catch (err) {
    console.error('[n8n] Falha ao chamar o webhook:', err.message);
  }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[baileys] usando WA v${version.join('.')}, é a mais recente: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['Financeiro Casal', 'Chrome', '1.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n[baileys] Escaneie este QR code com o WhatsApp do seu celular:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.warn(`[baileys] Conexão fechada (status ${statusCode}). Reconectar: ${shouldReconnect}`);
      if (shouldReconnect) {
        start();
      } else {
        console.error('[baileys] Sessão desconectada (logout). Apague a pasta AUTH_DIR e escaneie o QR novamente.');
      }
    } else if (connection === 'open') {
      console.log('[baileys] Conectado ao WhatsApp com sucesso.');
      if (WHATSAPP_GROUP_NAME) console.log(`[config] Filtrando pelo nome do grupo: "${WHATSAPP_GROUP_NAME}"`);
      if (WHATSAPP_GROUP_ID) console.log(`[config] Filtrando pelo ID do grupo: "${WHATSAPP_GROUP_ID}"`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid || !remoteJid.endsWith('@g.us')) continue; // só grupos
        if (msg.key?.fromMe) continue; // ignora mensagens enviadas por este número

        const text = extractText(msg.message);
        if (!text) continue; // ignora áudio, imagem sem legenda, figurinha, etc. (por enquanto)

        const groupName = await resolveGroupName(sock, remoteJid);

        const matchesFilter = WHATSAPP_GROUP_ID
          ? remoteJid === WHATSAPP_GROUP_ID
          : WHATSAPP_GROUP_NAME
          ? (groupName || '').toLowerCase() === WHATSAPP_GROUP_NAME.toLowerCase()
          : null; // sem filtro configurado

        if (matchesFilter === null) {
          console.log(`[grupo detectado] nome="${groupName}" id="${remoteJid}" (configure WHATSAPP_GROUP_NAME ou WHATSAPP_GROUP_ID para encaminhar)`);
          continue;
        }
        if (!matchesFilter) continue;

        const senderJid = msg.key?.participant || remoteJid;
        const senderName = msg.pushName || senderJid.split('@')[0];

        await forwardToN8n({
          message: {
            text,
            sender: senderJid,
            senderName,
            groupId: remoteJid,
            groupName,
          },
          timestamp: (msg.messageTimestamp ? Number(msg.messageTimestamp) : Math.floor(Date.now() / 1000)),
        });
      } catch (err) {
        console.error('[messages.upsert] erro processando mensagem:', err);
      }
    }
  });
}

start().catch((err) => {
  console.error('[fatal] Falha ao iniciar:', err);
  process.exit(1);
});
