// Palavras comuns em descrições de extrato bancário brasileiro,
// usadas pra adivinhar se uma transação é entrada ou gasto quando o
// arquivo não informa isso diretamente — é o caso típico de PDF, que
// (ao contrário do OFX) não tem um campo estruturado de débito/crédito.
const PALAVRAS_GASTO = [
  'compra',
  'pagamento',
  'pgto',
  'debito',
  'débito',
  'saque',
  'tarifa',
  'boleto',
  'fatura',
  'mensalidade',
  'assinatura',
  'enviad',
  'anuidade',
  'juros',
  'iof',
  'multa',
];

const PALAVRAS_ENTRADA = [
  'recebid',
  'deposito',
  'depósito',
  'credito',
  'crédito',
  'salario',
  'salário',
  'estorno',
  'rendimento',
  'resgate',
  'reembolso',
  'devolucao',
  'devolução',
];

/**
 * Tenta adivinhar se uma transação é entrada ou gasto a partir de
 * palavras comuns na descrição. Devolve null quando não reconhece
 * nada — nesse caso quem chamou decide um padrão e sinaliza a linha
 * pra conferência manual.
 */
export function inferirTipoPorDescricao(descricao) {
  const texto = (descricao || '').toLowerCase();
  if (PALAVRAS_GASTO.some((palavra) => texto.includes(palavra))) return 'gasto';
  if (PALAVRAS_ENTRADA.some((palavra) => texto.includes(palavra))) return 'entrada';
  return null;
}
