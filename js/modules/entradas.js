import { buscarDados, salvarDados, excluirDados } from '../services/api.js';
import { formatarData, ICONE_LIXEIRA, ativarBotoesExcluir, parseValorMonetario, ativarCampoMoeda } from '../utils/helpers.js';

export async function renderEntradas() {
  const entradas = await buscarDados('Entradas');

  return `
    <h3>💵 Nova Entrada</h3>
    <form id="formEntrada" class="formulario">
      <div class="campo">
        <label for="descricao">Descrição</label>
        <input type="text" id="descricao" name="descricao" required placeholder="Ex: Salário">
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
        <input type="text" id="categoria" name="categoria" required placeholder="Ex: Trabalho">
      </div>
      <button type="submit" class="botao botao--primario">Salvar Entrada</button>
    </form>

    <h3 class="titulo-lista">📋 Entradas cadastradas</h3>
    <div id="listaEntradas">${montarTabela(entradas)}</div>
  `;
}

function montarTabela(entradas) {
  if (entradas.length === 0) return '<p class="texto-vazio">Nenhuma entrada cadastrada ainda.</p>';

  const linhas = entradas.map(function (entrada) {
    return `
      <tr>
        <td>${entrada.descricao}</td>
        <td>${entrada.categoria}</td>
        <td>${formatarData(entrada.data)}</td>
        <td class="valor-positivo">R$ ${Number(entrada.valor).toFixed(2)}</td>
        <td class="tabela__acoes">
          <button class="btn-excluir" data-id="${entrada.id}" title="Excluir">${ICONE_LIXEIRA}</button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table class="tabela">
      <thead>
        <tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Valor</th><th></th></tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

export function iniciarEventosEntradas() {
  const form = document.getElementById('formEntrada');
  const lista = document.getElementById('listaEntradas');
  if (!form) return;

  ativarCampoMoeda(form.querySelector('#valor'));

  form.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const dadosFormulario = new FormData(form);
    const novaEntrada = {
      descricao: dadosFormulario.get('descricao'),
      valor: parseValorMonetario(dadosFormulario.get('valor')),
      data: dadosFormulario.get('data'),
      categoria: dadosFormulario.get('categoria')
    };

    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    await salvarDados('Entradas', novaEntrada);
    form.reset();

    const atualizadas = await buscarDados('Entradas');
    lista.innerHTML = montarTabela(atualizadas);

    botao.disabled = false;
    botao.textContent = 'Salvar Entrada';
  });

  ativarBotoesExcluir(lista, async function (id) {
    await excluirDados('Entradas', id);
    const atualizadas = await buscarDados('Entradas');
    lista.innerHTML = montarTabela(atualizadas);
  });
}