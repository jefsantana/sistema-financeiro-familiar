// ==========================================
// MÓDULO: DASHBOARD
// ==========================================

import { buscarDados, buscarDadosDashboard, salvarDados } from '../services/api.js';
import { gerarGraficoDonut, agruparPorCategoria } from './graficos.js';
import { formatarMoeda } from '../utils/helpers.js';

export async function renderDashboard() {
  const { entradas, gastos, contasFixas, pagamentos } = await buscarDadosDashboard();

  const totalEntradas = entradas.reduce((soma, item) => soma + Number(item.valor), 0);
  const totalGastos = gastos.reduce((soma, item) => soma + Number(item.valor), 0);
  const saldo = totalEntradas - totalGastos;

  const alertas = calcularAlertasContasFixas(contasFixas, pagamentos);
  const categorias = agruparPorCategoria(gastos);
  const resumoMensal = calcularResumoMensal(entradas, gastos);

  return `
    <h3>📊 Visão geral</h3>
    <div class="cards">
      <div class="card">
        <p class="card__label">Total de Entradas</p>
        <p class="card__valor card__valor--sucesso">${formatarMoeda(totalEntradas)}</p>
      </div>
      <div class="card">
        <p class="card__label">Total de Gastos</p>
        <p class="card__valor card__valor--perigo">${formatarMoeda(totalGastos)}</p>
      </div>
      <div class="card">
        <p class="card__label">Saldo</p>
        <p class="card__valor">${formatarMoeda(saldo)}</p>
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

    <div class="painel" style="margin-top: var(--espaco-md);">
      <p class="painel__titulo">📅 Resumo Mensal</p>
      ${montarTabelaMensal(resumoMensal)}
    </div>
  `;
}

/**
 * Agrupa entradas e gastos por mês (AAAA-MM), calculando
 * total de entrada, saída e saldo de cada mês.
 * Devolve os últimos 6 meses com movimentação, do mais
 * recente para o mais antigo.
 */
function calcularResumoMensal(entradas, gastos) {
  const mapa = {};

  function registrar(lista, chave) {
    lista.forEach(item => {
      const data = new Date(item.data);
      if (isNaN(data.getTime())) return;
      const mesAno = `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!mapa[mesAno]) mapa[mesAno] = { entrada: 0, saida: 0 };
      mapa[mesAno][chave] += Number(item.valor);
    });
  }

  registrar(entradas, 'entrada');
  registrar(gastos, 'saida');

  return Object.keys(mapa)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 6)
    .map(mesAno => ({
      mesAno,
      nome: nomeDoMes(mesAno),
      entrada: mapa[mesAno].entrada,
      saida: mapa[mesAno].saida,
      saldo: mapa[mesAno].entrada - mapa[mesAno].saida
    }));
}

function nomeDoMes(mesAno) {
  const [ano, mes] = mesAno.split('-');
  const data = new Date(Number(ano), Number(mes) - 1, 1);
  const texto = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function montarTabelaMensal(resumo) {
  if (resumo.length === 0) {
    return '<p class="texto-vazio">Sem lançamentos suficientes para montar o resumo mensal ainda.</p>';
  }

  const linhas = resumo.map(m => `
    <tr>
      <td>${m.nome}</td>
      <td class="valor-positivo">${formatarMoeda(m.entrada)}</td>
      <td class="valor-negativo">${formatarMoeda(m.saida)}</td>
      <td class="${m.saldo >= 0 ? 'valor-positivo' : 'valor-negativo'}">${formatarMoeda(m.saldo)}</td>
    </tr>
  `).join('');

  return `
    <table class="tabela">
      <thead>
        <tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

function normalizarMesAno(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}$/.test(valor)) return valor;
  const data = new Date(valor);
  if (isNaN(data.getTime())) return String(valor);
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
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
          <p class="alerta-item__info">${texto} · ${formatarMoeda(c.valor)}</p>
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