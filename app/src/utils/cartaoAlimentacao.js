import { criar, atualizar, excluir } from '../services/dados.js';
import { dataLocalDeHoje } from './formatadores.js';

/**
 * Registra um gasto ou recarga no cartão alimentação (Ticket/VR/Alelo):
 * busca o cartão pelo nome (cria se ainda não existir), ajusta o saldo
 * atual (soma na recarga, desconta no gasto) e grava o movimento — mesma
 * lógica usada pelo bot do WhatsApp em baileys-financeiro/index.js.
 */
export async function registrarMovimentoAlimentacao({
  nomeCartao,
  tipo,
  descricao,
  valor,
  pessoa,
  familiaId,
  cartoesExistentes,
}) {
  const nome = nomeCartao.trim();
  let cartao = cartoesExistentes.find((c) => c.nome.toLowerCase() === nome.toLowerCase());

  if (!cartao) {
    cartao = await criar('CartoesAlimentacao', { nome, saldoAtual: 0 }, familiaId);
  }

  const novoSaldo = tipo === 'recarga' ? Number(cartao.saldoAtual) + Number(valor) : Number(cartao.saldoAtual) - Number(valor);

  await atualizar('CartoesAlimentacao', cartao.id, { saldoAtual: novoSaldo });

  const movimento = await criar(
    'MovimentosCartaoAlimentacao',
    {
      cartaoAlimentacaoId: cartao.id,
      tipo,
      descricao: descricao || (tipo === 'recarga' ? 'Recarga do cartão alimentação' : 'Gasto no cartão alimentação'),
      valor,
      pessoa: pessoa || null,
      data: dataLocalDeHoje(),
    },
    familiaId
  );

  return { movimento, cartao: { ...cartao, saldoAtual: novoSaldo } };
}

/**
 * Edita descrição/valor de um movimento já salvo, ajustando o saldo do
 * cartão pela diferença (mesma lógica de aplicarCorrecao() no bot do
 * WhatsApp). O tipo (gasto/recarga) e o cartão não mudam aqui — trocar de
 * cartão exigiria mexer no saldo de dois cartões, então isso não é
 * suportado por este formulário (nem pelo bot).
 */
export async function editarMovimentoAlimentacao({ movimentoAntigo, descricao, valor, cartao }) {
  const valorNovo = Number(valor);
  const delta = valorNovo - Number(movimentoAntigo.valor);
  const ajusteSaldo = movimentoAntigo.tipo === 'gasto' ? -delta : delta;
  const novoSaldo = Number(cartao.saldoAtual) + ajusteSaldo;

  await atualizar('CartoesAlimentacao', cartao.id, { saldoAtual: novoSaldo });
  const movimento = await atualizar('MovimentosCartaoAlimentacao', movimentoAntigo.id, { descricao, valor: valorNovo });

  return { movimento, cartao: { ...cartao, saldoAtual: novoSaldo } };
}

/**
 * Exclui (soft-delete) um movimento, desfazendo o efeito dele no saldo do
 * cartão antes — senão o saldo ficaria errado pra sempre (um gasto excluído
 * continuaria descontado, uma recarga excluída continuaria somada).
 */
export async function excluirMovimentoAlimentacao({ movimento, cartao, pessoa }) {
  const ajusteSaldo = movimento.tipo === 'gasto' ? Number(movimento.valor) : -Number(movimento.valor);
  const novoSaldo = Number(cartao.saldoAtual) + ajusteSaldo;

  await atualizar('CartoesAlimentacao', cartao.id, { saldoAtual: novoSaldo });
  await excluir('MovimentosCartaoAlimentacao', movimento.id, pessoa);

  return { cartao: { ...cartao, saldoAtual: novoSaldo } };
}
