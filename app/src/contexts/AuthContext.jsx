import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase.js';
import { registrarAcesso } from '../services/dados.js';
import { detectarDispositivo } from '../utils/deteccaoDispositivo.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(undefined);
  const [perfil, setPerfil] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));

    const { data: assinatura } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSessao(novaSessao);
      // Só em login de verdade (não em restaurar sessão ao recarregar
      // a página, nem em refresh de token) — assim o histórico reflete
      // acessos reais, não toda navegação.
      if (evento === 'SIGNED_IN' && novaSessao?.user) {
        registrarAcesso({ perfilId: novaSessao.user.id, ...detectarDispositivo() }).catch(() => {});
      }
    });

    return () => assinatura.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessao?.user) {
      setPerfil(null);
      return;
    }

    supabase
      .from('perfis')
      .select('nome, familia_id, familias(nome, pessoa_1, pessoa_2, foto_pessoa_1, foto_pessoa_2, dias_retencao_lixeira)')
      .eq('id', sessao.user.id)
      .single()
      .then(({ data }) => setPerfil(data));
  }, [sessao]);

  const familia = perfil?.familias ?? null;
  const pessoas = familia ? [familia.pessoa_1, familia.pessoa_2].filter(Boolean) : [];

  const valor = useMemo(
    () => ({
      sessao,
      usuario: sessao?.user ?? null,
      perfil,
      familia,
      pessoas,
      carregando: sessao === undefined,
      entrar: (email, senha) => supabase.auth.signInWithPassword({ email, password: senha }),
      cadastrar: (email, senha, { nome, pessoa2, nomeFamilia }) =>
        supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome, pessoa2: pessoa2 || null, nome_familia: nomeFamilia || null } },
        }),
      sair: () => supabase.auth.signOut(),
      recuperarSenha: (email) =>
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + import.meta.env.BASE_URL + 'redefinir-senha',
        }),
      atualizarSenha: (novaSenha) => supabase.auth.updateUser({ password: novaSenha }),
      excluirConta: async () => {
        const { error } = await supabase.rpc('excluir_minha_conta');
        if (!error) await supabase.auth.signOut();
        return { error };
      },
      atualizarFotoPessoal: async (indice, dataUrl) => {
        const coluna = indice === 0 ? 'foto_pessoa_1' : 'foto_pessoa_2';
        const { error } = await supabase.from('familias').update({ [coluna]: dataUrl }).eq('id', perfil.familia_id);
        if (!error) {
          setPerfil((atual) => ({ ...atual, familias: { ...atual.familias, [coluna]: dataUrl } }));
        }
        return { error };
      },
      atualizarDiasRetencaoLixeira: async (dias) => {
        const { error } = await supabase
          .from('familias')
          .update({ dias_retencao_lixeira: dias })
          .eq('id', perfil.familia_id);
        if (!error) {
          setPerfil((atual) => ({ ...atual, familias: { ...atual.familias, dias_retencao_lixeira: dias } }));
        }
        return { error };
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessao, perfil]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de um AuthProvider');
  return contexto;
}
