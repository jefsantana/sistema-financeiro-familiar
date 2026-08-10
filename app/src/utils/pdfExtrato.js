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
      const x = item.transform[4];
      if (!porLinha.has(y)) porLinha.set(y, []);
      porLinha.get(y).push({ texto: item.str, x, largura: item.width || 0, altura: item.height || 10 });
    });

    // Dentro de cada linha, só insere espaço entre dois fragmentos
    // quando há um vão horizontal real entre eles — muitos PDFs de
    // banco quebram o texto letra por letra, e juntar tudo com um
    // espaço fixo bagunçaria as palavras (ex: "CONSOLIDADO" viraria
    // "CONSOL I DADO").
    [...porLinha.keys()]
      .sort((a, b) => b - a)
      .forEach((y) => {
        const fragmentos = porLinha.get(y).sort((a, b) => a.x - b.x);
        let linha = '';
        let fimAnterior = null;
        fragmentos.forEach((fragmento) => {
          if (fimAnterior !== null) {
            const vao = fragmento.x - fimAnterior;
            if (vao > fragmento.altura * 0.28) linha += ' ';
          }
          linha += fragmento.texto;
          fimAnterior = fragmento.x + fragmento.largura;
        });
        linhas.push(linha);
      });
  }

  return linhas;
}

/**
 * Recebe um File de PDF e devolve { transacoes, linhas }: as
 * transações que conseguiu reconhecer — { id, data, descricao,
 * valor, tipo } — e o texto bruto extraído, linha por linha (usado
 * pra mostrar na tela quando nada é reconhecido, pra dar pra ver o
 * que deu errado sem precisar do PDF original). Best-effort —
 * layouts fora do padrão podem não ser reconhecidos.
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

  return { transacoes, linhas };
}
