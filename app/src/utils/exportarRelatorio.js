import { formatarMoeda } from './formatadores.js';

const ROXO_MARCA = '7B61FF';
const VERDE_SUCESSO = '10B981';
const VERMELHO_PERIGO = 'EF4444';

const ROTULO_TIPO = { entrada: 'Entrada', gasto: 'Gasto', transferencia: 'Transferência' };

function corDoTipo(tipo) {
  if (tipo === 'entrada') return VERDE_SUCESSO;
  if (tipo === 'gasto') return VERMELHO_PERIGO;
  return '3B82F6';
}

function baixarArquivo(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Gera e baixa uma planilha .xlsx com cabeçalho estilizado (cor da
 * marca), valores em verde/vermelho por tipo, e uma linha de totais
 * no rodapé.
 */
export async function exportarExcel({ titulo, periodo, linhas, totalEntradas, totalGastos, nomeArquivo }) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema Financeiro Familiar';
  workbook.created = new Date();

  const planilha = workbook.addWorksheet('Lançamentos', {
    pageSetup: { orientation: 'landscape', fitToPage: true },
  });

  planilha.columns = [
    { header: 'Data', key: 'data', width: 13 },
    { header: 'Tipo', key: 'tipo', width: 14 },
    { header: 'Descrição', key: 'descricao', width: 32 },
    { header: 'Categoria', key: 'categoria', width: 20 },
    { header: 'Pessoa', key: 'pessoa', width: 20 },
    { header: 'Valor', key: 'valor', width: 16 },
  ];

  planilha.mergeCells('A1:F1');
  const celulaTitulo = planilha.getCell('A1');
  celulaTitulo.value = titulo;
  celulaTitulo.font = { bold: true, size: 16, color: { argb: `FF${ROXO_MARCA}` } };
  celulaTitulo.alignment = { vertical: 'middle' };

  planilha.mergeCells('A2:F2');
  const celulaPeriodo = planilha.getCell('A2');
  celulaPeriodo.value = periodo;
  celulaPeriodo.font = { size: 11, color: { argb: 'FF6B7280' } };

  planilha.addRow([]);

  const linhaCabecalho = planilha.addRow(['Data', 'Tipo', 'Descrição', 'Categoria', 'Pessoa', 'Valor']);
  linhaCabecalho.eachCell((celula) => {
    celula.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ROXO_MARCA}` } };
    celula.alignment = { vertical: 'middle', horizontal: celula.value === 'Valor' ? 'right' : 'left' };
  });

  linhas.forEach((item, indice) => {
    const linha = planilha.addRow([
      item.data,
      ROTULO_TIPO[item.tipo] || item.tipo,
      item.descricao,
      item.categoria || '-',
      item.pessoa || '-',
      Number(item.valor),
    ]);

    const celulaValor = linha.getCell(6);
    celulaValor.numFmt = '"R$" #,##0.00';
    celulaValor.font = { color: { argb: `FF${corDoTipo(item.tipo)}` }, bold: true };
    celulaValor.alignment = { horizontal: 'right' };

    if (indice % 2 === 1) {
      linha.eachCell((celula) => {
        if (!celula.fill) celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F6FA' } };
      });
    }
  });

  planilha.addRow([]);
  const linhaTotalEntradas = planilha.addRow(['', '', '', '', 'Total de Entradas', Number(totalEntradas)]);
  linhaTotalEntradas.getCell(5).font = { bold: true };
  linhaTotalEntradas.getCell(6).font = { bold: true, color: { argb: `FF${VERDE_SUCESSO}` } };
  linhaTotalEntradas.getCell(6).numFmt = '"R$" #,##0.00';
  linhaTotalEntradas.getCell(6).alignment = { horizontal: 'right' };

  const linhaTotalGastos = planilha.addRow(['', '', '', '', 'Total de Gastos', Number(totalGastos)]);
  linhaTotalGastos.getCell(5).font = { bold: true };
  linhaTotalGastos.getCell(6).font = { bold: true, color: { argb: `FF${VERMELHO_PERIGO}` } };
  linhaTotalGastos.getCell(6).numFmt = '"R$" #,##0.00';
  linhaTotalGastos.getCell(6).alignment = { horizontal: 'right' };

  const linhaSaldo = planilha.addRow(['', '', '', '', 'Saldo do Período', Number(totalEntradas) - Number(totalGastos)]);
  linhaSaldo.getCell(5).font = { bold: true };
  linhaSaldo.getCell(6).font = { bold: true, color: { argb: `FF${ROXO_MARCA}` } };
  linhaSaldo.getCell(6).numFmt = '"R$" #,##0.00';
  linhaSaldo.getCell(6).alignment = { horizontal: 'right' };

  planilha.getRow(4).eachCell((celula) => {
    celula.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  baixarArquivo(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    nomeArquivo
  );
}

/**
 * Gera e baixa um PDF com cabeçalho estilizado, tabela com cores por
 * tipo de lançamento e um resumo de totais no rodapé.
 */
export async function exportarPdf({ titulo, periodo, linhas, totalEntradas, totalGastos, nomeArquivo }) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape' });
  const corRoxa = [123, 97, 255];
  const corVerde = [16, 185, 129];
  const corVermelha = [239, 68, 68];
  const corCinza = [107, 114, 128];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...corRoxa);
  doc.text(titulo, 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...corCinza);
  doc.text(periodo, 14, 25);

  autoTable(doc, {
    startY: 32,
    head: [['Data', 'Tipo', 'Descrição', 'Categoria', 'Pessoa', 'Valor']],
    body: linhas.map((item) => [
      item.data,
      ROTULO_TIPO[item.tipo] || item.tipo,
      item.descricao,
      item.categoria || '-',
      item.pessoa || '-',
      formatarMoeda(item.valor),
    ]),
    headStyles: { fillColor: corRoxa, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 250] },
    columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
    styles: { fontSize: 9, cellPadding: 4 },
    didParseCell: (dados) => {
      if (dados.section === 'body' && dados.column.index === 5) {
        const tipo = linhas[dados.row.index]?.tipo;
        dados.cell.styles.textColor = tipo === 'entrada' ? corVerde : tipo === 'gasto' ? corVermelha : [59, 130, 246];
      }
    },
  });

  const posicaoFinal = doc.lastAutoTable.finalY + 10;
  const saldo = Number(totalEntradas) - Number(totalGastos);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...corVerde);
  doc.text(`Total de Entradas: ${formatarMoeda(totalEntradas)}`, 14, posicaoFinal);
  doc.setTextColor(...corVermelha);
  doc.text(`Total de Gastos: ${formatarMoeda(totalGastos)}`, 14, posicaoFinal + 6);
  doc.setTextColor(...corRoxa);
  doc.text(`Saldo do Período: ${formatarMoeda(saldo)}`, 14, posicaoFinal + 12);

  doc.save(nomeArquivo);
}
