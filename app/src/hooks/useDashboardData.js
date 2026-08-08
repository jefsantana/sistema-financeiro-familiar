import { useCallback, useEffect, useState } from 'react';
import { listar } from '../services/dados.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const TABELAS = ['Entradas', 'Gastos', 'ContasFixas', 'PagamentosContasFixas', 'Parcelamentos', 'PagamentosParcelamentos', 'Metas', 'Orcamentos'];

export function useDashboardData() {
  const { perfil } = useAuth();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [entradas, gastos, contasFixas, pagamentos, parcelamentos, pagamentosParcelamentos, metas, orcamentos] =
        await Promise.all(TABELAS.map((tabela) => listar(tabela)));
      setDados({ entradas, gastos, contasFixas, pagamentos, parcelamentos, pagamentosParcelamentos, metas, orcamentos });
    } catch (falha) {
      setErro(falha);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (perfil?.familia_id) recarregar();
  }, [recarregar, perfil?.familia_id]);

  return { dados, carregando, erro, recarregar };
}
