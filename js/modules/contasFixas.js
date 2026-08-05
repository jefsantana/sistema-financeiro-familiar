import { buscarDados, salvarDados } from '../services/api.js';

export async function renderContasFixas() {
  const contas = await buscarDados('ContasFixas');
  return `
    <h3>📌 Nova Conta Fixa</h3>
    <form id="formContaFixa" class="formulario">
      <div class="campo">
        <label for="descricao">Descrição</label>
        <input type="text" id="descricao" name="descricao" required placeholder="Ex: Aluguel">
      </div>
      <div class="campo">
        <label for="valor">Valor (R$)</label>
        <input type="number" id="valor" name="valor" step="0.01" min="0" required>
      </div>
      <div class="campo">
        <label for="diaVencimento">Dia de vencimento</label>
        <input type="number" id="diaVencimento" name="diaVencimento" min="1" max="31" required>
      </div>
      <div class="campo">
        <label for="categoria">Categoria</label>
        <input type="text" id="categoria" name="categoria" required placeholder="Ex: Moradia">
      </div>
      <button type="submit" class="botao botao--primario">Salvar Conta Fixa</button>
    </form>
    <h3 class="titulo-lista">📋 Contas fixas cadastradas</h3>
    <div id="listaContasFixas">${montarTabela(contas)}</div>
  `;
}

function montarTabela(contas) {
  if (contas.length === 0) return '<p class="texto-vazio">Nenhuma conta fixa cadastrada ainda.</p>';
  const linhas = contas.map(c => `
    <tr>
      <td>${c.descricao}</td>
      <td>${c.categoria}</td>
      <td>Dia ${c.diaVencimento}</td>
      <td class="valor-negativo">R$ ${Number(c.valor).toFixed(2)}</td>
    </tr>
  `).join('');
  return `
    <table class="tabela">
      <thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Valor</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

export function iniciarEventosContasFixas() {
  const form = document.getElementById('formContaFixa');
  if (!form) return;

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const fd = new FormData(form);
    const nova = {
      descricao: fd.get('descricao'),
      valor: Number(fd.get('valor')),
      diaVencimento: Number(fd.get('diaVencimento')),
      categoria: fd.get('categoria')
    };

    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    await salvarDados('ContasFixas', nova);
    form.reset();

    const atualizadas = await buscarDados('ContasFixas');
    document.getElementById('listaContasFixas').innerHTML = montarTabela(atualizadas);

    botao.disabled = false;
    botao.textContent = 'Salvar Conta Fixa';
  });
}