function escaparCampoCsv(valor) {
  const texto = String(valor ?? '');
  if (texto.includes(';') || texto.includes('"') || texto.includes('\n')) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/**
 * Gera e baixa um arquivo CSV no navegador. Usa ponto-e-vírgula como
 * separador (padrão do Excel em português) e um BOM UTF-8 no início
 * do arquivo, pra acentos abrirem certo sem configuração extra.
 */
export function exportarCsv(nomeArquivo, colunas, linhas) {
  const cabecalho = colunas.map((coluna) => escaparCampoCsv(coluna.rotulo)).join(';');
  const corpo = linhas
    .map((linha) => colunas.map((coluna) => escaparCampoCsv(linha[coluna.chave])).join(';'))
    .join('\n');
  const conteudo = `${cabecalho}\n${corpo}`;

  const blob = new Blob([`﻿${conteudo}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}
