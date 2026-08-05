// ==========================================
// SERVICES: API
// Ponto único de comunicação entre o site
// e nossa API no Google Apps Script.
// ==========================================

// Cole aqui a URL da sua implantação do Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycby8H6Og5RfQC_yM5t1gptAvms96IQj5vQH-nuGlRsUqfh3ElZZVognIBCTqB1A8Gc-R/exec';

/**
 * Busca todos os registros de uma aba da planilha
 * @param {string} nomeAba - nome da aba (ex: "Entradas")
 * @returns {Promise<Array>} lista de objetos com os dados
 */
export async function buscarDados(nomeAba) {
  try {
    const resposta = await fetch(`${API_URL}?action=list&sheet=${nomeAba}`);
    const dados = await resposta.json();
    return dados;
  } catch (erro) {
    console.error('Erro ao buscar dados:', erro);
    return [];
  }
}

/**
 * Envia um novo registro para ser adicionado numa aba
 * @param {string} nomeAba - nome da aba (ex: "Entradas")
 * @param {object} dados - objeto com os dados do novo registro
 * @returns {Promise<object>} o registro criado (com o id gerado)
 */
export async function salvarDados(nomeAba, dados) {
  try {
    const resposta = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        sheet: nomeAba,
        dados: dados
      })
    });
    const resultado = await resposta.json();
    return resultado;
  } catch (erro) {
    console.error('Erro ao salvar dados:', erro);
    return null;
  }
}

/**
 * Exclui um registro de uma aba, pelo ID
 * @param {string} nomeAba
 * @param {string} id
 */
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