import { buscarDados } from '../services/api.js';
import { gerarGraficoBarras } from './graficos.js';

export async function renderRelatorios() {
  const [entradas, gastos] = await Promise.all([
    buscarDados('Entradas'),
    buscarDados('Gastos')
  ]);

  const gastosPorCategoria = agruparPorCategoria(gastos);
  const entradasPorCategoria = agruparPorCategoria(entradas);

  return `
    <h3>📈 Gastos por Categoria</h3>
    <div class="grafico-container">
      ${gerarGraficoBarras(gastosPorCategoria, '--cor-perigo')}
    </div>

    <h3 style="margin-top: var(--espaco-xl);">📈 Entradas por Categoria</h3>
    <div class="grafico-container">
      ${gerarGraficoBarras(entradasPorCategoria, '--cor-sucesso')}
    </div>
  `;
}

function agruparPorCategoria(lista) {
  const mapa = {};
  lista.forEach(item => {
    const cat = item.categoria || 'Sem categoria';
    mapa[cat] = (mapa[cat] || 0) + Number(item.valor);
  });
  return Object.keys(mapa).map(label => ({ label, valor: mapa[label] }));
}