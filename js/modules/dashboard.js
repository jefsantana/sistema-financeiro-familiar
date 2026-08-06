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
        <p class="painel__titulo">🔔 Contas a vencer — ${nomeMesAtual()}</p>
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
 * Transforma QUALQUER formato de mesAno que vier da planilha
 * (texto puro "2026-08", ou uma data completa que o Google
 * Sheets converteu sozinho) no padrão "AAAA-MM", para permitir
 * comparação confiável.
 */
function normalizarMesAno(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}$/.test(valor)) {
    return valor;
  }
  const data = new Date(valor);
  if (isNaN(data.getTime())) return String(valor);
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

function calcularAlertasContasFixas(contasFixas, pagamentos) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const mesAnoAtual = `${ano}-${String(mes + 1).padStart(2, '0')}`;

  const idsPagosEsteMes = pagamentos
    .filter(p => normalizarMesAno(p.mesAno) === mesAnoAtual)
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

function nomeMesAtual() {
  const hoje = new Date();
  const texto = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function iniciarEventosDashboard() {
  const container = document.getElementById('alertasContasFixas');
  if (!container) return;

  container.addEventListener('click', async function (evento) {
    const botao = evento.target.closest('.botao-pagar');
    if (!botao) return;

    botao.disabled = true;
    botao.textContent = 'Salvando...';

    try {
      await salvarDados('PagamentosContasFixas', {
        contaFixaId: botao.dataset.id,
        mesAno: botao.dataset.mes
      });

      const [contasFixas, pagamentos] = await Promise.all([
        buscarDados('ContasFixas'),
        buscarDados('PagamentosContasFixas')
      ]);

      if (!Array.isArray(pagamentos)) {
        throw new Error('A aba "PagamentosContasFixas" não retornou dados válidos.');
      }

      const alertas = calcularAlertasContasFixas(contasFixas, pagamentos);
      container.innerHTML = montarAlertasContasFixas(alertas);
    } catch (erro) {
      console.error('Erro ao marcar conta como paga:', erro);
      botao.disabled = false;
      botao.textContent = 'Marcar como paga';
      alert('Não foi possível salvar. Verifique o console (F12) para detalhes.');
    }
  });
}