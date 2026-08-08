const PREFIXO = 'sffm:v1:';

function gerarId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function chave(tabela) {
  return `${PREFIXO}${tabela}`;
}

function lerBruto(tabela) {
  try {
    const salvo = localStorage.getItem(chave(tabela));
    return salvo ? JSON.parse(salvo) : null;
  } catch {
    return null;
  }
}

function gravarBruto(tabela, registros) {
  try {
    localStorage.setItem(chave(tabela), JSON.stringify(registros));
  } catch {
    // localStorage indisponível — os dados seguem só em memória nesta sessão
  }
}

function dataOffset(diasAtras) {
  const data = new Date();
  data.setDate(data.getDate() - diasAtras);
  return data.toISOString().slice(0, 10);
}

function mesOffset(mesesAtras, dia) {
  const data = new Date();
  data.setDate(1);
  data.setMonth(data.getMonth() - mesesAtras);
  data.setDate(Math.min(dia, 28));
  return data.toISOString().slice(0, 10);
}

const SEEDS = {
  Categorias: () => [
    { nome: 'Salário', tipo: 'entrada' },
    { nome: 'Freelance', tipo: 'entrada' },
    { nome: 'Alimentação', tipo: 'gasto' },
    { nome: 'Moradia', tipo: 'gasto' },
    { nome: 'Transporte', tipo: 'gasto' },
    { nome: 'Saúde', tipo: 'gasto' },
    { nome: 'Lazer', tipo: 'gasto' },
    { nome: 'Educação', tipo: 'gasto' },
  ],
  Entradas: () => [
    { descricao: 'Salário', valor: 6800, data: mesOffset(0, 5), categoria: 'Salário', pessoa: 'Jeferson' },
    { descricao: 'Salário', valor: 4200, data: mesOffset(0, 5), categoria: 'Salário', pessoa: 'Raquel' },
    { descricao: 'Projeto freelance', valor: 950, data: mesOffset(0, 12), categoria: 'Freelance', pessoa: 'Jeferson' },
    { descricao: 'Salário', valor: 6800, data: mesOffset(1, 5), categoria: 'Salário', pessoa: 'Jeferson' },
    { descricao: 'Salário', valor: 4200, data: mesOffset(1, 5), categoria: 'Salário', pessoa: 'Raquel' },
    { descricao: 'Salário', valor: 6650, data: mesOffset(2, 5), categoria: 'Salário', pessoa: 'Jeferson' },
    { descricao: 'Salário', valor: 4200, data: mesOffset(2, 5), categoria: 'Salário', pessoa: 'Raquel' },
    { descricao: 'Salário', valor: 6650, data: mesOffset(3, 5), categoria: 'Salário', pessoa: 'Jeferson' },
    { descricao: 'Salário', valor: 4100, data: mesOffset(3, 5), categoria: 'Salário', pessoa: 'Raquel' },
  ],
  Gastos: () => [
    { descricao: 'Supermercado', valor: 480, data: dataOffset(1), categoria: 'Alimentação', cartao: 'Nubank', pessoa: 'Raquel' },
    { descricao: 'Combustível', valor: 220, data: dataOffset(2), categoria: 'Transporte', cartao: '', pessoa: 'Jeferson' },
    { descricao: 'Farmácia', valor: 85, data: dataOffset(4), categoria: 'Saúde', cartao: '', pessoa: 'Raquel' },
    { descricao: 'Cinema', valor: 96, data: dataOffset(6), categoria: 'Lazer', cartao: 'Nubank', pessoa: 'Jeferson' },
    { descricao: 'Restaurante', valor: 145, data: dataOffset(8), categoria: 'Alimentação', cartao: 'Inter', pessoa: 'Jeferson' },
    { descricao: 'Curso online', valor: 199, data: dataOffset(10), categoria: 'Educação', cartao: 'Nubank', pessoa: 'Raquel' },
    { descricao: 'Supermercado', valor: 512, data: mesOffset(1, 8), categoria: 'Alimentação', cartao: 'Nubank', pessoa: 'Raquel' },
    { descricao: 'Combustível', valor: 240, data: mesOffset(1, 14), categoria: 'Transporte', cartao: '', pessoa: 'Jeferson' },
    { descricao: 'Plano de saúde', valor: 610, data: mesOffset(1, 5), categoria: 'Saúde', cartao: '', pessoa: 'Jeferson' },
    { descricao: 'Supermercado', valor: 455, data: mesOffset(2, 8), categoria: 'Alimentação', cartao: 'Nubank', pessoa: 'Raquel' },
    { descricao: 'Combustível', valor: 260, data: mesOffset(2, 14), categoria: 'Transporte', cartao: '', pessoa: 'Jeferson' },
    { descricao: 'Manutenção do carro', valor: 380, data: mesOffset(2, 20), categoria: 'Transporte', cartao: 'Inter', pessoa: 'Jeferson' },
    { descricao: 'Supermercado', valor: 498, data: mesOffset(3, 8), categoria: 'Alimentação', cartao: 'Nubank', pessoa: 'Raquel' },
    { descricao: 'Presente aniversário', valor: 210, data: mesOffset(3, 18), categoria: 'Lazer', cartao: 'Nubank', pessoa: 'Raquel' },
  ],
  ContasFixas: () => [
    { descricao: 'Aluguel', valor: 1800, diaVencimento: 10, categoria: 'Moradia' },
    { descricao: 'Internet', valor: 120, diaVencimento: 15, categoria: 'Moradia' },
    { descricao: 'Plano de celular', valor: 90, diaVencimento: 20, categoria: 'Moradia' },
  ],
  Parcelamentos: () => [
    { descricao: 'Notebook novo', valorTotal: 4200, numeroParcelas: 10, parcelaAtual: 4, diaVencimento: 12, cartao: 'Nubank' },
    { descricao: 'Sofá', valorTotal: 2400, numeroParcelas: 8, parcelaAtual: 2, diaVencimento: 6, cartao: 'Inter' },
  ],
  Cartoes: () => [
    { nome: 'Nubank', limite: 8000, diaFechamento: 25 },
    { nome: 'Inter', limite: 5000, diaFechamento: 3 },
  ],
  Metas: () => [
    { descricao: 'Viagem de férias', valorAlvo: 8000, valorAtual: 3200 },
    { descricao: 'Reserva de emergência', valorAlvo: 20000, valorAtual: 12500 },
  ],
  Orcamentos: () => [
    { categoria: 'Alimentação', limiteMensal: 900 },
    { categoria: 'Transporte', limiteMensal: 500 },
    { categoria: 'Lazer', limiteMensal: 300 },
  ],
  PagamentosContasFixas: () => [],
  PagamentosParcelamentos: () => [],
  Transferencias: () => [],
};

