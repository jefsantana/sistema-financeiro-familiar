import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const [corresponde, setCorresponde] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const ouvir = (evento) => setCorresponde(evento.matches);
    media.addEventListener('change', ouvir);
    setCorresponde(media.matches);
    return () => media.removeEventListener('change', ouvir);
  }, [query]);

  return corresponde;
}

export function useEhCelular() {
  return useMediaQuery('(max-width: 640px)');
}

export function useEhTablet() {
  return useMediaQuery('(max-width: 1024px)');
}
