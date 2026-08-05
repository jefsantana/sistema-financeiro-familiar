// ==========================================
// MÓDULO: DASHBOARD
// Resumo financeiro, avisos de contas a vencer
// e gráfico de gastos por categoria.
// ==========================================

import { buscarDados, salvarDados } from '../services/api.js';
import { gerarGraficoDonut, agruparPorCategoria } from './graficos.js';

export async function renderDashboard() {
  const [entradas, gastos, contasFixas, pagamentos] = await Promise.all([
    buscarDados('Entradas'),
    buscarDados('Gastos'),
    buscarDados('ContasFixas'),
    buscarDados('PagamentosContasFixas')
  ]);

  const totalEntradas = entradas.reduce((soma, item) => soma + Number(item.valor), 0);
  const totalGastos = gastos.reduce((soma, item) => soma + Number(item.valor), 0);
  const saldo = totalEntradas - totalGastos;

  const alertas = calcularAlertasContasFixas(contasFixas, pagamentos);
  const categorias = agruparPorCategoria(gastos);

  return `
    <h3>📊 Visão geral</h3>
    <div class="cards">
      <div class="card">
        <p class="card__label">Total de Entradas</p>
        <p class="card__valor card__valor--sucesso">R$ ${totalEntradas.toFixed(2)}</p>
      </div>
      <div class="card">
        <p class="card__label">Total de Gastos</p>
        <p class="card__valor card__valor--perigo">R$ ${totalGastos.toFixed(2)}</p>
      </div>
      <div class="card">
        <p class="card__label">Saldo</p>
        <p class="card__valor">R$ ${saldo.toFixed(2)}</p>
      </div>
    </div>

    <div class="painel-grid">
      <div class="painel">
        <p class="painel__titulo">🔔 Contas a vencer este mês</p>
        <div id="alertasContasFixas">${montarAlertasContasFixas(alertas)}</div>
      </div>

      <div class="painel">
        <p class="painel__titulo">🥯 Gastos por Categoria</p>
        ${gerarGraficoDonut(categorias)}
      </div>
    </div>
  `;
}

/**
 * Compara cada Conta Fixa com o mês atual e calcula
 * quantos dias faltam (ou já passaram) do vencimento.
 * Ignora contas que já têm pagamento registrado neste mês.
 */
function calcularAlertasContasFixas(contasFixas, pagamentos) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const ano = hoje.getFullYear();
  const mes = hoje.getMonth(); // 0 = janeiro
  const mesAnoAtual = `${ano}-${String(mes + 1).padStart(2, '0')}`;

  const idsPagosEsteMes = pagamentos
    .filter(p => p.mesAno === mesAnoAtual)
    .map(p => String(p.contaFixaId));

  return contasFixas
    .filter(c => !idsPagosEsteMes.includes(String(c.id)))
    .map(c => {
      const ultimoDiaDoMes = new Date(ano, mes + 1, 0).getDate();
      const diaVencimento = Math.min(Number(c.diaVencimento), ultimoDiaDoMes);
      const dataVencimento = new Date(ano, mes, diaVencimento);
      const diasRestantes = Math.round((dataVencimento - hoje) / (1000 * 60 * 60 * 24));

      return { ...c, diasRestantes, mesAno: mesAnoAtual };
    })
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
}

/**
 * Monta o HTML da lista de avisos, com cores diferentes
 * para vencida / vence hoje / vence em breve
 */
function montarAlertasContasFixas(alertas) {
  if (alertas.length === 0) {
    return '<p class="texto-vazio">Nenhuma conta pendente este mês. 🎉</p>';
  }

  const itens = alertas.map(c => {
    let status = 'neutro';
    let texto = `Vence em ${c.diasRestantes} dias`;

    if (c.diasRestantes < 0) {
      status = 'vencida';
      texto = `Vencida há ${Math.abs(c.diasRestantes)} dia(s)`;
    } else if (c.diasRestantes === 0) {
      status = 'hoje';
      texto = 'Vence hoje';
    } else if (c.diasRestantes <= 5) {
      status = 'proxima';
      texto = `Vence em ${c.diasRestantes} dia(s)`;
    }

    return `
      <li class="alerta-item alerta-item--${status}">
        <div>
          <p class="alerta-item__descricao">${c.descricao}</p>
          <p class="alerta-item__info">${texto} · R$ ${Number(c.valor).toFixed(2)}</p>
        </div>
        <button class="botao-pagar" data-id="${c.id}" data-mes="${c.mesAno}">Marcar como paga</button>
      </li>
    `;
  }).join('');

  return `<ul class="alerta-lista">${itens}</ul>`;
}

/**
 * Liga o clique do botão "Marcar como paga".
 * Ao clicar, registra o pagamento e recarrega só a lista de avisos.
 */
export function iniciarEventosDashboard() {
  const container = document.getElementById('alertasContasFixas');
  if (!container) return;

  container.addEventListener('click', async function (evento) {
    const botao = evento.target.closest('.botao-pagar');
    if (!botao) return;

    botao.disabled = true;
    botao.textContent = 'Salvando...';

    await salvarDados('PagamentosContasFixas', {
      contaFixaId: botao.dataset.id,
      mesAno: botao.dataset.mes
    });

    const [contasFixas, pagamentos] = await Promise.all([
      buscarDados('ContasFixas'),
      buscarDados('PagamentosContasFixas')
    ]);

    const alertas = calcularAlertasContasFixas(contasFixas, pagamentos);
    container.innerHTML = montarAlertasContasFixas(alertas);
  });
}