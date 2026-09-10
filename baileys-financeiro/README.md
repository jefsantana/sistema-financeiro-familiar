# Baileys → n8n (Financeiro Jeferson e Raquel)

Bot que conecta ao seu WhatsApp pessoal (via Baileys, biblioteca não-oficial),
escuta as mensagens do grupo do casal e encaminha cada mensagem de texto para
o webhook do workflow **"Financeiro - WhatsApp para Supabase (IA)"** no n8n,
que usa Claude para extrair a transação e grava direto no Supabase.

Não testei a instalação (`npm install`) neste ambiente porque o registro do
npm está bloqueado aqui — mas o código foi checado (sintaxe válida) e segue o
padrão oficial da biblioteca Baileys. Vai instalar normalmente no Railway.

## 1. Subir o código para o GitHub

O Railway faz deploy a partir de um repositório GitHub.

```bash
cd baileys-financeiro
git init
git add .
git commit -m "Baileys -> n8n financeiro"
```

Crie um repositório novo (pode ser privado) em github.com/new, depois:

```bash
git remote add origin https://github.com/SEU_USUARIO/baileys-financeiro.git
git branch -M main
git push -u origin main
```

## 2. Criar o projeto no Railway

1. Entre em [railway.app](https://railway.app) e faça login (dá pra usar a conta do GitHub).
2. **New Project → Deploy from GitHub repo** → selecione o repositório `baileys-financeiro`.
3. O Railway detecta que é um projeto Node.js automaticamente (via `package.json`).

## 3. Adicionar um Volume (para não perder a sessão do WhatsApp)

Sem isso, a cada novo deploy o bot perderia a conexão e você teria que
escanear o QR code de novo.

1. No serviço criado, vá em **Settings → Volumes → New Volume**.
2. Mount path: `/data`
3. Salve.

## 4. Configurar as variáveis de ambiente

Em **Variables**, adicione:

| Nome | Valor |
|---|---|
| `N8N_WEBHOOK_URL` | `https://jefsantana.app.n8n.cloud/webhook/financeiro-whatsapp` |
| `AUTH_DIR` | `/data/auth_info` |
| `WHATSAPP_GROUP_NAME` | (deixe em branco por enquanto — veja o Passo 6) |

## 5. Deploy e escanear o QR code

1. O Railway já inicia o deploy automaticamente. Abra a aba **Deployments → View Logs**.
2. Vai aparecer um QR code desenhado em ASCII nos logs.
3. No seu celular: WhatsApp → **Configurações → Aparelhos conectados → Conectar um aparelho** → escaneie o QR code que apareceu nos logs.
4. Quando conectar, o log mostra `[baileys] Conectado ao WhatsApp com sucesso.`

## 6. Descobrir e configurar o nome do grupo

Como `WHATSAPP_GROUP_NAME` está em branco, o bot ainda não encaminha nada — só
**detecta e loga** os grupos que virem mensagem. Mande uma mensagem de teste
no grupo do casal e observe o log: vai aparecer algo como

```
[grupo detectado] nome="Financeiro Jeferson e Raquel" id="1203630...@g.us" (configure WHATSAPP_GROUP_NAME ou WHATSAPP_GROUP_ID para encaminhar)
```

Copie o nome exato (ou o id) e volte em **Variables**, preencha
`WHATSAPP_GROUP_NAME` com esse nome (ou `WHATSAPP_GROUP_ID` com o id — tem
prioridade se os dois estiverem preenchidos). O Railway reinicia o serviço
sozinho após salvar a variável.

## 7. Workflow no n8n

Já deixei o workflow **publicado/ativo** no n8n, então o webhook já está
escutando em produção. Se em algum momento parar de funcionar, confira se ele
ainda está "Active" no canto superior direito do editor.

## Limitações atuais

- Só mensagens de **texto** são processadas (áudio, imagem e comprovante ficam
  de fora por enquanto — dá pra adicionar depois).
- Mensagens enviadas por você mesmo pelo número conectado ao bot são
  ignoradas (`fromMe`), para não criar loop.
- Se a sessão cair (logout no celular, por exemplo), apague a pasta
  `AUTH_DIR` (o volume `/data`) e escaneie o QR code de novo.
