const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DateTime } = require('luxon');

// ===== Réplicas exatas da lógica do index.js (testadas isoladamente,
// sem precisar de rede, WhatsApp ou banco real) =====

function formatarReais(valor) {
  return Number(valor).toFixed(2).replace('.', ',');
}

function formatarDataBR(dataISO) {
  return dataISO.split('-').reverse().join('/');
}

function tabelaDoTipo(tipo) {
  switch (tipo) {
    case 'entrada':
      return 'entradas';
    case 'gasto':
      return 'gastos';
    case 'conta_fixa':
      return 'contas_fixas';
    case 'compra_cartao':
      return 'compras_cartao';
    case 'parcelamento':
      return 'parcelamentos';
    case 'meta':
      return 'metas';
    case 'orcamento':
      return 'orcamentos';
    case 'gasto_alimentacao':
    case 'recarga_alimentacao':
      return 'movimentos_cartao_alimentacao';
    default:
      return null;
  }
}

const CAMPOS_CORRIGIVEIS = [
  'descricao', 'valor', 'categoria', 'pessoa', 'dia_vencimento',
  'cartao', 'numero_parcelas', 'valor_total', 'valor_alvo', 'limite_mensal',
];
function campoDaCorrecao(dados) {
  return CAMPOS_CORRIGIVEIS.find((c) => dados[c] !== undefined && dados[c] !== null);
}

function calcularMesFatura(hoje, diaFechamento) {
  if (!diaFechamento) return hoje.toFormat('yyyy-MM');
  return hoje.day > diaFechamento ? hoje.plus({ months: 1 }).toFormat('yyyy-MM') : hoje.toFormat('yyyy-MM');
}

function calcularDiaVencimentoClampado(hoje, diaVencimento, deltaMes) {
  const inicioMes = hoje.plus({ months: deltaMes }).startOf('month');
  const ultimoDia = inicioMes.endOf('month').day;
  const dia = Math.min(diaVencimento, ultimoDia);
  return inicioMes.set({ day: dia });
}

function ajusteSaldoAlimentacao(tipoMovimentoAntigo, valorAntigo, valorNovo) {
  const delta = Number(valorNovo) - Number(valorAntigo);
  return tipoMovimentoAntigo === 'gasto' ? -delta : delta;
}

function barraPorcentagem(percentual, tamanho = 10) {
  const preenchido = Math.round((percentual / 100) * tamanho);
  return '█'.repeat(preenchido) + '░'.repeat(tamanho - preenchido);
}

const PRECOS_IA = {
  Gemini: { entrada: 0.10, saida: 0.40 },
  Anthropic: { entrada: 1.0, saida: 5.0, entradaCache: 0.1 },
};
function calcularCustoIA(provedor, tokensEntrada, tokensSaida, tokensCache = 0) {
  const precos = PRECOS_IA[provedor];
  if (!precos) return 0;
  const entradaNormal = Math.max(tokensEntrada - tokensCache, 0);
  return (
    (entradaNormal / 1_000_000) * precos.entrada +
    (tokensCache / 1_000_000) * (precos.entradaCache ?? precos.entrada) +
    (tokensSaida / 1_000_000) * precos.saida
  );
}

// ===== Testes =====

test('formatarReais formata no padrão brasileiro', () => {
  assert.equal(formatarReais(50), '50,00');
  assert.equal(formatarReais(1234.5), '1234,50');
  assert.equal(formatarReais('99.9'), '99,90');
});

test('formatarDataBR converte ISO para DD/MM/YYYY', () => {
  assert.equal(formatarDataBR('2026-09-12'), '12/09/2026');
});

test('tabelaDoTipo mapeia todos os 9 tipos que gravam algo', () => {
  assert.equal(tabelaDoTipo('gasto'), 'gastos');
  assert.equal(tabelaDoTipo('entrada'), 'entradas');
  assert.equal(tabelaDoTipo('conta_fixa'), 'contas_fixas');
  assert.equal(tabelaDoTipo('compra_cartao'), 'compras_cartao');
  assert.equal(tabelaDoTipo('parcelamento'), 'parcelamentos');
  assert.equal(tabelaDoTipo('meta'), 'metas');
  assert.equal(tabelaDoTipo('orcamento'), 'orcamentos');
  assert.equal(tabelaDoTipo('gasto_alimentacao'), 'movimentos_cartao_alimentacao');
  assert.equal(tabelaDoTipo('recarga_alimentacao'), 'movimentos_cartao_alimentacao');
  assert.equal(tabelaDoTipo('consulta_saldo'), null);
  assert.equal(tabelaDoTipo('correcao'), null);
});

