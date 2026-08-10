import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/dados.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';

export function useCrudMock(tabela) {
  const { perfil } = useAuth();
  const toast = useToast();
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await api.listar(tabela);
      setRegistros(dados);
    } catch (erro) {
      toast.erro('Não foi possível carregar os dados. Verifique sua conexão e tente novamente.');
      throw erro;
    } finally {
      setCarregando(false);
    }
  }, [tabela, toast]);

  useEffect(() => {
    if (perfil?.familia_id) recarregar();
  }, [recarregar, perfil?.familia_id]);

  const salvar = useCallback(
    async (dados) => {
      setSalvando(true);
      try {
        await api.criar(tabela, dados, perfil?.familia_id);
        await recarregar();
      } catch (erro) {
        toast.erro('Não foi possível salvar. Tente novamente.');
        throw erro;
      } finally {
        setSalvando(false);
      }
    },
    [tabela, recarregar, perfil?.familia_id, toast]
  );

  const editar = useCallback(
    async (id, campos) => {
      setSalvando(true);
      try {
        await api.atualizar(tabela, id, campos);
        await recarregar();
      } catch (erro) {
        toast.erro('Não foi possível salvar as alterações. Tente novamente.');
        throw erro;
      } finally {
        setSalvando(false);
      }
    },
    [tabela, recarregar, toast]
  );

  const remover = useCallback(
    async (id, pessoa) => {
      try {
        await api.excluir(tabela, id, pessoa);
        await recarregar();
      } catch (erro) {
        toast.erro('Não foi possível excluir o registro. Tente novamente.');
        throw erro;
      }
    },
    [tabela, recarregar, toast]
  );

  return { registros, carregando, salvando, salvar, editar, remover, recarregar };
}
