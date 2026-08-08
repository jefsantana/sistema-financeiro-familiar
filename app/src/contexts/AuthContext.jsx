import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(undefined);
  const [perfil, setPerfil] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));

    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao);
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
      .select('nome, familia_id')
      .eq('id', sessao.user.id)
      .single()
      .then(({ data }) => setPerfil(data));
  }, [sessao]);

  const valor = useMemo(
    () => ({
      sessao,
      usuario: sessao?.user ?? null,
      perfil,
      carregando: sessao === undefined,
      entrar: (email, senha) => supabase.auth.signInWithPassword({ email, password: senha }),
      sair: () => supabase.auth.signOut(),
    }),
    [sessao, perfil]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de um AuthProvider');
  return contexto;
}
