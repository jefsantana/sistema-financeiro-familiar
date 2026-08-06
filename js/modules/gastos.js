import { buscarDados, salvarDados, excluirDados } from '../services/api.js';
import { formatarData, ICONE_LIXEIRA, ativarBotoesExcluir, parseValorMonetario, ativarCampoMoeda } from '../utils/helpers.js';

export async function renderGastos() {
  const gastos = await buscarDados('Gastos');

  return `
    <h3>🧾 Novo Gasto</h3>
    <form id="formGasto" class="formulario">
      <div class="campo">
        <label for="descricao">Descrição</label>
        <input type="text" id="descricao" name="descricao" required placeholder="Ex: Supermercado">
      </div>
      <div class="campo">
        <label for="valor">Valor (R$)</label>
        <input type="text" inputmode="decimal" id="valor" name="valor" required placeholder="0,00">
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
    <div id="listaGastos">${montarTabela(gastos)}</div>
  `;
}

function montarTabela(gastos) {
  if (gastos.length === 0) return '<p class="texto-vazio">Nenhum gasto cadastrado ainda.</p>';

  const linhas = gastos.map(function (gasto) {
    return `
      <tr>
        <td>${gasto.descricao}</td>
        <td>${gasto.categoria}</td>
        <td>${gasto.cartao || '-'}</td>
        <td>${formatarData(gasto.data)}</td>
        <td class="valor-negativo">R$ ${Number(gasto.valor).toFixed(2)}</td>
        <td class="tabela__acoes">
          <button class="btn-excluir" data-id="${gasto.id}" title="Excluir">${ICONE_LIXEIRA}</button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table class="tabela">
      <thead>
        <tr><th>Descrição</th><th>Categoria</th><th>Cartão</th><th>Data</th><th>Valor</th><th></th></tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

export function iniciarEventosGastos() {
  const form = document.getElementById('formGasto');
  const lista = document.getElementById('listaGastos');
  if (!form) return;

  ativarCampoMoeda(form.querySelector('#valor'));

  form.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const dadosFormulario = new FormData(form);
    const novoGasto = {
      descricao: dadosFormulario.get('descricao'),
      valor: parseValorMonetario(dadosFormulario.get('valor')),
      data: dadosFormulario.get('data'),
      categoria: dadosFormulario.get('categoria'),
      cartao: dadosFormulario.get('cartao') || ''
    };

    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    await salvarDados('Gastos', novoGasto);
    form.reset();

    const atualizados = await buscarDados('Gastos');
    lista.innerHTML = montarTabela(atualizados);

    botao.disabled = false;
    botao.textContent = 'Salvar Gasto';
  });

  ativarBotoesExcluir(lista, async function (id) {
    await excluirDados('Gastos', id);
    const atualizados = await buscarDados('Gastos');
    lista.innerHTML = montarTabela(atualizados);
  });
}