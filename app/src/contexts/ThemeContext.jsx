import { createContext, useContext, useEffect, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [tema, setTema] = useLocalStorage('tema', 'light');

  useEffect(() => {
    if (tema === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [tema]);

  const valor = useMemo(
    () => ({
      tema,
      ehEscuro: tema === 'dark',
      alternarTema: () => setTema((atual) => (atual === 'dark' ? 'light' : 'dark')),
    }),
    [tema, setTema]
  );

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const contexto = useContext(ThemeContext);
  if (!contexto) throw new Error('useTheme precisa estar dentro de um ThemeProvider');
  return contexto;
}
