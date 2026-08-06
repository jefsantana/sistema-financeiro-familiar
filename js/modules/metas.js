import { buscarDados, salvarDados, excluirDados } from '../services/api.js';
import { formatarMoeda, ICONE_LIXEIRA, ativarBotoesExcluir, parseValorMonetario, ativarCampoMoeda } from '../utils/helpers.js';

export async function renderMetas() {
  const metas = await buscarDados('Metas');
  return `
    <h3>🎯 Nova Meta</h3>
    <form id="formMeta" class="formulario">
      <div class="campo">
        <label for="descricao">Descrição</label>
        <input type="text" id="descricao" name="descricao" required placeholder="Ex: Viagem">
      </div>
      <div class="campo">
        <label for="valorAlvo">Valor alvo (R$)</label>
        <input type="text" inputmode="decimal" id="valorAlvo" name="valorAlvo" required placeholder="0,00">
      </div>
      <div class="campo">
        <label for="valorAtual">Valor já guardado (R$)</label>
        <input type="text" inputmode="decimal" id="valorAtual" name="valorAtual" required placeholder="0,00">
      </div>
      <button type="submit" class="botao botao--primario">Salvar Meta</button>
    </form>
    <h3 class="titulo-lista">📋 Metas cadastradas</h3>
    <div id="listaMetas">${montarLista(metas)}</div>
  `;
}

function montarLista(metas) {
  if (metas.length === 0) return '<p class="texto-vazio">Nenhuma meta cadastrada ainda.</p>';
  return metas.map(m => {
    const percentual = Math.min(100, Math.round((Number(m.valorAtual) / Number(m.valorAlvo)) * 100));
    return `
      <div class="card" style="margin-bottom: var(--espaco-md);">
        <button class="btn-excluir card__excluir" data-id="${m.id}" title="Excluir">${ICONE_LIXEIRA}</button>
        <p class="card__label">${m.descricao}</p>
        <p>${formatarMoeda(m.valorAtual)} de ${formatarMoeda(m.valorAlvo)} (${percentual}%)</p>
        <div class="barra-progresso"><div class="barra-progresso__preenchida" style="width:${percentual}%"></div></div>
      </div>
    `;
  }).join('');
}

export function iniciarEventosMetas() {
  const form = document.getElementById('formMeta');
  const lista = document.getElementById('listaMetas');
  if (!form) return;

  ativarCampoMoeda(form.querySelector('#valorAlvo'));
  ativarCampoMoeda(form.querySelector('#valorAtual'));

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const fd = new FormData(form);
    const nova = {
      descricao: fd.get('descricao'),
      valorAlvo: parseValorMonetario(fd.get('valorAlvo')),
      valorAtual: parseValorMonetario(fd.get('valorAtual'))
    };

    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    await salvarDados('Metas', nova);
    form.reset();

    const atualizadas = await buscarDados('Metas');
    lista.innerHTML = montarLista(atualizadas);

    botao.disabled = false;
    botao.textContent = 'Salvar Meta';
  });

  ativarBotoesExcluir(lista, async function (id) {
    await excluirDados('Metas', id);
    const atualizadas = await buscarDados('Metas');
    lista.innerHTML = montarLista(atualizadas);
  });
}