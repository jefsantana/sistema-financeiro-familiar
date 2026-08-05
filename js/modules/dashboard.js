// ==========================================
// MÓDULO: DASHBOARD
// Busca entradas e gastos reais da planilha
// e exibe um resumo financeiro.
// ==========================================

import { buscarDados } from '../services/api.js';

export async function renderDashboard() {
  // Busca os dados reais das duas abas, ao mesmo tempo
  const [entradas, gastos] = await Promise.all([
    buscarDados('Entradas'),
    buscarDados('Gastos')
  ]);

  // Soma todos os valores de entrada
  const totalEntradas = entradas.reduce(function (soma, item) {
    return soma + Number(item.valor);
  }, 0);

  // Soma todos os valores de gasto
  const totalGastos = gastos.reduce(function (soma, item) {
    return soma + Number(item.valor);
  }, 0);

  const saldo = totalEntradas - totalGastos;

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
  `;
}