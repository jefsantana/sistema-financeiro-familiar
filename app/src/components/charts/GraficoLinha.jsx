import './registroChartJs.js';
import { Line } from 'react-chartjs-2';
import { formatarMoeda } from '../../utils/formatadores.js';
import { useChartTheme } from './useChartTheme.js';
import { EmptyState } from '../ui/index.js';
import { LineChart } from 'lucide-react';

/**
 * @param {Array} pontos - [{ mes: 'Mar', entrada, saida, saldo }, ...] em ordem cronológica
 */
export function GraficoLinha({ pontos, altura = 240 }) {
  const cor = useChartTheme();

  if (pontos.length < 2) {
    return (
      <EmptyState
        icone={LineChart}
        titulo="Histórico insuficiente"
        descricao="Assim que houver ao menos dois meses de lançamentos, a evolução aparece aqui."
      />
    );
  }

  const data = {
    labels: pontos.map((p) => p.mes),
    datasets: [
      {
        label: 'Entradas',
        data: pontos.map((p) => p.entrada),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        tension: 0.35,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#10B981',
      },
      {
        label: 'Saídas',
        data: pontos.map((p) => p.saida),
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.06)',
        tension: 0.35,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#EF4444',
      },
      {
        label: 'Saldo',
        data: pontos.map((p) => p.saldo),
        borderColor: '#7B61FF',
        backgroundColor: 'rgba(123, 97, 255, 0.06)',
        tension: 0.35,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#7B61FF',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: cor.textoForte,
          font: { family: cor.fonteFamilia, size: 12, weight: 500 },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: cor.superficie,
        titleColor: cor.textoForte,
        bodyColor: cor.texto,
        borderColor: cor.grade,
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (contexto) => ` ${contexto.dataset.label}: ${formatarMoeda(contexto.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: cor.texto, font: { family: cor.fonteFamilia, size: 11 } },
      },
      y: {
        grid: { color: cor.grade },
        ticks: {
          color: cor.texto,
          font: { family: cor.fonteNumeros, size: 10 },
          callback: (valor) => formatarMoeda(valor).replace(',00', ''),
        },
      },
    },
  };

  return (
    <div style={{ height: altura, width: '100%', minWidth: 0, position: 'relative' }}>
      <Line data={data} options={options} />
    </div>
  );
}
