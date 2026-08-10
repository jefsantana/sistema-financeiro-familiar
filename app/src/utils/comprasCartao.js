import { criar } from '../services/dados.js';
import { mesFaturaDeCompra } from './financeiro.js';

/**
 * Registra uma compra à vista no cartão: não vira um Gasto na hora,
 * entra pendente na fatura do cartão (calculada pelo dia de
 * fechamento) e só vira Gasto de verdade quando a fatura for paga.
 */
export function criarCompraNoCartao({ descricao, valor, data, categoria, cartao, pessoa, familiaId, cartoes }) {
  const cartaoInfo = cartoes.find((c) => c.nome === cartao);
  const mesFatura = mesFaturaDeCompra(data, cartaoInfo?.diaFechamento);
  return criar(
    'ComprasCartao',
    { descricao, valor, dataCompra: data, categoria, cartao, pessoa, mesFatura, paga: false },
    familiaId
  );
}
