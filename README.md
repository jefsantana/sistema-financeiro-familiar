# 💜 Sistema Financeiro Familiar

Aplicativo web de controle financeiro para a família — lançamentos, cartões, parcelamentos, orçamentos, metas e relatórios, tudo num só lugar, com dados isolados e seguros por família.

[![Deploy](https://github.com/jefsantana/sistema-financeiro-familiar/actions/workflows/deploy.yml/badge.svg)](https://github.com/jefsantana/sistema-financeiro-familiar/actions/workflows/deploy.yml)
[![Site publicado](https://img.shields.io/badge/site-online-7B61FF)](https://jefsantana.github.io/sistema-financeiro-familiar/)

**🔗 Acesse: [jefsantana.github.io/sistema-financeiro-familiar](https://jefsantana.github.io/sistema-financeiro-familiar/)**

---

## ✨ Funcionalidades

**Lançamentos e organização**
- Entradas, gastos e transferências entre pessoas da família
- Botão de lançamento rápido, com compra parcelada e cálculo automático da fatura
- Categorias fixas prontas para uso, mais categorias próprias (nome + ícone) que a família pode criar
- Contas fixas, parcelamentos (com controle de juros da máquina separado do valor da compra) e cartões de crédito

**Cartão de crédito de verdade**
- Compras à vista no cartão entram automaticamente na fatura certa, com base no dia de fechamento
- Fatura só vira gasto de verdade quando é paga — igual funciona na vida real
- Tela dedicada mostrando a fatura atual e o histórico de cada cartão

**Visão financeira**
- Dashboard com saldo, gráficos, últimos lançamentos, próximos vencimentos e insights automáticos
- Filtro por pessoa da família, comparando quem gastou o quê
- Relatórios com comparativo mês a mês e exportação em Excel, CSV ou PDF
- Metas de economia e orçamento mensal por categoria, com barra de progresso

**Importação de extrato**
- Leitura de extrato bancário em PDF direto no navegador (nada é enviado a servidores externos)
- Reconhecimento automático de entrada/gasto e sugestão de categoria por palavra-chave
- Detecção de lançamentos duplicados antes de importar

**Conta e segurança**
- Cadastro isolado por família — cada família só vê os próprios dados (Row Level Security no banco)
- Histórico de acessos (navegador e sistema operacional dos últimos logins)
- Lixeira com restauração e exclusão automática configurável por dias
- Exclusão de conta e apagar todos os dados, sob confirmação

**Aparência**
- Tema claro, escuro ou automático (segue o sistema operacional)
- 5 cores de destaque para personalizar o visual

---

## 🛠️ Tecnologias

| | |
|---|---|
| **Front-end** | React 19 · Vite · React Router |
| **Estilo** | CSS Modules · design próprio (tokens de cor, tipografia Plus Jakarta Sans + IBM Plex Mono) |
| **Gráficos** | Chart.js |
| **Banco de dados** | Supabase (PostgreSQL + Auth + Row Level Security) |
| **Exportação** | ExcelJS · jsPDF |
| **Leitura de PDF** | pdfjs-dist |
| **Deploy** | GitHub Actions → GitHub Pages |

---

## 📁 Estrutura do projeto

```
├── app/                  # Aplicativo React (código-fonte)
│   └── src/
│       ├── components/   # Componentes de UI, dashboard, lançamentos, gráficos
│       ├── contexts/      # Autenticação, tema, categorias, notificações
│       ├── hooks/         # Hooks de dados (CRUD genérico, lixeira, pagamentos...)
│       ├── pages/         # Uma pasta por tela do sistema
│       ├── services/       # Acesso ao Supabase
│       └── utils/          # Regras de negócio e formatação
├── supabase/              # Schema do banco (schema.sql) e migrações
└── .github/workflows/     # Deploy automático pro GitHub Pages
```

## 🚀 Rodando localmente

```bash
cd app
npm install
cp .env.example .env.local   # preencha com as credenciais do seu projeto Supabase
npm run dev
```

O schema completo do banco (tabelas, permissões de segurança) está em [`supabase/schema.sql`](supabase/schema.sql).

## 🔒 Segurança

- Todas as tabelas do banco têm Row Level Security ativado — cada família só acessa os próprios dados, mesmo com a chave pública do projeto.
- Nenhuma credencial fica no código: o deploy usa Secrets do GitHub Actions.
- A leitura de extratos bancários acontece inteiramente no navegador da pessoa — o arquivo nunca é enviado a nenhum servidor.

---

<p align="center">Feito para uso da família 💜</p>
