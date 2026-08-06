// ==========================================
// SERVICES: API
// ==========================================

const API_URL = 'https://script.google.com/macros/s/AKfycby8H6Og5RfQC_yM5t1gptAvms96IQj5vQH-nuGlRsUqfh3ElZZVognIBCTqB1A8Gc-R/exec';

export async function buscarDados(nomeAba) {
  try {
    const resposta = await fetch(
      `${API_URL}?action=list&sheet=${nomeAba}&_=${Date.now()}`,
      { cache: 'no-store' }
    );
    return await resposta.json();
  } catch (erro) {
    console.error('Erro ao buscar dados:', erro);
    return [];
  }
}

/**
 * Busca tudo que o Dashboard precisa numa única chamada,
 * em vez de 4 chamadas separadas — bem mais rápido.
 */
export async function buscarDadosDashboard() {
  try {
    const resposta = await fetch(
      `${API_URL}?action=dashboard&_=${Date.now()}`,
      { cache: 'no-store' }
    );
    return await resposta.json();
  } catch (erro) {
    console.error('Erro ao buscar dados do dashboard:', erro);
    return { entradas: [], gastos: [], contasFixas: [], pagamentos: [] };
  }
}

export async function salvarDados(nomeAba, dados) {
  try {
    const resposta = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ sheet: nomeAba, dados: dados })
    });
    return await resposta.json();
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
    return await resposta.json();
  } catch (erro) {
    console.error('Erro ao excluir dados:', erro);
    return null;
  }
}