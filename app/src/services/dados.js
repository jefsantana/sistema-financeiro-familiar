import { supabase } from './supabase.js';

// Converte "ContasFixas" / "valorTotal" para "contas_fixas" / "valor_total",
// e vice-versa — usado tanto pro nome da tabela quanto pros campos.
function paraSnake(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function paraCamel(str) {
  return str.replace(/_([a-z0-9])/g, (_, letra) => letra.toUpperCase());
}

function linhaParaCamel(linha) {
  const resultado = {};
  Object.entries(linha).forEach(([chave, valor]) => {
    resultado[paraCamel(chave)] = valor;
  });
  return resultado;
}

function dadosParaSnake(dados) {
  const resultado = {};
  Object.entries(dados).forEach(([chave, valor]) => {
    resultado[paraSnake(chave)] = valor;
  });
  return resultado;
}

function nomeTabela(tabela) {
  return paraSnake(tabela);
}

export async function listar(tabela) {
  const { data, error } = await supabase
    .from(nomeTabela(tabela))
    .select('*')
    .is('excluido_em', null)
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data.map(linhaParaCamel);
}

export async function listarExcluidos(tabela) {
  const { data, error } = await supabase
    .from(nomeTabela(tabela))
    .select('*')
    .not('excluido_em', 'is', null)
    .order('excluido_em', { ascending: false });
  if (error) throw error;
  return data.map(linhaParaCamel);
}

export async function criar(tabela, dados, familiaId) {
  const { data, error } = await supabase
    .from(nomeTabela(tabela))
    .insert({ ...dadosParaSnake(dados), familia_id: familiaId })
    .select()
    .single();
  if (error) throw error;
  return linhaParaCamel(data);
}

export async function atualizar(tabela, id, campos) {
  const { data, error } = await supabase
    .from(nomeTabela(tabela))
    .update(dadosParaSnake(campos))
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return linhaParaCamel(data);
}

export async function excluir(tabela, id, pessoa = '') {
  return atualizar(tabela, id, { excluidoEm: new Date().toISOString(), excluidoPor: pessoa });
}

export async function restaurar(tabela, id) {
  return atualizar(tabela, id, { excluidoEm: null, excluidoPor: null });
}

export async function excluirPermanente(tabela, id) {
  const { error } = await supabase.from(nomeTabela(tabela)).delete().eq('id', id);
  if (error) throw error;
}

const CATEGORIAS_PADRAO = [
  { nome: 'Salário', tipo: 'entrada' },
  { nome: 'Freelance', tipo: 'entrada' },
  { nome: 'Alimentação', tipo: 'gasto' },
  { nome: 'Moradia', tipo: 'gasto' },
  { nome: 'Transporte', tipo: 'gasto' },
  { nome: 'Saúde', tipo: 'gasto' },
  { nome: 'Lazer', tipo: 'gasto' },
  { nome: 'Educação', tipo: 'gasto' },
];

// Apaga TODOS os dados da família (lançamentos e cadastros), de forma
// permanente, e recria as categorias padrão — como se a família
// tivesse acabado de se cadastrar. A ordem respeita as referências
// entre tabelas (pagamentos antes das contas/parcelamentos que apontam).
export async function limparDadosFamilia(familiaId) {
  const tabelasDependentes = ['pagamentos_contas_fixas', 'pagamentos_parcelamentos'];
  const tabelasPrincipais = [
    'entradas',
    'gastos',
    'transferencias',
    'contas_fixas',
    'parcelamentos',
    'cartoes',
    'metas',
    'orcamentos',
    'categorias',
  ];

  for (const tabela of [...tabelasDependentes, ...tabelasPrincipais]) {
    const { error } = await supabase.from(tabela).delete().eq('familia_id', familiaId);
    if (error) throw error;
  }

  const { error: erroCategorias } = await supabase
    .from('categorias')
    .insert(CATEGORIAS_PADRAO.map((categoria) => ({ ...categoria, familia_id: familiaId })));
  if (erroCategorias) throw erroCategorias;
}
