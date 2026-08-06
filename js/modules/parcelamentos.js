import { buscarDados, salvarDados, excluirDados } from '../services/api.js';
import { formatarMoeda, ICONE_LIXEIRA, ativarBotoesExcluir, parseValorMonetario, ativarCampoMoeda } from '../utils/helpers.js';

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
        <input type="text" inputmode="decimal" id="valorTotal" name="valorTotal" required placeholder="0,00">
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
        <label for="diaVencimento">Dia do vencimento</label>
        <input type="number" id="diaVencimento" name="diaVencimento" min="1" max="31" required>
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
        <td>${formatarMoeda(p.valorTotal)}</td>
        <td>Dia ${p.diaVencimento || '-'}</td>
        <td>
          ${p.parcelaAtual}/${p.numeroParcelas}
          <div class="barra-progresso"><div class="barra-progresso__preenchida" style="width:${percentual}%"></div></div>
        </td>
        <td class="tabela__acoes">
          <button class="btn-excluir" data-id="${p.id}" title="Excluir">${ICONE_LIXEIRA}</button>
        </td>
      </tr>
    `;
  }).join('');
  return `
    <table class="tabela">
      <thead><tr><th>Descrição</th><th>Cartão</th><th>Valor Total</th><th>Vencimento</th><th>Progresso</th><th></th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

export function iniciarEventosParcelamentos() {
  const form = document.getElementById('formParcelamento');
  const lista = document.getElementById('listaParcelamentos');
  if (!form) return;

  ativarCampoMoeda(form.querySelector('#valorTotal'));

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const fd = new FormData(form);
    const novo = {
      descricao: fd.get('descricao'),
      valorTotal: parseValorMonetario(fd.get('valorTotal')),
      numeroParcelas: Number(fd.get('numeroParcelas')),
      parcelaAtual: Number(fd.get('parcelaAtual')),
      diaVencimento: Number(fd.get('diaVencimento')),
      cartao: fd.get('cartao') || ''
    };

    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    await salvarDados('Parcelamentos', novo);
    form.reset();

    const atualizados = await buscarDados('Parcelamentos');
    lista.innerHTML = montarTabela(atualizados);

    botao.disabled = false;
    botao.textContent = 'Salvar Parcelamento';
  });

  ativarBotoesExcluir(lista, async function (id) {
    await excluirDados('Parcelamentos', id);
    const atualizados = await buscarDados('Parcelamentos');
    lista.innerHTML = montarTabela(atualizados);
  });
}