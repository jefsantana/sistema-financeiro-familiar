import { useCallback, useState } from 'react';
import { criar, atualizar } from '../services/dados.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { dataLocalDeHoje } from '../utils/formatadores.js';

export function usePagamentos(aoConcluir) {
  const { perfil } = useAuth();
  const toast = useToast();
  const [pagando, setPagando] = useState(null);

  const pagar = useCallback(
    async (item, pessoa) => {
      const familiaId = perfil?.familia_id;
      setPagando(item.id);
      try {
        if (item.tipo === 'fatura') {
          // Uma fatura junta várias compras pendentes do mesmo cartão: cada
          // uma vira o próprio Gasto (mantendo descrição/categoria originais)
          // e é marcada como paga, só na data em que a fatura é quitada.
          for (const compra of item.itens) {
            await criar(
              'Gastos',
              {
                descricao: compra.descricao,
                valor: Number(compra.valor),
                data: dataLocalDeHoje(),
                categoria: compra.categoria || 'Cartão de Crédito',
                cartao: compra.cartao || '',
                pessoa,
              },
              familiaId
            );
            await atualizar('ComprasCartao', compra.id, { paga: true });
          }
        } else {
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
              data: dataLocalDeHoje(),
              categoria: item.categoria || 'Cartão de Crédito',
              cartao: item.cartao || '',
              pessoa,
            },
            familiaId
          );
        }

        await aoConcluir?.();
      } catch {
        toast.erro('Não foi possível registrar o pagamento. Tente novamente.');
      } finally {
        setPagando(null);
      }
    },
    [aoConcluir, perfil?.familia_id, toast]
  );

  return { pagar, pagando };
}
