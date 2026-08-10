import { useCallback, useEffect, useState } from 'react';
import { listarExcluidos, restaurar, excluirPermanente } from '../services/dados.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';

const TABELAS_VISIVEIS = {
  Entradas: 'Entrada',
  Gastos: 'Gasto',
  Categorias: 'Categoria',
  ContasFixas: 'Conta Fixa',
  Parcelamentos: 'Parcelamento',
  Cartoes: 'Cartão',
  Metas: 'Meta',
  Orcamentos: 'Orçamento',
  Transferencias: 'Transferência',
  PagamentosContasFixas: 'Pagamento de Conta',
  PagamentosParcelamentos: 'Pagamento de Parcela',
};

export function useLixeira() {
  const { perfil } = useAuth();
  const toast = useToast();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const listas = await Promise.all(
        Object.keys(TABELAS_VISIVEIS).map(async (tabela) => {
          const registros = await listarExcluidos(tabela);
          return registros.map((r) => ({ ...r, _tabela: tabela, _tipoLabel: TABELAS_VISIVEIS[tabela] }));
        })
      );
      const todos = listas.flat().sort((a, b) => new Date(b.excluidoEm) - new Date(a.excluidoEm));
      setItens(todos);
    } catch (erro) {
      toast.erro('Não foi possível carregar a lixeira. Tente novamente.');
      throw erro;
    } finally {
      setCarregando(false);
    }
  }, [toast]);

  useEffect(() => {
    if (perfil?.familia_id) recarregar();
  }, [recarregar, perfil?.familia_id]);

  const restaurarItem = useCallback(
    async (tabela, id) => {
      try {
        await restaurar(tabela, id);
        await recarregar();
      } catch (erro) {
        toast.erro('Não foi possível restaurar o registro. Tente novamente.');
        throw erro;
      }
    },
    [recarregar, toast]
  );

  const excluirItemPermanente = useCallback(
    async (tabela, id) => {
      try {
        await excluirPermanente(tabela, id);
        await recarregar();
      } catch (erro) {
        toast.erro('Não foi possível excluir permanentemente. Tente novamente.');
        throw erro;
      }
    },
    [recarregar, toast]
  );

  return { itens, carregando, restaurarItem, excluirItemPermanente, recarregar };
}
