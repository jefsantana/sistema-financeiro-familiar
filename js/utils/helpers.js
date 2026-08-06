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

/**
 * Formata um número no padrão de dinheiro brasileiro:
 * milhar com ponto, decimal com vírgula, com "R$" na frente.
 * Ex: 1250.9 -> "R$ 1.250,90"
 */
export function formatarMoeda(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Converte um texto digitado pelo usuário (aceita vírgula OU
 * ponto como decimal, com ou sem separador de milhar) em um
 * número JavaScript confiável.
 * Ex: "1.250,90" -> 1250.9 | "150,5" -> 150.5 | "150.5" -> 150.5
 */
export function parseValorMonetario(texto) {
  if (typeof texto !== 'string') return Number(texto) || 0;

  let limpo = texto.trim().replace(/[^\d,.-]/g, '');

  if (limpo.includes(',') && limpo.includes('.')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes(',')) {
    limpo = limpo.replace(',', '.');
  }

  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : numero;
}

/**
 * Liga um campo de texto para se comportar como campo de dinheiro:
 * ao perder o foco, formata automaticamente com milhar e vírgula.
 */
export function ativarCampoMoeda(input) {
  input.addEventListener('blur', function () {
    if (!input.value.trim()) return;
    const numero = parseValorMonetario(input.value);
    input.value = numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });
}

/**
 * Delegação de eventos para os botões de excluir de uma lista/tabela
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