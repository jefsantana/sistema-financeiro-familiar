import { useEffect, useState } from 'react';

export function useLocalStorage(chave, valorInicial) {
  const [valor, setValor] = useState(() => {
    try {
      const salvo = localStorage.getItem(chave);
      return salvo !== null ? JSON.parse(salvo) : valorInicial;
    } catch {
      return valorInicial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      // localStorage indisponível (modo privado, quota cheia) — ignora silenciosamente
    }
  }, [chave, valor]);

  return [valor, setValor];
}