function carregarTabela(tabela) {
  const existente = lerBruto(tabela);
  if (existente) return existente;

  const seed = SEEDS[tabela] ? SEEDS[tabela]() : [];
  const registros = seed.map((item) => ({
    id: gerarId(),
    criadoEm: new Date().toISOString(),
    excluidoEm: null,
    excluidoPor: null,
    ...item,
  }));
  gravarBruto(tabela, registros);
  return registros;
}

const ATRASO_SIMULADO_MS = 220;

function atraso() {
  return new Promise((resolve) => setTimeout(resolve, ATRASO_SIMULADO_MS));
}

export async function listar(tabela) {
  await atraso();
  return carregarTabela(tabela).filter((r) => !r.excluidoEm);
}

export async function listarExcluidos(tabela) {
  await atraso();
  return carregarTabela(tabela).filter((r) => r.excluidoEm);
}

export async function listarTodos(tabela) {
  await atraso();
  return carregarTabela(tabela);
}

export async function criar(tabela, dados) {
  await atraso();
  const registros = carregarTabela(tabela);
  const novo = { id: gerarId(), criadoEm: new Date().toISOString(), excluidoEm: null, excluidoPor: null, ...dados };
  const atualizados = [...registros, novo];
  gravarBruto(tabela, atualizados);
  return novo;
}

export async function atualizar(tabela, id, campos) {
  await atraso();
  const registros = carregarTabela(tabela);
  const atualizados = registros.map((r) => (String(r.id) === String(id) ? { ...r, ...campos } : r));
  gravarBruto(tabela, atualizados);
  return atualizados.find((r) => String(r.id) === String(id));
}

export async function excluir(tabela, id, pessoa = '') {
  return atualizar(tabela, id, { excluidoEm: new Date().toISOString(), excluidoPor: pessoa });
}

export async function restaurar(tabela, id) {
  return atualizar(tabela, id, { excluidoEm: null, excluidoPor: null });
}

export async function excluirPermanente(tabela, id) {
  await atraso();
  const registros = carregarTabela(tabela);
  const restantes = registros.filter((r) => String(r.id) !== String(id));
  gravarBruto(tabela, restantes);
}

export async function limparDadosExemplo() {
  Object.keys(SEEDS).forEach((tabela) => localStorage.removeItem(chave(tabela)));
}

export const TABELAS = Object.keys(SEEDS);
