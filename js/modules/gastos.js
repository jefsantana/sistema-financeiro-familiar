// ==========================================
// MÓDULO: GASTOS
// Formulário de cadastro + lista de gastos,
// conectado com a planilha via API.
// Segue o mesmo padrão do módulo de Entradas.
// ==========================================

import { buscarDados, salvarDados } from '../services/api.js';

export async function renderGastos() {
  const gastos = await buscarDados('Gastos');

  const html = `
    <h3>🧾 Novo Gasto</h3>

    <form id="formGasto" class="formulario">
      <div class="campo">
        <label for="descricao">Descrição</label>
        <input type="text" id="descricao" name="descricao" required placeholder="Ex: Supermercado">
      </div>

      <div class="campo">
        <label for="valor">Valor (R$)</label>
        <input type="number" id="valor" name="valor" step="0.01" min="0" required placeholder="0,00">
      </div>

      <div class="campo">
        <label for="data">Data</label>
        <input type="date" id="data" name="data" required>
      </div>

      <div class="campo">
        <label for="categoria">Categoria</label>
        <input type="text" id="categoria" name="categoria" required placeholder="Ex: Alimentação">
      </div>

      <div class="campo">
        <label for="cartao">Cartão (opcional)</label>
        <input type="text" id="cartao" name="cartao" placeholder="Ex: Nubank">
      </div>

      <button type="submit" class="botao botao--primario">Salvar Gasto</button>
    </form>

    <h3 class="titulo-lista">📋 Gastos cadastrados</h3>

    <div id="listaGastos">
      ${montarTabela(gastos)}
    </div>
  `;

  return html;
}

/**
 * Monta a tabela HTML a partir da lista de gastos
 */
function montarTabela(gastos) {
  if (gastos.length === 0) {
    return '<p class="texto-vazio">Nenhum gasto cadastrado ainda.</p>';
  }

  const linhas = gastos.map(function (gasto) {
    return `
      <tr>
        <td>${gasto.descricao}</td>
        <td>${gasto.categoria}</td>
        <td>${gasto.cartao || '-'}</td>
        <td>${formatarData(gasto.data)}</td>
        <td class="valor-negativo">R$ ${Number(gasto.valor).toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
    <table class="tabela">
      <thead>
        <tr>
          <th>Descrição</th>
          <th>Categoria</th>
          <th>Cartão</th>
          <th>Data</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        ${linhas}
      </tbody>
    </table>
  `;
}

function formatarData(dataISO) {
  const data = new Date(dataISO);
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/**
 * Configura o "escutador" do formulário de gastos.
 */
export function iniciarEventosGastos() {
  const form = document.getElementById('formGasto');

  if (!form) return;

  form.addEventListener('submit', async function (evento) {
    evento.preventDefault();

    const dadosFormulario = new FormData(form);

    const novoGasto = {
      descricao: dadosFormulario.get('descricao'),
      valor: Number(dadosFormulario.get('valor')),
      data: dadosFormulario.get('data'),
      categoria: dadosFormulario.get('categoria'),
      cartao: dadosFormulario.get('cartao') || ''
    };

    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    await salvarDados('Gastos', novoGasto);

    form.reset();

    const gastosAtualizados = await buscarDados('Gastos');
    document.getElementById('listaGastos').innerHTML = montarTabela(gastosAtualizados);

    botao.disabled = false;
    botao.textContent = 'Salvar Gasto';
  });
}