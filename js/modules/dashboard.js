// ==========================================
// MÓDULO: DASHBOARD
// ==========================================

import { buscarDados, buscarDadosDashboard, salvarDados, atualizarDados } from '../services/api.js';
import { gerarGraficoDonut, gerarGraficoLinha, agruparPorCategoria } from './graficos.js';
import { formatarMoeda, formatarData } from '../utils/helpers.js';

export async function renderDashboard() {
  const { entradas, gastos, contasFixas, pagamentos, parcelamentos, pagamentosParcelamentos } = await buscarDadosDashboard();

  const hoje = new Date();
  const mesAtualStr = mesAnoDe(hoje);
  const mesAnteriorStr = mesAnoDe(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));

  const entradasMes = entradas.filter(e => obterMesAno(e.data) === mesAtualStr);
  const gastosMes = gastos.filter(g => obterMesAno(g.data) === mesAtualStr);
  const entradasMesAnterior = entradas.filter(e => obterMesAno(e.data) === mesAnteriorStr);
  const gastosMesAnterior = gastos.filter(g => obterMesAno(g.data) === mesAnteriorStr);

  const totalEntradasMes = somar(entradasMes);
  const totalSaidasMes = somar(gastosMes);
  const economiaMes = totalEntradasMes - totalSaidasMes;

  const totalEntradasMesAnterior = somar(entradasMesAnterior);
  const totalSaidasMesAnterior = somar(gastosMesAnterior);

  const totalEntradasGeral = somar(entradas);
  const totalGastosGeral = somar(gastos);
  const saldoAtual = totalEntradasGeral - totalGastosGeral;

  const alertasContas = calcularAlertasContasFixas(contasFixas, pagamentos);
  const alertasParcelas = calcularAlertasParcelamentos(parcelamentos, pagamentosParcelamentos);
  const vencimentos = [...alertasContas, ...alertasParcelas].sort((a, b) => a.diasRestantes - b.diasRestantes);
  const totalPendenteMes = vencimentos.reduce((soma, v) => soma + Number(v.valor), 0);

  const categorias = agruparPorCategoria(gastosMes);
  const resumoMensal = calcularResumoMensal(entradas, gastos);
  const ultimosLancamentos = montarUltimosLancamentos(entradas, gastos);

  return `
    <div class="dash-saudacao">
      <h3>${saudacao()}, Jeferson e Raquel! 👋</h3>
      <p class="dash-data">${dataPorExtenso(hoje)}</p>
    </div>

    <div class="cards cards--dash">
      <div class="card">
        <p class="card__label">Saldo Atual</p>
        <p class="card__valor">${formatarMoeda(saldoAtual)}</p>
      </div>
      <div class="card">
        <p class="card__label">Entradas do mês</p>
        <p class="card__valor card__valor--sucesso">${formatarMoeda(totalEntradasMes)}</p>
        ${tendencia(totalEntradasMes, totalEntradasMesAnterior)}
      </div>
      <div class="card">
        <p class="card__label">Saídas do mês</p>
        <p class="card__valor card__valor--perigo">${formatarMoeda(totalSaidasMes)}</p>
        ${tendencia(totalSaidasMes, totalSaidasMesAnterior, true)}
      </div>
      <div class="card">
        <p class="card__label">Pendente este mês</p>
        <p class="card__valor card__valor--perigo">${formatarMoeda(totalPendenteMes)}</p>
        <p class="card__tendencia">Contas fixas + parcelas a pagar</p>
      </div>
    </div>

    <div class="painel-grid">
      <div class="painel">
        <p class="painel__titulo">📈 Evolução Financeira <span class="painel__subtitulo">últimos ${resumoMensal.length} meses</span></p>
        ${gerarGraficoLinha([...resumoMensal].reverse().map(m => ({ mes: m.nomeCurto, entrada: m.entrada, saida: m.saida, saldo: m.saldo })))}
      </div>

      <div class="painel">
        <p class="painel__titulo">🥯 Gastos por Categoria <span class="painel__subtitulo">este mês</span></p>
        ${gerarGraficoDonut(categorias)}
      </div>
    </div>

    <div class="painel-grid">
      <div class="painel">
        <p class="painel__titulo">🧾 Últimos Lançamentos</p>
        ${ultimosLancamentos}
      </div>

      <div class="painel">
        <p class="painel__titulo">🔔 Próximos Vencimentos — ${nomeMesAtual()}</p>
        <div id="alertasVencimentos">${montarAlertasVencimentos(vencimentos)}</div>
      </div>
    </div>

    <div class="painel" style="margin-top: var(--espaco-md);">
      <p class="painel__titulo">👥 Gastos por Pessoa <span class="painel__subtitulo">este mês</span></p>
      ${montarGastosPorPessoa(gastosMes)}
    </div>

    <div class="painel" style="margin-top: var(--espaco-md);">
      <p class="painel__titulo">📅 Resumo Mensal</p>
      ${montarTabelaMensal(resumoMensal)}
    </div>
  `;
}

