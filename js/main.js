import { renderDashboard, iniciarEventosDashboard } from './modules/dashboard.js';
import { renderEntradas, iniciarEventosEntradas } from './modules/entradas.js';
import { renderGastos, iniciarEventosGastos } from './modules/gastos.js';
import { renderCategorias, iniciarEventosCategorias } from './modules/categorias.js';
import { renderContasFixas, iniciarEventosContasFixas } from './modules/contasFixas.js';
import { renderParcelamentos, iniciarEventosParcelamentos } from './modules/parcelamentos.js';
import { renderCartoes, iniciarEventosCartoes } from './modules/cartoes.js';
import { renderMetas, iniciarEventosMetas } from './modules/metas.js';
import { renderRelatorios } from './modules/relatorios.js';
import { renderConfiguracoes, iniciarEventosConfiguracoes } from './modules/configuracoes.js';

const sidebar = document.querySelector('.sidebar');
const menuToggle = document.getElementById('menuToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const content = document.getElementById('content');
const pageTitle = document.getElementById('pageTitle');
const links = document.querySelectorAll('.sidebar__link');
const themeToggle = document.getElementById('themeToggle');

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
// TEMA (claro/escuro)
// ------------------------------------------
function aplicarTema(tema) {
  if (tema === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️';
  } else {
    document.documentElement.removeAttribute('data-theme');
    themeToggle.textContent = '🌙';
  }
  localStorage.setItem('tema', tema);
}

function alternarTema() {
  const temaAtual = localStorage.getItem('tema') || 'light';
  aplicarTema(temaAtual === 'dark' ? 'light' : 'dark');
}

themeToggle.addEventListener('click', alternarTema);
aplicarTema(localStorage.getItem('tema') || 'light');

// ------------------------------------------
// ROTAS
// ------------------------------------------
const rotas = {
  dashboard: { titulo: 'Dashboard', render: renderDashboard },
  entradas: { titulo: 'Entradas', render: renderEntradas },
  gastos: { titulo: 'Gastos', render: renderGastos },
  categorias: { titulo: 'Categorias', render: renderCategorias },
  contasFixas: { titulo: 'Contas Fixas', render: renderContasFixas },
  parcelamentos: { titulo: 'Parcelamentos', render: renderParcelamentos },
  cartoes: { titulo: 'Cartões', render: renderCartoes },
  metas: { titulo: 'Metas', render: renderMetas },
  relatorios: { titulo: 'Relatórios', render: renderRelatorios },
  configuracoes: { titulo: 'Configurações', render: renderConfiguracoes }
};

async function carregarPagina() {
  const hashAtual = window.location.hash.replace('#', '');
  const nomeRota = hashAtual || 'dashboard';
  const rota = rotas[nomeRota];

  if (!rota) {
    content.innerHTML = '<p>Página não encontrada.</p>';
    return;
  }

  pageTitle.textContent = rota.titulo;
  content.innerHTML = 'Carregando...';
  content.innerHTML = await rota.render();

  if (nomeRota === 'dashboard') iniciarEventosDashboard();
  if (nomeRota === 'entradas') iniciarEventosEntradas();
  if (nomeRota === 'gastos') iniciarEventosGastos();
  if (nomeRota === 'categorias') iniciarEventosCategorias();
  if (nomeRota === 'contasFixas') iniciarEventosContasFixas();
  if (nomeRota === 'parcelamentos') iniciarEventosParcelamentos();
  if (nomeRota === 'cartoes') iniciarEventosCartoes();
  if (nomeRota === 'metas') iniciarEventosMetas();
  if (nomeRota === 'configuracoes') iniciarEventosConfiguracoes(alternarTema);

  atualizarLinkAtivo(nomeRota);
  fecharMenu();
}

function atualizarLinkAtivo(nomeRota) {
  links.forEach(link => {
    link.classList.remove('active');
    if (link.dataset.page === nomeRota) link.classList.add('active');
  });
}

window.addEventListener('hashchange', carregarPagina);
window.addEventListener('DOMContentLoaded', carregarPagina);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}