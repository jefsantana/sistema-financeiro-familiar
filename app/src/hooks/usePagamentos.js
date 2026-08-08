import { useCallback, useState } from 'react';
import { criar, atualizar } from '../services/mockData.js';

const HOJE = () => new Date().toISOString().slice(0, 10);

export function usePagamentos(aoConcluir) {
  const [pagando, setPagando] = useState(null);

  const pagar = useCallback(
    async (item, pessoa) => {
      setPagando(item.id);
      try {
        if (item.tipo === 'contaFixa') {
          await criar('PagamentosContasFixas', { contaFixaId: item.id, mesAno: item.mesAno, pessoa });
        } else {
          await criar('PagamentosParcelamentos', { parcelamentoId: item.id, mesAno: item.mesAno, pessoa });
          await atualizar('Parcelamentos', item.id, { parcelaAtual: item.parcelaAtual + 1 });
        }

        await criar('Gastos', {
          descricao: item.descricao,
          valor: item.valor,
          data: HOJE(),
          categoria: item.categoria || (item.tipo === 'contaFixa' ? 'Contas Fixas' : 'Parcelamento'),
          cartao: item.cartao || '',
          pessoa,
        });

        await aoConcluir?.();
      } finally {
        setPagando(null);
      }
    },
    [aoConcluir]
  );

  return { pagar, pagando };
}
