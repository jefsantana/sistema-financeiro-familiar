// ==========================================
// MÓDULO: ENTRADAS
// Formulário de cadastro + lista de entradas,
// conectado de verdade com a planilha via API.
// ==========================================

import { buscarDados, salvarDados } from '../services/api.js';

export async function renderEntradas() {
  // Busca as entradas já cadastradas na planilha
  const entradas = await buscarDados('Entradas');

  // Monta o HTML da tela inteira
  const html = `
    <h3>💵 Nova Entrada</h3>

    <form id="formEntrada" class="formulario">
      <div class="campo">
        <label for="descricao">Descrição</label>
        <input type="text" id="descricao" name="descricao" required placeholder="Ex: Salário">
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
        <input type="text" id="categoria" name="categoria" required placeholder="Ex: Trabalho">
      </div>

      <button type="submit" class="botao botao--primario">Salvar Entrada</button>
    </form>

    <h3 class="titulo-lista">📋 Entradas cadastradas</h3>

    <div id="listaEntradas">
      ${montarTabela(entradas)}
    </div>
  `;

  // Depois de montar o HTML, vamos "religar" o formulário
  // (isso precisa acontecer DEPOIS que o HTML estiver na tela,
  // por isso fazemos isso fora dessa função, no main.js)
  // Guardamos essa função junto no retorno, veremos no Passo 3

  return html;
}

/**
 * Monta a tabela HTML a partir da lista de entradas
 */
function montarTabela(entradas) {
  if (entradas.length === 0) {
    return '<p class="texto-vazio">Nenhuma entrada cadastrada ainda.</p>';
  }

  const linhas = entradas.map(function (entrada) {
    return `
      <tr>
        <td>${entrada.descricao}</td>
        <td>${entrada.categoria}</td>
        <td>${formatarData(entrada.data)}</td>
        <td class="valor-positivo">R$ ${Number(entrada.valor).toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
    <table class="tabela">
      <thead>
        <tr>
          <th>Descrição</th>
          <th>Categoria</th>
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

/**
 * Formata uma data (que vem da planilha em formato ISO)
 * para o formato brasileiro dd/mm/aaaa
 */
function formatarData(dataISO) {
  const data = new Date(dataISO);
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/**
 * Configura o "escutador" do formulário.
 * Precisa ser chamada DEPOIS que o HTML já estiver
 * inserido na página (por isso é exportada separadamente).
 */
export function iniciarEventosEntradas() {
  const form = document.getElementById('formEntrada');

  if (!form) return;

  form.addEventListener('submit', async function (evento) {
    // Impede o comportamento padrão (recarregar a página)
    evento.preventDefault();

    // Lê automaticamente todos os campos preenchidos
    const dadosFormulario = new FormData(form);

    const novaEntrada = {
      descricao: dadosFormulario.get('descricao'),
      valor: Number(dadosFormulario.get('valor')),
      data: dadosFormulario.get('data'),
      categoria: dadosFormulario.get('categoria')
    };

    // Desabilita o botão enquanto salva (evita cliques duplicados)
    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    // Envia para a API
    await salvarDados('Entradas', novaEntrada);

    // Limpa o formulário
    form.reset();

    // Recarrega a lista de entradas, sem sair da tela
    const entradasAtualizadas = await buscarDados('Entradas');
    document.getElementById('listaEntradas').innerHTML = montarTabela(entradasAtualizadas);

    // Reabilita o botão
    botao.disabled = false;
    botao.textContent = 'Salvar Entrada';
  });
}