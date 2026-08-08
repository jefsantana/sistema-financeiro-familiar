import { useCallback, useState } from 'react';
import { criar, atualizar } from '../services/dados.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const HOJE = () => new Date().toISOString().slice(0, 10);

export function usePagamentos(aoConcluir) {
  const { perfil } = useAuth();
  const [pagando, setPagando] = useState(null);

  const pagar = useCallback(
    async (item, pessoa) => {
      const familiaId = perfil?.familia_id;
      setPagando(item.id);
      try {
        if (item.tipo === 'contaFixa') {
          await criar('PagamentosContasFixas', { contaFixaId: item.id, mesAno: item.mesAno, pessoa }, familiaId);
        } else {
          await criar('PagamentosParcelamentos', { parcelamentoId: item.id, mesAno: item.mesAno, pessoa }, familiaId);
          await atualizar('Parcelamentos', item.id, { parcelaAtual: item.parcelaAtual + 1 });
        }

        await criar(
          'Gastos',
          {
            descricao: item.descricao,
            valor: item.valor,
            data: HOJE(),
            categoria: item.categoria || (item.tipo === 'contaFixa' ? 'Contas Fixas' : 'Parcelamento'),
            cartao: item.cartao || '',
            pessoa,
          },
          familiaId
        );

        await aoConcluir?.();
      } finally {
        setPagando(null);
      }
    },
    [aoConcluir, perfil?.familia_id]
  );

  return { pagar, pagando };
}
