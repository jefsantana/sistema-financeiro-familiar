// ==========================================
// SERVICES: API
// ==========================================

const API_URL = 'https://script.google.com/macros/s/AKfycbx0g1k3r5J6Z7z8X9Y0Z1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7/exec';

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