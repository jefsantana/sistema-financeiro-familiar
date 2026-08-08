import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/dados.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export function useCrudMock(tabela) {
  const { perfil } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const dados = await api.listar(tabela);
    setRegistros(dados);
    setCarregando(false);
  }, [tabela]);

  useEffect(() => {
    if (perfil?.familia_id) recarregar();
  }, [recarregar, perfil?.familia_id]);

  const salvar = useCallback(
    async (dados) => {
      setSalvando(true);
      try {
        await api.criar(tabela, dados, perfil?.familia_id);
        await recarregar();
      } finally {
        setSalvando(false);
      }
    },
    [tabela, recarregar, perfil?.familia_id]
  );

  const editar = useCallback(
    async (id, campos) => {
      setSalvando(true);
      try {
        await api.atualizar(tabela, id, campos);
        await recarregar();
      } finally {
        setSalvando(false);
      }
    },
    [tabela, recarregar]
  );

  const remover = useCallback(
    async (id, pessoa) => {
      await api.excluir(tabela, id, pessoa);
      await recarregar();
    },
    [tabela, recarregar]
  );

  return { registros, carregando, salvando, salvar, editar, remover, recarregar };
}
