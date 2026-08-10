// Leitura "melhor esforço" de extrato bancário em PDF. Diferente do
// OFX, o PDF não tem estrutura — é só texto solto na posição da
// página — então aqui usamos heurística (uma expressão regular numa
// linha reconstruída pela posição vertical do texto) pra tentar
// reconhecer o padrão "data + descrição + valor". Funciona bem pra
// extratos com layout simples em tabela; pode falhar ou vir com
// erros em layouts mais elaborados — por isso a tela sempre pede
// conferência linha a linha antes de importar.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseValorMonetario } from './formatadores.js';

const REGEX_LINHA = /(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+(-?R?\$?\s?[\d.,]+)\s*([CD])?\s*$/;

function normalizarDataBr(dataBruta) {
  const partes = dataBruta.split('/');
  if (partes.length < 2) return '';
  let [dia, mes, ano] = partes;
  if (!ano) ano = String(new Date().getFullYear());
  if (ano.length === 2) ano = `20${ano}`;
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

async function extrairLinhas(arquivo) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const buffer = await arquivo.arrayBuffer();
  const documento = await pdfjsLib.getDocument({ data: buffer }).promise;
  const linhas = [];

  for (let numeroPagina = 1; numeroPagina <= documento.numPages; numeroPagina++) {
    const pagina = await documento.getPage(numeroPagina);
    const conteudo = await pagina.getTextContent();

    // Agrupa os fragmentos de texto pela posição vertical (Y) pra
    // reconstruir cada linha da tabela do extrato.
    const porLinha = new Map();
    conteudo.items.forEach((item) => {
      const y = Math.round(item.transform[5]);
      if (!porLinha.has(y)) porLinha.set(y, []);
      porLinha.get(y).push(item.str);
    });

    [...porLinha.keys()].sort((a, b) => b - a).forEach((y) => linhas.push(porLinha.get(y).join(' ')));
  }

  return linhas;
}

/**
 * Recebe um File de PDF e devolve a lista de transações que
 * conseguiu reconhecer: { id, data, descricao, valor, tipo }.
 * Best-effort — layouts fora do padrão podem não ser reconhecidos.
 */
export async function analisarPdf(arquivo) {
  const linhas = await extrairLinhas(arquivo);
  const transacoes = [];

  linhas.forEach((linha, indice) => {
    const encontrado = linha.trim().match(REGEX_LINHA);
    if (!encontrado) return;

    const [, dataBruta, descricaoBruta, valorBruto, marcador] = encontrado;
    const data = normalizarDataBr(dataBruta);
    const valorNumerico = parseValorMonetario(valorBruto);
    if (!data || !valorNumerico) return;

    const negativo = valorNumerico < 0 || marcador === 'D';
    transacoes.push({
      id: `pdf-${indice}-${data}-${valorBruto}`,
      data,
      descricao: descricaoBruta.trim(),
      valor: Math.abs(valorNumerico),
      tipo: negativo ? 'gasto' : 'entrada',
    });
  });

  return transacoes;
}
