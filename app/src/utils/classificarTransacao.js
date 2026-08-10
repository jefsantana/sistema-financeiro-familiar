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

// Palavras-chave associadas a cada categoria fixa do sistema, na
// ordem em que devem ser testadas (a primeira que bater vence) —
// usadas pra sugerir a categoria de cada lançamento importado, sem
// obrigar a pessoa a escolher uma por uma quando o nome já entrega o
// que é.
const PALAVRAS_POR_CATEGORIA_GASTO = [
  ['Alimentação', ['mercado', 'supermercado', 'restaurante', 'lanchonete', 'ifood', 'padaria', 'acougue', 'açougue', 'hortifruti', 'pizzaria', 'churrascaria']],
  ['Transporte', ['uber', '99app', '99 ', 'taxi', 'táxi', 'combustivel', 'combustível', 'posto ', 'estacionamento', 'pedagio', 'pedágio', 'onibus', 'ônibus', 'metro', 'metrô']],
  ['Saúde', ['farmacia', 'farmácia', 'drogaria', 'hospital', 'clinica', 'clínica', 'consulta', 'plano de saude', 'plano de saúde', 'laboratorio', 'laboratório']],
  ['Moradia', ['aluguel', 'condominio', 'condomínio', 'financiamento imovel', 'financiamento imóvel', 'imobiliaria', 'imobiliária']],
  ['Contas da Casa', ['energia', 'luz ', 'sabesp', 'cemig', 'copel', 'enel', 'gas ', 'internet', 'telefone', 'claro', 'vivo', 'tim ', ' oi ']],
  ['Assinaturas', ['netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'youtube premium', 'assinatura']],
  ['Cartão de Crédito', ['fatura cartao', 'fatura cartão', 'pagamento fatura']],
  ['Compras', ['magazine', 'americanas', 'shopee', 'aliexpress', 'mercado livre', 'shein']],
  ['Cuidados Pessoais', ['salao', 'salão', 'barbearia', 'cabeleireiro', 'estetica', 'estética']],
  ['Educação', ['escola', 'faculdade', 'curso ', 'mensalidade escolar', 'udemy']],
  ['Impostos e Taxas', ['imposto', 'ipva', 'iptu', 'darf', 'irpf']],
  ['Investimentos', ['aplicacao', 'aplicação', 'cdb', 'tesouro direto', 'corretora']],
  ['Lazer', ['cinema', 'ingresso', 'show ', 'parque']],
  ['Manutenção', ['oficina', 'conserto', 'manutencao', 'manutenção']],
  ['Pets', ['petshop', 'veterinario', 'veterinário', 'racao', 'ração']],
  ['Presentes', ['presente']],
  ['Tarifas Bancárias', ['tarifa', 'manutencao de conta', 'manutenção de conta', 'anuidade']],
  ['Viagens', ['hotel', 'passagem aerea', 'passagem aérea', 'cia aerea', 'companhia aerea', 'booking', 'airbnb']],
];

const PALAVRAS_POR_CATEGORIA_ENTRADA = [
  ['Salário', ['salario', 'salário', 'folha de pagamento']],
  ['Aluguel Recebido', ['aluguel recebido']],
  ['Benefícios', ['vale ', 'beneficio', 'benefício', 'auxilio', 'auxílio']],
  ['Estorno', ['estorno']],
  ['Freelance', ['freelance', 'freela ']],
  ['Presentes Recebidos', ['presente recebido']],
  ['Reembolso', ['reembolso']],
  ['Renda Extra', ['renda extra']],
  ['Rendimentos de Investimentos', ['rendimento', 'dividendo']],
  ['Venda de Produtos/Bens', ['venda de', 'venda ']],
];

/**
 * Tenta adivinhar a categoria de um lançamento a partir de palavras
 * comuns na descrição. `tipo` decide se procura na lista de
 * categorias de gasto ou de entrada. Devolve null quando não
 * reconhece nada — nesse caso a pessoa escolhe manualmente.
 */
export function inferirCategoriaPorDescricao(descricao, tipo) {
  const texto = (descricao || '').toLowerCase();
  const tabela = tipo === 'entrada' ? PALAVRAS_POR_CATEGORIA_ENTRADA : PALAVRAS_POR_CATEGORIA_GASTO;
  const encontrada = tabela.find(([, palavras]) => palavras.some((palavra) => texto.includes(palavra)));
  return encontrada ? encontrada[0] : null;
}
