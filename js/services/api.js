// ==========================================
// SERVICES: API
// Ponto único de comunicação entre o site
// e nossa API no Google Apps Script.
// ==========================================

const API_URL = 'https://script.google.com/macros/s/AKfycby8H6Og5RfQC_yM5t1gptAvms96IQj5vQH-nuGlRsUqfh3ElZZVognIBCTqB1A8Gc-R/exec';

/**
 * Busca todos os registros de uma aba.
 * Usa "cache: no-store" + um parâmetro aleatório na URL
 * para IMPEDIR que o navegador ou o Google sirvam uma
 * resposta antiga em cache — importante logo após salvar
 * ou excluir algo.
 */
export async function buscarDados(nomeAba) {
  try {
    const resposta = await fetch(
      `${API_URL}?action=list&sheet=${nomeAba}&_=${Date.now()}`,
      { cache: 'no-store' }
    );
    const dados = await resposta.json();
    return dados;
  } catch (erro) {
    console.error('Erro ao buscar dados:', erro);
    return [];
  }
}

export async function salvarDados(nomeAba, dados) {
  try {
    const resposta = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ sheet: nomeAba, dados: dados })
    });
    const resultado = await resposta.json();
    return resultado;
  } catch (erro) {
    console.error('Erro ao salvar dados:', erro);
    return null;
  }
}

export async function excluirDados(nomeAba, id) {
  try {
    const resposta = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', sheet: nomeAba, id: id })
    });
    const resultado = await resposta.json();
    return resultado;
  } catch (erro) {
    console.error('Erro ao excluir dados:', erro);
    return null;
  }
}