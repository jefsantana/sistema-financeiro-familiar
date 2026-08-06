// ==========================================
// MÓDULO: GRÁFICOS
// ==========================================

import { formatarMoeda } from '../utils/helpers.js';

export function gerarGraficoBarras(dados, corVar) {
  const maior = Math.max(...dados.map(d => d.valor), 1);

  return dados.map(d => {
    const largura = Math.round((d.valor / maior) * 100);
    return `
      <div class="grafico-barra">
        <span class="grafico-barra__label">${d.label}</span>
        <div class="grafico-barra__trilho">
          <div class="grafico-barra__preenchida" style="width:${largura}%; background-color: var(${corVar});"></div>
        </div>
        <span class="grafico-barra__valor">${formatarMoeda(d.valor)}</span>
      </div>
    `;
  }).join('');
}

const CORES_DONUT = ['#7B61FF', '#FF7A9C', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'];

export function gerarGraficoDonut(dados) {
  const total = dados.reduce((soma, d) => soma + d.valor, 0);

  if (total === 0) {
    return '<p class="texto-vazio">Sem dados suficientes para exibir o gráfico ainda.</p>';
  }

  const raio = 68;
  const circunferencia = 2 * Math.PI * raio;
  let acumulado = 0;

  const arcos = dados.map((d, i) => {
    const percentual = d.valor / total;
    const comprimento = percentual * circunferencia;
    const svg = `
      <circle cx="90" cy="90" r="${raio}" fill="none"
        stroke="${CORES_DONUT[i % CORES_DONUT.length]}"
        stroke-width="24"
        stroke-dasharray="${comprimento} ${circunferencia - comprimento}"
        stroke-dashoffset="${-acumulado}"
        transform="rotate(-90 90 90)"></circle>
    `;
    acumulado += comprimento;
    return svg;
  }).join('');

  const legenda = dados.map((d, i) => {
    const percentual = Math.round((d.valor / total) * 100);
    return `
      <li class="legenda-item">
        <span class="legenda-dot" style="background:${CORES_DONUT[i % CORES_DONUT.length]}"></span>
        <span class="legenda-label">${d.label}</span>
        <span class="legenda-percentual">${percentual}%</span>
      </li>
    `;
  }).join('');

  return `
    <div class="donut-container">
      <div class="donut-grafico">
        <svg viewBox="0 0 180 180" width="180" height="180">${arcos}</svg>
        <div class="donut-central">
          <p class="donut-valor">${formatarMoeda(total)}</p>
          <p class="donut-legenda-total">Total</p>
        </div>
      </div>
      <ul class="legenda-lista">${legenda}</ul>
    </div>
  `;
}

export function agruparPorCategoria(lista, limite = 5) {
  const mapa = {};
  lista.forEach(item => {
    const cat = item.categoria || 'Sem categoria';
    mapa[cat] = (mapa[cat] || 0) + Number(item.valor);
  });

  const agrupado = Object.keys(mapa).map(label => ({ label, valor: mapa[label] }));
  agrupado.sort((a, b) => b.valor - a.valor);

  if (agrupado.length <= limite) return agrupado;

  const principais = agrupado.slice(0, limite - 1);
  const restante = agrupado.slice(limite - 1).reduce((soma, d) => soma + d.valor, 0);
  return [...principais, { label: 'Outros', valor: restante }];
}

/**
 * Gera um gráfico de linha (SVG) comparando Entradas,
 * Saídas e Saldo ao longo dos últimos meses.
 * @param {Array} pontos - [{ mes: 'Mar', entrada, saida, saldo }, ...] em ordem cronológica
 */
export function gerarGraficoLinha(pontos) {
  if (pontos.length < 2) {
    return '<p class="texto-vazio">Ainda não há histórico suficiente para o gráfico de evolução.</p>';
  }

  const largura = 640;
  const altura = 180;
  const margemBaixo = 24;

  const todosValores = pontos.flatMap(p => [p.entrada, p.saida, p.saldo]);
  const maxValor = Math.max(...todosValores, 1);

  const passoX = largura / (pontos.length - 1);

  function coordenadas(chave) {
    return pontos.map((p, i) => {
      const x = i * passoX;
      const y = altura - margemBaixo - (p[chave] / maxValor) * (altura - margemBaixo - 10);
      return `${x},${y}`;
    }).join(' ');
  }

  function pontosCirculo(chave, cor) {
    return pontos.map((p, i) => {
      const x = i * passoX;
      const y = altura - margemBaixo - (p[chave] / maxValor) * (altura - margemBaixo - 10);
      return `<circle cx="${x}" cy="${y}" r="3.5" fill="${cor}" />`;
    }).join('');
  }

  const rotulos = pontos.map((p, i) => {
    const x = i * passoX;
    return `<text x="${x}" y="${altura - 4}" font-size="11" fill="var(--cor-texto-secundario)" text-anchor="middle">${p.mes}</text>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${largura} ${altura}" width="100%" height="200" preserveAspectRatio="xMidYMid meet">
      <polyline points="${coordenadas('entrada')}" fill="none" stroke="#10B981" stroke-width="2.5" />
      <polyline points="${coordenadas('saida')}" fill="none" stroke="#EF4444" stroke-width="2.5" />
      <polyline points="${coordenadas('saldo')}" fill="none" stroke="#7B61FF" stroke-width="2.5" />
      ${pontosCirculo('entrada', '#10B981')}
      ${pontosCirculo('saida', '#EF4444')}
      ${pontosCirculo('saldo', '#7B61FF')}
      ${rotulos}
    </svg>
    <div class="evolucao-legenda">
      <span><i style="background:#10B981"></i> Entradas</span>
      <span><i style="background:#EF4444"></i> Saídas</span>
      <span><i style="background:#7B61FF"></i> Saldo</span>
    </div>
  `;
}