test('campoDaCorrecao identifica o único campo preenchido', () => {
  assert.equal(campoDaCorrecao({ valor: 45 }), 'valor');
  assert.equal(campoDaCorrecao({ categoria: 'Saúde' }), 'categoria');
  assert.equal(campoDaCorrecao({ cartao: 'Inter' }), 'cartao');
  assert.equal(campoDaCorrecao({}), undefined);
});

test('campoDaCorrecao pega o primeiro da lista se vier mais de um por engano', () => {
  // comportamento documentado: se a IA errar e mandar dois campos, usa o primeiro da ordem definida
  assert.equal(campoDaCorrecao({ categoria: 'Saúde', valor: 45 }), 'valor');
});

test('calcularMesFatura: compra antes do fechamento cai na fatura do mês atual', () => {
  const hoje = DateTime.fromISO('2026-09-10'); // dia 10
  assert.equal(calcularMesFatura(hoje, 15), '2026-09');
});

test('calcularMesFatura: compra depois do fechamento cai na fatura do mês seguinte', () => {
  const hoje = DateTime.fromISO('2026-09-20'); // dia 20
  assert.equal(calcularMesFatura(hoje, 15), '2026-10');
});

test('calcularMesFatura: sem dia de fechamento cadastrado, usa o mês atual', () => {
  const hoje = DateTime.fromISO('2026-09-20');
  assert.equal(calcularMesFatura(hoje, null), '2026-09');
});

test('calcularDiaVencimentoClampado: dia normal dentro do mês', () => {
  const hoje = DateTime.fromISO('2026-09-01');
  const venc = calcularDiaVencimentoClampado(hoje, 15, 0);
  assert.equal(venc.toFormat('yyyy-MM-dd'), '2026-09-15');
});

test('calcularDiaVencimentoClampado: dia 31 num mês de 30 dias vira o último dia (30)', () => {
  const hoje = DateTime.fromISO('2026-09-01'); // setembro tem 30 dias
  const venc = calcularDiaVencimentoClampado(hoje, 31, 0);
  assert.equal(venc.toFormat('yyyy-MM-dd'), '2026-09-30');
});

test('calcularDiaVencimentoClampado: dia 31 em fevereiro (não bissexto) vira 28', () => {
  const hoje = DateTime.fromISO('2026-01-01');
  const venc = calcularDiaVencimentoClampado(hoje, 31, 1); // +1 mês = fevereiro/2026
  assert.equal(venc.toFormat('yyyy-MM-dd'), '2026-02-28');
});

test('ajusteSaldoAlimentacao: corrigir um GASTO pra cima desconta mais do saldo', () => {
  // gasto de 30 corrigido pra 50: delta=+20, mas é gasto, então desconta mais 20 do saldo
  assert.equal(ajusteSaldoAlimentacao('gasto', 30, 50), -20);
});

test('ajusteSaldoAlimentacao: corrigir um GASTO pra baixo devolve saldo', () => {
  // gasto de 50 corrigido pra 30: delta=-20, é gasto, devolve 20 pro saldo
  assert.equal(ajusteSaldoAlimentacao('gasto', 50, 30), 20);
});

test('ajusteSaldoAlimentacao: corrigir uma RECARGA pra cima soma mais ao saldo', () => {
  assert.equal(ajusteSaldoAlimentacao('recarga', 500, 600), 100);
});

test('barraPorcentagem: 0% fica toda vazia', () => {
  assert.equal(barraPorcentagem(0), '░░░░░░░░░░');
});

test('barraPorcentagem: 100% fica toda cheia', () => {
  assert.equal(barraPorcentagem(100), '██████████');
});

test('barraPorcentagem: 50% fica metade', () => {
  assert.equal(barraPorcentagem(50), '█████░░░░░');
});

test('barraPorcentagem: 62% arredonda pra 6 blocos cheios', () => {
  assert.equal(barraPorcentagem(62), '██████░░░░');
});

test('calcularCustoIA: Gemini sem cache', () => {
  // 1000 tokens entrada + 500 saída no Gemini (0.10/0.40 por milhão)
  const custo = calcularCustoIA('Gemini', 1000, 500);
  assert.ok(Math.abs(custo - (1000 / 1e6 * 0.10 + 500 / 1e6 * 0.40)) < 1e-9);
});

test('calcularCustoIA: Anthropic com cache lido fica bem mais barato', () => {
  const semCache = calcularCustoIA('Anthropic', 1000, 200, 0);
  const comCache = calcularCustoIA('Anthropic', 1000, 200, 900); // 900 dos 1000 vieram do cache
  assert.ok(comCache < semCache, 'custo com cache deveria ser menor');
});

test('calcularCustoIA: provedor desconhecido não quebra, retorna 0', () => {
  assert.equal(calcularCustoIA('Inexistente', 1000, 500), 0);
});
