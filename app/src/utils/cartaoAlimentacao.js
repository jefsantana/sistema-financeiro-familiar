import { criar, atualizar } from '../services/dados.js';
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
