// Gera uma barra horizontal simples (sem bibliotecas externas)
export function gerarGraficoBarras(dados, corVar) {
  // dados = [{ label: 'Alimentação', valor: 350 }, ...]
  const maior = Math.max(...dados.map(d => d.valor), 1);

  return dados.map(d => {
    const largura = Math.round((d.valor / maior) * 100);
    return `
      <div class="grafico-barra">
        <span class="grafico-barra__label">${d.label}</span>
        <div class="grafico-barra__trilho">
          <div class="grafico-barra__preenchida" style="width:${largura}%; background-color: var(${corVar});"></div>
        </div>
        <span class="grafico-barra__valor">R$ ${d.valor.toFixed(2)}</span>
      </div>
    `;
  }).join('');
}