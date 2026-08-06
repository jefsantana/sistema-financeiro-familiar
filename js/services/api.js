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

export async function buscarDadosDashboard() {
  try {
    const resposta = await fetch(
      `${API_URL}?action=dashboard&_=${Date.now()}`,
      { cache: 'no-store' }
    );
    return await resposta.json();
  } catch (erro) {
    console.error('Erro ao buscar dados do dashboard:', erro);
    return { entradas: [], gastos: [], contasFixas: [], pagamentos: [], parcelamentos: [], pagamentosParcelamentos: [] };
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

/**
 * Atualiza campos específicos de um registro já existente
 * (ex: avançar a parcela atual de um Parcelamento).
 */
export async function atualizarDados(nomeAba, id, campos) {
  try {
    const resposta = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'update', sheet: nomeAba, id: id, campos: campos })
    });
    return await resposta.json();
  } catch (erro) {
    console.error('Erro ao atualizar dados:', erro);
    return null;
  }
}