import { buscarDados, salvarDados } from '../services/api.js';

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
        <input type="number" id="valorAlvo" name="valorAlvo" step="0.01" min="0" required>
      </div>
      <div class="campo">
        <label for="valorAtual">Valor já guardado (R$)</label>
        <input type="number" id="valorAtual" name="valorAtual" step="0.01" min="0" required>
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
        <p class="card__label">${m.descricao}</p>
        <p>R$ ${Number(m.valorAtual).toFixed(2)} de R$ ${Number(m.valorAlvo).toFixed(2)} (${percentual}%)</p>
        <div class="barra-progresso"><div class="barra-progresso__preenchida" style="width:${percentual}%"></div></div>
      </div>
    `;
  }).join('');
}

export function iniciarEventosMetas() {
  const form = document.getElementById('formMeta');
  if (!form) return;

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const fd = new FormData(form);
    const nova = {
      descricao: fd.get('descricao'),
      valorAlvo: Number(fd.get('valorAlvo')),
      valorAtual: Number(fd.get('valorAtual'))
    };

    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    await salvarDados('Metas', nova);
    form.reset();

    const atualizadas = await buscarDados('Metas');
    document.getElementById('listaMetas').innerHTML = montarLista(atualizadas);

    botao.disabled = false;
    botao.textContent = 'Salvar Meta';
  });
}