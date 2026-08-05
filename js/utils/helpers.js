// ==========================================
// HELPERS
// Funções e elementos reutilizados por vários
// módulos do sistema.
// ==========================================

export const ICONE_LIXEIRA = `<svg viewBox="0 0 24 24" fill="none" width="17" height="17">
  <path d="M4 7h16M9 7V4.8c0-.44.36-.8.8-.8h4.4c.44 0 .8.36.8.8V7M6 7l.8 12.2c.05.9.8 1.6 1.7 1.6h7c.9 0 1.65-.7 1.7-1.6L18 7"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export function formatarData(dataISO) {
  const data = new Date(dataISO);
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function formatarMoeda(valor) {
  return `R$ ${Number(valor).toFixed(2)}`;
}

/**
 * "Liga" o botão de excluir em uma tabela/lista, usando
 * delegação de eventos: escuta cliques no container inteiro
 * (não em cada botão individual), e verifica se o clique
 * foi em um botão de lixeira.
 *
 * @param {HTMLElement} container - elemento pai da lista/tabela
 * @param {Function} aoExcluir - função async chamada com o id clicado
 */
export function ativarBotoesExcluir(container, aoExcluir) {
  container.addEventListener('click', async function (evento) {
    const botao = evento.target.closest('.btn-excluir');
    if (!botao) return;

    const confirmar = confirm('Tem certeza que deseja excluir este registro?');
    if (!confirmar) return;

    botao.disabled = true;
    await aoExcluir(botao.dataset.id);
  });
}