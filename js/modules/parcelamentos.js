import { buscarDados, salvarDados } from '../services/api.js';

export async function renderParcelamentos() {
  const parcelamentos = await buscarDados('Parcelamentos');
  return `
    <h3>🧩 Novo Parcelamento</h3>
    <form id="formParcelamento" class="formulario">
      <div class="campo">
        <label for="descricao">Descrição</label>
        <input type="text" id="descricao" name="descricao" required placeholder="Ex: Notebook">
      </div>
      <div class="campo">
        <label for="valorTotal">Valor total (R$)</label>
        <input type="number" id="valorTotal" name="valorTotal" step="0.01" min="0" required>
      </div>
      <div class="campo">
        <label for="numeroParcelas">Nº de parcelas</label>
        <input type="number" id="numeroParcelas" name="numeroParcelas" min="1" required>
      </div>
      <div class="campo">
        <label for="parcelaAtual">Parcela atual</label>
        <input type="number" id="parcelaAtual" name="parcelaAtual" min="1" required>
      </div>
      <div class="campo">
        <label for="cartao">Cartão (opcional)</label>
        <input type="text" id="cartao" name="cartao" placeholder="Ex: Nubank">
      </div>
      <button type="submit" class="botao botao--primario">Salvar Parcelamento</button>
    </form>
    <h3 class="titulo-lista">📋 Parcelamentos cadastrados</h3>
    <div id="listaParcelamentos">${montarTabela(parcelamentos)}</div>
  `;
}

function montarTabela(parcelamentos) {
  if (parcelamentos.length === 0) return '<p class="texto-vazio">Nenhum parcelamento cadastrado ainda.</p>';
  const linhas = parcelamentos.map(p => {
    const percentual = Math.min(100, Math.round((Number(p.parcelaAtual) / Number(p.numeroParcelas)) * 100));
    return `
      <tr>
        <td>${p.descricao}</td>
        <td>${p.cartao || '-'}</td>
        <td>R$ ${Number(p.valorTotal).toFixed(2)}</td>
        <td>
          ${p.parcelaAtual}/${p.numeroParcelas}
          <div class="barra-progresso"><div class="barra-progresso__preenchida" style="width:${percentual}%"></div></div>
        </td>
      </tr>
    `;
  }).join('');
  return `
    <table class="tabela">
      <thead><tr><th>Descrição</th><th>Cartão</th><th>Valor Total</th><th>Progresso</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

export function iniciarEventosParcelamentos() {
  const form = document.getElementById('formParcelamento');
  if (!form) return;

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const fd = new FormData(form);
    const novo = {
      descricao: fd.get('descricao'),
      valorTotal: Number(fd.get('valorTotal')),
      numeroParcelas: Number(fd.get('numeroParcelas')),
      parcelaAtual: Number(fd.get('parcelaAtual')),
      cartao: fd.get('cartao') || ''
    };

    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    await salvarDados('Parcelamentos', novo);
    form.reset();

    const atualizados = await buscarDados('Parcelamentos');
    document.getElementById('listaParcelamentos').innerHTML = montarTabela(atualizados);

    botao.disabled = false;
    botao.textContent = 'Salvar Parcelamento';
  });
}