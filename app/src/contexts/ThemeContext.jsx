import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage.js';

const ThemeContext = createContext(null);

export const ACENTOS = [
  { valor: 'roxo', nome: 'Roxo Clássico', cores: ['#7B61FF', '#FF7A9C'] },
  { valor: 'oceano', nome: 'Oceano', cores: ['#3B82F6', '#06B6D4'] },
  { valor: 'floresta', nome: 'Floresta', cores: ['#10B981', '#84CC16'] },
  { valor: 'vibrante', nome: 'Rosa Vibrante', cores: ['#EC4899', '#F97316'] },
  { valor: 'grafite', nome: 'Grafite', cores: ['#475569', '#94A3B8'] },
];

export function ThemeProvider({ children }) {
  // "tema" pode ser 'light', 'dark' ou 'auto' (segue o sistema operacional).
  const [tema, setTema] = useLocalStorage('tema', 'light');
  const [acento, setAcento] = useLocalStorage('acento', 'roxo');
  const [sistemaEscuro, setSistemaEscuro] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = (evento) => setSistemaEscuro(evento.matches);
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, []);

  const ehEscuro = tema === 'auto' ? sistemaEscuro : tema === 'dark';

  useEffect(() => {
    if (ehEscuro) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [ehEscuro]);

  useEffect(() => {
    if (acento && acento !== 'roxo') {
      document.documentElement.setAttribute('data-acento', acento);
    } else {
      document.documentElement.removeAttribute('data-acento');
    }
  }, [acento]);

  const valor = useMemo(
    () => ({
      tema,
      setTema,
      ehEscuro,
      acento,
      setAcento,
      // Alternância rápida (ex: ícone sol/lua no topo) — sempre decide
      // entre claro/escuro, nunca deixa em "automático".
      alternarTema: () => setTema(ehEscuro ? 'light' : 'dark'),
    }),
    [tema, setTema, ehEscuro, acento, setAcento]
  );

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const contexto = useContext(ThemeContext);
  if (!contexto) throw new Error('useTheme precisa estar dentro de um ThemeProvider');
  return contexto;
}