// ------------------------------------------
// FUNÇÕES DE APOIO
// ------------------------------------------

function somar(lista) {
  return lista.reduce((soma, item) => soma + Number(item.valor), 0);
}

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function dataPorExtenso(data) {
  const texto = data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function nomeMesAtual() {
  const texto = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function obterMesAno(dataStr) {
  const data = new Date(dataStr);
  if (isNaN(data.getTime())) return '';
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
}

function mesAnoDe(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

function tendencia(atual, anterior, inverter = false) {
  if (anterior === 0) return '';
  const percentual = Math.round(((atual - anterior) / anterior) * 100);
  const subiu = percentual >= 0;
  const bom = inverter ? !subiu : subiu;
  const seta = subiu ? '↑' : '↓';
  return `<p class="card__tendencia ${bom ? 'card__tendencia--boa' : 'card__tendencia--ruim'}">${seta} ${Math.abs(percentual)}% vs mês passado</p>`;
}

function normalizarMesAno(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}$/.test(valor)) return valor;
  const data = new Date(valor);
  if (isNaN(data.getTime())) return String(valor);
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
}

function diasAteVencimento(dia) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const ultimoDiaDoMes = new Date(ano, mes + 1, 0).getDate();
  const diaAjustado = Math.min(Number(dia), ultimoDiaDoMes);
  const dataVencimento = new Date(ano, mes, diaAjustado);
  return Math.round((dataVencimento - hoje) / (1000 * 60 * 60 * 24));
}

function calcularAlertasContasFixas(contasFixas, pagamentos) {
  const mesAnoAtual = mesAnoDe(new Date());
  const idsPagos = pagamentos
    .filter(p => normalizarMesAno(p.mesAno) === mesAnoAtual)
    .map(p => String(p.contaFixaId));

  return contasFixas
    .filter(c => !idsPagos.includes(String(c.id)))
    .map(c => ({
      tipo: 'contaFixa',
      id: c.id,
      descricao: c.descricao,
      valor: Number(c.valor),
      categoria: c.categoria,
      cartao: '',
      mesAno: mesAnoAtual,
      diasRestantes: diasAteVencimento(c.diaVencimento)
    }));
}

/**
 * Considera "pendente este mês" todo parcelamento que ainda
 * está em andamento (parcelaAtual <= numeroParcelas) e que
 * ainda não tem pagamento registrado no mês atual.
 */
function calcularAlertasParcelamentos(parcelamentos, pagamentosParcelamentos) {
  const mesAnoAtual = mesAnoDe(new Date());
  const idsPagos = pagamentosParcelamentos
    .filter(p => normalizarMesAno(p.mesAno) === mesAnoAtual)
    .map(p => String(p.parcelamentoId));

  return parcelamentos
    .filter(p => Number(p.parcelaAtual) <= Number(p.numeroParcelas))
    .filter(p => !idsPagos.includes(String(p.id)))
    .map(p => {
      const valorParcela = Number(p.valorTotal) / Number(p.numeroParcelas);
      return {
        tipo: 'parcelamento',
        id: p.id,
        descricao: `${p.descricao} (parcela ${p.parcelaAtual}/${p.numeroParcelas})`,
        valor: valorParcela,
        categoria: 'Parcelamento',
        cartao: p.cartao || '',
        mesAno: mesAnoAtual,
        parcelaAtual: Number(p.parcelaAtual),
        diasRestantes: diasAteVencimento(p.diaVencimento || 1)
      };
    });
}

