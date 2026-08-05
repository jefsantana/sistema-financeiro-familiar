import { buscarDados, salvarDados, excluirDados } from '../services/api.js';
import { ICONE_LIXEIRA, ativarBotoesExcluir } from '../utils/helpers.js';

export async function renderCategorias() {
  const categorias = await buscarDados('Categorias');
  return `
    <h3>🏷️ Nova Categoria</h3>
    <form id="formCategoria" class="formulario">
      <div class="campo">
        <label for="nome">Nome</label>
        <input type="text" id="nome" name="nome" required placeholder="Ex: Alimentação">
      </div>
      <div class="campo">
        <label for="tipo">Tipo</label>
        <select id="tipo" name="tipo" required>
          <option value="">Selecione</option>
          <option value="entrada">Entrada</option>
          <option value="gasto">Gasto</option>
        </select>
      </div>
      <button type="submit" class="botao botao--primario">Salvar Categoria</button>
    </form>
    <h3 class="titulo-lista">📋 Categorias cadastradas</h3>
    <div id="listaCategorias">${montarTabela(categorias)}</div>
  `;
}

function montarTabela(categorias) {
  if (categorias.length === 0) return '<p class="texto-vazio">Nenhuma categoria cadastrada ainda.</p>';
  const linhas = categorias.map(c => `
    <tr>
      <td>${c.nome}</td>
      <td>${c.tipo === 'entrada' ? '💵 Entrada' : '🧾 Gasto'}</td>
      <td class="tabela__acoes">
        <button class="btn-excluir" data-id="${c.id}" title="Excluir">${ICONE_LIXEIRA}</button>
      </td>
    </tr>
  `).join('');
  return `
    <table class="tabela">
      <thead><tr><th>Nome</th><th>Tipo</th><th></th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

export function iniciarEventosCategorias() {
  const form = document.getElementById('formCategoria');
  const lista = document.getElementById('listaCategorias');
  if (!form) return;

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const fd = new FormData(form);
    const nova = { nome: fd.get('nome'), tipo: fd.get('tipo') };

    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    await salvarDados('Categorias', nova);
    form.reset();

    const atualizadas = await buscarDados('Categorias');
    lista.innerHTML = montarTabela(atualizadas);

    botao.disabled = false;
    botao.textContent = 'Salvar Categoria';
  });

  ativarBotoesExcluir(lista, async function (id) {
    await excluirDados('Categorias', id);
    const atualizadas = await buscarDados('Categorias');
    lista.innerHTML = montarTabela(atualizadas);
  });
}