// ==========================================
// MAIN.JS
// Arquivo principal - por enquanto, só controla
// a abertura/fechamento do menu no celular.
// Na Etapa 6 vamos expandir bastante este arquivo!
// ==========================================

// Pegamos (selecionamos) os elementos que vamos manipular
const sidebar = document.querySelector('.sidebar');
const menuToggle = document.getElementById('menuToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');

// Função que abre o menu
function abrirMenu() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('active');
}

// Função que fecha o menu
function fecharMenu() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('active');
}

// Quando clicar no botão ☰, abre o menu
menuToggle.addEventListener('click', abrirMenu);

// Quando clicar no fundo escuro (overlay), fecha o menu
sidebarOverlay.addEventListener('click', fecharMenu);