function montarAlertasVencimentos(vencimentos) {
  if (vencimentos.length === 0) {
    return '<p class="texto-vazio">Nenhuma conta ou parcela pendente este mês. 🎉</p>';
  }

  const itens = vencimentos.map(v => {
    let status = 'neutro';
    let texto = `Vence em ${v.diasRestantes} dias`;

    if (v.diasRestantes < 0) {
      status = 'vencida';
      texto = `Vencida há ${Math.abs(v.diasRestantes)} dia(s)`;
    } else if (v.diasRestantes === 0) {
      status = 'hoje';
      texto = 'Vence hoje';
    } else if (v.diasRestantes <= 5) {
      status = 'proxima';
      texto = `Vence em ${v.diasRestantes} dia(s)`;
    }

    const rotulo = v.tipo === 'parcelamento' ? '🧩' : '📌';

    return `
      <li class="alerta-item alerta-item--${status}">
        <div>
          <p class="alerta-item__descricao">${rotulo} ${v.descricao}</p>
          <p class="alerta-item__info">${texto} · ${formatarMoeda(v.valor)}</p>
        </div>
        <div class="alerta-item__acoes">
          <select class="select-pessoa" aria-label="Quem está pagando">
            <option value="Jeferson">Jeferson</option>
            <option value="Raquel">Raquel</option>
          </select>
          <button class="botao-pagar"
            data-tipo="${v.tipo}"
            data-id="${v.id}"
            data-mes="${v.mesAno}"
            data-descricao="${v.descricao}"
            data-valor="${v.valor}"
            data-categoria="${v.categoria}"
            data-cartao="${v.cartao}"
            data-parcela-atual="${v.parcelaAtual || ''}"
          >Pagar</button>
        </div>
      </li>
    `;
  }).join('');

  return `<ul class="alerta-lista">${itens}</ul>`;
}

