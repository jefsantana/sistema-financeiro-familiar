import { buscarDados, salvarDados, excluirDados } from '../services/api.js';
import { ICONE_LIXEIRA, ativarBotoesExcluir } from '../utils/helpers.js';

export async function renderCartoes() {
  const cartoes = await buscarDados('Cartoes');
  return `
    <h3>💳 Novo Cartão</h3>
    <form id="formCartao" class="formulario">
      <div class="campo">
        <label for="nome">Nome</label>
        <input type="text" id="nome" name="nome" required placeholder="Ex: Nubank">
      </div>
      <div class="campo">
        <label for="limite">Limite (R$)</label>
        <input type="number" id="limite" name="limite" step="0.01" min="0" required>
      </div>
      <div class="campo">
        <label for="diaFechamento">Dia de fechamento</label>
        <input type="number" id="diaFechamento" name="diaFechamento" min="1" max="31" required>
      </div>
      <button type="submit" class="botao botao--primario">Salvar Cartão</button>
    </form>
    <h3 class="titulo-lista">📋 Cartões cadastrados</h3>
    <div id="listaCartoes">${montarTabela(cartoes)}</div>
  `;
}

function montarTabela(cartoes) {
  if (cartoes.length === 0) return '<p class="texto-vazio">Nenhum cartão cadastrado ainda.</p>';
  const linhas = cartoes.map(c => `
    <tr>
      <td>${c.nome}</td>
      <td>R$ ${Number(c.limite).toFixed(2)}</td>
      <td>Dia ${c.diaFechamento}</td>
      <td class="tabela__acoes">
        <button class="btn-excluir" data-id="${c.id}" title="Excluir">${ICONE_LIXEIRA}</button>
      </td>
    </tr>
  `).join('');
  return `
    <table class="tabela">
      <thead><tr><th>Nome</th><th>Limite</th><th>Fechamento</th><th></th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

export function iniciarEventosCartoes() {
  const form = document.getElementById('formCartao');
  const lista = document.getElementById('listaCartoes');
  if (!form) return;

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const fd = new FormData(form);
    const novo = {
      nome: fd.get('nome'),
      limite: Number(fd.get('limite')),
      diaFechamento: Number(fd.get('diaFechamento'))
    };

    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    await salvarDados('Cartoes', novo);
    form.reset();

    const atualizados = await buscarDados('Cartoes');
    lista.innerHTML = montarTabela(atualizados);

    botao.disabled = false;
    botao.textContent = 'Salvar Cartão';
  });

  ativarBotoesExcluir(lista, async function (id) {
    await excluirDados('Cartoes', id);
    const atualizados = await buscarDados('Cartoes');
    lista.innerHTML = montarTabela(atualizados);
  });
}