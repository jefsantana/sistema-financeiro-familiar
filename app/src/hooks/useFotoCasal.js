import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase.js';

export function useFotoCasal(familiaId) {
  const [foto, setFoto] = useState(null);
  const [posicao, setPosicao] = useState(50);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!familiaId) {
      setCarregando(false);
      return;
    }

    let cancelado = false;
    setCarregando(true);

    supabase
      .from('familias')
      .select('foto_casal, foto_casal_posicao')
      .eq('id', familiaId)
      .single()
      .then(({ data }) => {
        if (cancelado || !data) return;
        setFoto(data.foto_casal || null);
        setPosicao(data.foto_casal_posicao ?? 50);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [familiaId]);

  const salvar = useCallback(
    async (novaFoto, novaPosicao) => {
      const { error } = await supabase
        .from('familias')
        .update({ foto_casal: novaFoto, foto_casal_posicao: novaPosicao })
        .eq('id', familiaId);
      if (error) throw error;
      setFoto(novaFoto);
      setPosicao(novaPosicao);
    },
    [familiaId]
  );

  return { foto, posicao, carregando, salvar };
}