function montarUltimosLancamentos(entradas, gastos) {
  const todos = [
    ...entradas.map(e => ({ ...e, tipo: 'entrada' })),
    ...gastos.map(g => ({ ...g, tipo: 'gasto' }))
  ]
    .filter(item => !isNaN(new Date(item.data).getTime()))
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .slice(0, 6);

  if (todos.length === 0) {
    return '<p class="texto-vazio">Nenhum lançamento registrado ainda.</p>';
  }

  const itens = todos.map(item => {
    const sinal = item.tipo === 'entrada' ? '+' : '-';
    const classeValor = item.tipo === 'entrada' ? 'valor-positivo' : 'valor-negativo';
    const icone = item.tipo === 'entrada'
      ? `<svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 4v14M6 12l6 6 6-6" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 20V6M6 12l6-6 6 6" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    return `
      <li class="lancamento-item">
        <span class="lancamento-icone lancamento-icone--${item.tipo}">${icone}</span>
        <div class="lancamento-info">
          <p class="lancamento-descricao">${item.descricao}</p>
          <p class="lancamento-data">${formatarData(item.data)}</p>
        </div>
        <span class="${classeValor}">${sinal} ${formatarMoeda(item.valor)}</span>
      </li>
    `;
  }).join('');

  return `<ul class="lancamento-lista">${itens}</ul>`;
}

function montarGastosPorPessoa(gastosMes) {
  const mapa = {};
  let total = 0;

  gastosMes.forEach(g => {
    const pessoa = g.pessoa || 'Não informado';
    mapa[pessoa] = (mapa[pessoa] || 0) + Number(g.valor);
    total += Number(g.valor);
  });

  const pessoas = Object.keys(mapa);
  if (pessoas.length === 0) {
    return '<p class="texto-vazio">Nenhum gasto registrado este mês ainda.</p>';
  }

  const itens = pessoas
    .sort((a, b) => mapa[b] - mapa[a])
    .map(pessoa => {
      const percentual = total > 0 ? Math.round((mapa[pessoa] / total) * 100) : 0;
      const iniciais = pessoa.slice(0, 1).toUpperCase();
      return `
        <li class="pessoa-item">
          <span class="pessoa-avatar">${iniciais}</span>
          <div class="pessoa-info">
            <div class="pessoa-cabecalho">
              <span class="pessoa-nome">${pessoa}</span>
              <span class="pessoa-valor">${formatarMoeda(mapa[pessoa])}</span>
            </div>
            <div class="barra-progresso">
              <div class="barra-progresso__preenchida" style="width:${percentual}%"></div>
            </div>
          </div>
          <span class="pessoa-percentual">${percentual}%</span>
        </li>
      `;
    }).join('');

  return `<ul class="pessoa-lista">${itens}</ul>`;
}

function calcularResumoMensal(entradas, gastos) {
  const mapa = {};

  function registrar(lista, chave) {
    lista.forEach(item => {
      const mesAno = obterMesAno(item.data);
      if (!mesAno) return;
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
      nome: nomeDoMes(mesAno, 'long'),
      nomeCurto: nomeDoMes(mesAno, 'short'),
      entrada: mapa[mesAno].entrada,
      saida: mapa[mesAno].saida,
      saldo: mapa[mesAno].entrada - mapa[mesAno].saida
    }));
}

function nomeDoMes(mesAno, formato) {
  const [ano, mes] = mesAno.split('-');
  const data = new Date(Number(ano), Number(mes) - 1, 1);
  if (formato === 'short') {
    const texto = data.toLocaleDateString('pt-BR', { month: 'short' });
    return texto.replace('.', '').charAt(0).toUpperCase() + texto.replace('.', '').slice(1);
  }
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
      <thead><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

// ------------------------------------------
// EVENTOS: pagar conta fixa OU parcela
// ------------------------------------------
export function iniciarEventosDashboard() {
  const container = document.getElementById('alertasVencimentos');
  if (!container) return;

  container.addEventListener('click', async function (evento) {
    const botao = evento.target.closest('.botao-pagar');
    if (!botao) return;

    botao.disabled = true;
    botao.textContent = '...';

    try {
      const tipo = botao.dataset.tipo;

      if (tipo === 'contaFixa') {
        await pagarContaFixa(botao);
      } else {
        await pagarParcela(botao);
      }

      const conteudoAtualizado = await renderDashboard();
      document.getElementById('content').innerHTML = conteudoAtualizado;
      iniciarEventosDashboard();
    } catch (erro) {
      console.error('Erro ao registrar pagamento:', erro);
      botao.disabled = false;
      botao.textContent = 'Pagar';
      alert('Não foi possível salvar. Verifique o console (F12) para detalhes.');
    }
  });
}

async function pagarContaFixa(botao) {
  await salvarDados('PagamentosContasFixas', {
    contaFixaId: botao.dataset.id,
    mesAno: botao.dataset.mes
  });

  await salvarDados('Gastos', {
    descricao: botao.dataset.descricao,
    valor: Number(botao.dataset.valor),
    data: new Date().toISOString().slice(0, 10),
    categoria: botao.dataset.categoria || 'Contas Fixas',
    cartao: '',
    pessoa: ''
  });
}

async function pagarParcela(botao) {
  await salvarDados('PagamentosParcelamentos', {
    parcelamentoId: botao.dataset.id,
    mesAno: botao.dataset.mes
  });

  await salvarDados('Gastos', {
    descricao: botao.dataset.descricao,
    valor: Number(botao.dataset.valor),
    data: new Date().toISOString().slice(0, 10),
    categoria: botao.dataset.categoria || 'Parcelamento',
    cartao: botao.dataset.cartao || '',
    pessoa: ''
  });

  // Avança a parcela atual, para que na próxima vez que essa
  // função rodar, o Parcelamento já reflita a parcela seguinte
  const parcelaAtual = Number(botao.dataset.parcelaAtual);
  await atualizarDados('Parcelamentos', botao.dataset.id, {
    parcelaAtual: parcelaAtual + 1
  });
}