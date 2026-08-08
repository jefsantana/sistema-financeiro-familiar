import { useCallback, useEffect, useState } from 'react';
import { listar } from '../services/mockData.js';

const TABELAS = ['Entradas', 'Gastos', 'ContasFixas', 'PagamentosContasFixas', 'Parcelamentos', 'PagamentosParcelamentos', 'Metas', 'Orcamentos'];

export function useDashboardData() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const [entradas, gastos, contasFixas, pagamentos, parcelamentos, pagamentosParcelamentos, metas, orcamentos] =
      await Promise.all(TABELAS.map((tabela) => listar(tabela)));
    setDados({ entradas, gastos, contasFixas, pagamentos, parcelamentos, pagamentosParcelamentos, metas, orcamentos });
    setCarregando(false);
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { dados, carregando, recarregar };
}
