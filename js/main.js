// ==========================================
// MAIN.JS
// O "maestro" do sistema: decide qual tela
// mostrar, controla o menu mobile e organiza
// a navegação entre as páginas.
// ==========================================

// Importando a função de cada módulo de tela
import { renderDashboard } from './modules/dashboard.js';
import { renderEntradas, iniciarEventosEntradas } from './modules/entradas.js';
import { renderGastos } from './modules/gastos.js';
import { renderCategorias } from './modules/categorias.js';
import { renderContasFixas } from './modules/contasFixas.js';
import { renderParcelamentos } from './modules/parcelamentos.js';
import { renderCartoes } from './modules/cartoes.js';
import { renderMetas } from './modules/metas.js';
import { renderRelatorios } from './modules/relatorios.js';


// ------------------------------------------
// ELEMENTOS DA PÁGINA QUE VAMOS MANIPULAR
// ------------------------------------------
const sidebar = document.querySelector('.sidebar');
const menuToggle = document.getElementById('menuToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const content = document.getElementById('content');
const pageTitle = document.getElementById('pageTitle');
const links = document.querySelectorAll('.sidebar__link');

// ------------------------------------------
// MENU MOBILE (abrir/fechar) — já existia,
// só reorganizamos aqui dentro
// ------------------------------------------
function abrirMenu() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('active');
}

function fecharMenu() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('active');
}

menuToggle.addEventListener('click', abrirMenu);
sidebarOverlay.addEventListener('click', fecharMenu);

// ------------------------------------------
// TABELA DE ROTAS
// Cada "chave" é o nome usado no hash (#dashboard),
// e o "valor" é um objeto com o título da página
// e a função que gera o HTML dela.
// ------------------------------------------
const rotas = {
  dashboard: {
    titulo: 'Dashboard',
    render: renderDashboard
  },
  entradas: {
    titulo: 'Entradas',
    render: renderEntradas
  },
  gastos: {
    titulo: 'Gastos',
    render: renderGastos
  },
  categorias: {
    titulo: 'Categorias',
    render: renderCategorias
  },
  contasFixas: {
    titulo: 'Contas Fixas',
    render: renderContasFixas
  },
  parcelamentos: {
    titulo: 'Parcelamentos',
    render: renderParcelamentos
  },
  cartoes: {
    titulo: 'Cartões',
    render: renderCartoes
  },
  metas: {
    titulo: 'Metas',
    render: renderMetas
  },
  relatorios: {
    titulo: 'Relatórios',
    render: renderRelatorios
  },
  configuracoes: {
    titulo: 'Configurações',
    render: () => '<h3>⚙️ Configurações</h3><p>Em breve: modo claro/escuro e preferências.</p>'
  }
};

// ------------------------------------------
// FUNÇÃO PRINCIPAL: carregar a página certa
// ------------------------------------------
async function carregarPagina() {
  // Lê o hash da URL, removendo o "#" do começo
  // Exemplo: "#entradas" vira "entradas"
  const hashAtual = window.location.hash.replace('#', '');

  // Se não houver hash (primeira visita), usamos "dashboard" como padrão
  const nomeRota = hashAtual || 'dashboard';

  // Busca a rota correspondente na nossa tabela
  const rota = rotas[nomeRota];

  // Se alguém digitar um hash que não existe, evitamos erro
  if (!rota) {
    content.innerHTML = '<p>Página não encontrada.</p>';
    return;
  }

  // Atualiza o título do cabeçalho
  pageTitle.textContent = rota.titulo;

  // Atualiza o conteúdo principal, chamando a função da rota
  content.innerHTML = 'Carregando...';
  content.innerHTML = await rota.render();

  // Depois de inserir o HTML na tela, verificamos se essa
  // rota tem eventos específicos para "religar" (ex: formulários)
  if (nomeRota === 'entradas') {
    iniciarEventosEntradas();
  }

  // Atualiza qual link do menu está "ativo" (destacado)
  atualizarLinkAtivo(nomeRota);

  // No celular, fecha o menu automaticamente após navegar
  fecharMenu();
}

// ------------------------------------------
// Destaca visualmente o item do menu atual
// ------------------------------------------
function atualizarLinkAtivo(nomeRota) {
  links.forEach((link) => {
    // Remove "active" de todos primeiro
    link.classList.remove('active');

    // Adiciona "active" apenas no link correspondente à rota atual
    if (link.dataset.page === nomeRota) {
      link.classList.add('active');
    }
  });
}

// ------------------------------------------
// EVENTOS QUE DISPARAM A NAVEGAÇÃO
// ------------------------------------------

// Quando o hash da URL mudar (usuário clicou em um link)
window.addEventListener('hashchange', carregarPagina);

// Quando a página carregar pela primeira vez
window.addEventListener('DOMContentLoaded', carregarPagina);