import { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';

/**
 * Cores fixas (não variam com o tema) — usadas nas séries dos gráficos
 * para manter a identidade visual consistente entre claro e escuro.
 */
export const CORES_SERIE = ['#7B61FF', '#FF7A9C', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'];

export function useChartTheme() {
  const { ehEscuro } = useTheme();

  return useMemo(
    () => ({
      texto: ehEscuro ? '#9691B0' : '#6B7280',
      textoForte: ehEscuro ? '#EDEDF5' : '#2D2D3A',
      grade: ehEscuro ? '#2B2645' : '#E5E7EB',
      superficie: ehEscuro ? '#1E1B2E' : '#FFFFFF',
      fonteFamilia: 'Poppins, sans-serif',
      fonteNumeros: "'IBM Plex Mono', monospace",
    }),
    [ehEscuro]
  );
}
