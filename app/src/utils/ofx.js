// Leitor de extrato bancário no formato OFX (padrão usado por
// praticamente todos os bancos brasileiros na opção "Exportar
// extrato"). O OFX antigo não fecha as tags (formato "SGML"), então
// em vez de usar um parser de XML, procuramos os blocos de transação
// manualmente — funciona tanto no formato antigo quanto no novo
// (XML), já que os dois usam as mesmas tags.

function extrairCampo(bloco, tag) {
  const regex = new RegExp(`<${tag}>([^<\r\n]*)`, 'i');
  const encontrado = bloco.match(regex);
  return encontrado ? encontrado[1].trim() : '';
}

function paraDataIso(dataOfx) {
  // Formato OFX: AAAAMMDD[HHMMSS[.mmm]][fuso horário] — só nos
  // interessam os 8 primeiros dígitos (ano, mês, dia).
  if (!/^\d{8}/.test(dataOfx)) return '';
  return `${dataOfx.slice(0, 4)}-${dataOfx.slice(4, 6)}-${dataOfx.slice(6, 8)}`;
}

/**
 * Recebe o texto bruto de um arquivo .ofx e devolve a lista de
 * transações encontradas: { id, data, descricao, valor, tipo }.
 * `tipo` é "entrada" ou "gasto", decidido pelo sinal do valor.
 */
export function analisarOfx(textoArquivo) {
  const conteudo = textoArquivo.replace(/\r\n/g, '\n');
  const blocos = conteudo.split(/<STMTTRN>/i).slice(1).map((bloco) => bloco.split(/<\/STMTTRN>/i)[0]);

  return blocos
    .map((bloco, indice) => {
      const dataIso = paraDataIso(extrairCampo(bloco, 'DTPOSTED'));
      const valorBruto = extrairCampo(bloco, 'TRNAMT').replace(',', '.');
      const valorNumerico = parseFloat(valorBruto);
      const descricao = extrairCampo(bloco, 'MEMO') || extrairCampo(bloco, 'NAME') || 'Sem descrição';
      const fitid = extrairCampo(bloco, 'FITID');

      return {
        id: fitid || `ofx-${indice}-${dataIso}-${valorBruto}`,
        data: dataIso,
        descricao,
        valor: Math.abs(valorNumerico),
        tipo: valorNumerico < 0 ? 'gasto' : 'entrada',
      };
    })
    .filter((transacao) => transacao.data && !isNaN(transacao.valor) && transacao.valor > 0);
}
