import { useCallback, useEffect, useState } from 'react';
import { listarExcluidos, restaurar, excluirPermanente } from '../services/dados.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const TABELAS_VISIVEIS = {
  Entradas: 'Entrada',
  Gastos: 'Gasto',
  Categorias: 'Categoria',
  ContasFixas: 'Conta Fixa',
  Parcelamentos: 'Parcelamento',
  Cartoes: 'Cartão',
  Metas: 'Meta',
  Transferencias: 'Transferência',
};

export function useLixeira() {
  const { perfil } = useAuth();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const listas = await Promise.all(
      Object.keys(TABELAS_VISIVEIS).map(async (tabela) => {
        const registros = await listarExcluidos(tabela);
        return registros.map((r) => ({ ...r, _tabela: tabela, _tipoLabel: TABELAS_VISIVEIS[tabela] }));
      })
    );
    const todos = listas.flat().sort((a, b) => new Date(b.excluidoEm) - new Date(a.excluidoEm));
    setItens(todos);
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (perfil?.familia_id) recarregar();
  }, [recarregar, perfil?.familia_id]);

  const restaurarItem = useCallback(
    async (tabela, id) => {
      await restaurar(tabela, id);
      await recarregar();
    },
    [recarregar]
  );

  const excluirItemPermanente = useCallback(
    async (tabela, id) => {
      await excluirPermanente(tabela, id);
      await recarregar();
    },
    [recarregar]
  );

  return { itens, carregando, restaurarItem, excluirItemPermanente, recarregar };
}
