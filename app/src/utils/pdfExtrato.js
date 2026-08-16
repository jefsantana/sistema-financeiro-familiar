// Leitura "melhor esforço" de extrato bancário em PDF. O PDF não tem
// estrutura — é só texto solto na posição da página — então aqui
// usamos heurística (uma expressão regular numa linha reconstruída
// pela posição vertical do texto) pra tentar reconhecer o padrão
// "data + descrição + valor". Funciona bem pra extratos com layout
// simples em tabela; pode falhar ou vir com erros em layouts mais
// elaborados — por isso a tela sempre pede conferência linha a linha
// antes de importar.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseValorMonetario } from './formatadores.js';
import { inferirTipoPorDescricao } from './classificarTransacao.js';

const REGEX_LINHA = /(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+(-?R?\$?\s?[\d.,]+)\s*([CD])?\s*$/;

// Alguns bancos (ex: Nubank) não repetem a data em cada linha de
// lançamento — em vez disso, agrupam os lançamentos do dia embaixo
// de um cabeçalho tipo "02 AGO 2026", e cada linha abaixo dele traz
// só a descrição e o valor. Essas expressões cobrem esse formato:
// uma reconhece o cabeçalho do dia, a outra reconhece a linha de
// lançamento sem data (usada junto da última data vista), e a
// terceira identifica linhas de resumo ("Total de entradas/saídas",
// "Saldo ...") pra não importar como se fossem lançamentos.
const REGEX_CABECALHO_DIA = /^(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\.?\s+(?:DE\s+)?(\d{4})\b/i;
const REGEX_LINHA_SEM_DATA = /^(.+?)\s+(-?R?\$?\s?[\d.,]+)\s*([CD])?\s*$/;
const REGEX_LINHA_RESUMO = /^(total|saldo)\b/i;

const MESES_ABREVIADOS = {
  JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06',
  JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12',
};

function normalizarDataBr(dataBruta) {
  const partes = dataBruta.split('/');
  if (partes.length < 2) return '';
  let [dia, mes, ano] = partes;
  if (!ano) ano = String(new Date().getFullYear());
  if (ano.length === 2) ano = `20${ano}`;
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

function normalizarDataCabecalho(dia, mesAbreviado, ano) {
  const mes = MESES_ABREVIADOS[mesAbreviado.toUpperCase()];
  if (!mes) return '';
  return `${ano}-${mes}-${dia.padStart(2, '0')}`;
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
 * valor, tipo, tipoIncerto } — e o texto bruto extraído, linha por
 * linha (usado pra mostrar na tela quando nada é reconhecido, pra
 * dar pra ver o que deu errado sem precisar do PDF original).
 * `tipoIncerto` vem true quando o tipo (entrada/gasto) foi um chute
 * sem nenhuma pista confiável — vale a pena a tela destacar essas
 * linhas pra conferência. Best-effort — layouts fora do padrão podem
 * não ser reconhecidos.
 */
export async function analisarPdf(arquivo) {
  const linhas = await extrairLinhas(arquivo);
  const transacoes = [];
  let dataDoGrupoAtual = '';

  linhas.forEach((linha, indice) => {
    const linhaTrim = linha.trim();

    const cabecalhoDia = linhaTrim.match(REGEX_CABECALHO_DIA);
    if (cabecalhoDia) {
      const [, dia, mesAbreviado, ano] = cabecalhoDia;
      dataDoGrupoAtual = normalizarDataCabecalho(dia, mesAbreviado, ano);
      return;
    }

    if (REGEX_LINHA_RESUMO.test(linhaTrim)) return;

    const comDataPropria = linhaTrim.match(REGEX_LINHA);
    const encontrado = comDataPropria || (dataDoGrupoAtual && linhaTrim.match(REGEX_LINHA_SEM_DATA));
    if (!encontrado) return;

    const descricaoBruta = comDataPropria ? encontrado[2] : encontrado[1];
    const valorBruto = comDataPropria ? encontrado[3] : encontrado[2];
    const marcador = comDataPropria ? encontrado[4] : encontrado[3];
    const data = comDataPropria ? normalizarDataBr(encontrado[1]) : dataDoGrupoAtual;
    const valorNumerico = parseValorMonetario(valorBruto);
    if (!data || !valorNumerico) return;

    const descricao = descricaoBruta.trim();

    // Decide o tipo em camadas, da pista mais confiável pra menos
    // confiável: sinal do valor (quando o extrato já vem com "-") ou
    // marcador D/C explícito primeiro; sem isso, tenta reconhecer
    // pela descrição; e só em último caso usa um padrão, sinalizando
    // a linha como incerta pra pedir atenção extra na conferência.
    let tipo;
    let tipoIncerto = false;
    if (valorNumerico < 0 || marcador === 'D') {
      tipo = 'gasto';
    } else if (marcador === 'C') {
      tipo = 'entrada';
    } else {
      const porPalavra = inferirTipoPorDescricao(descricao);
      if (porPalavra) {
        tipo = porPalavra;
      } else {
        tipo = 'gasto';
        tipoIncerto = true;
      }
    }

    transacoes.push({
      id: `pdf-${indice}-${data}-${valorBruto}`,
      data,
      descricao,
      valor: Math.abs(valorNumerico),
      tipo,
      tipoIncerto,
    });
  });

  return { transacoes, linhas };
}
