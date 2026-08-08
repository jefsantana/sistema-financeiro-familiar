import './registroChartJs.js';
import { Bar } from 'react-chartjs-2';
import { formatarMoeda } from '../../utils/formatadores.js';
import { useChartTheme } from './useChartTheme.js';
import { EmptyState } from '../ui/index.js';
import { BarChart3 } from 'lucide-react';

export function GraficoBarras({ dados, cor: corBarra = '#7B61FF', altura }) {
  const cor = useChartTheme();

  if (dados.length === 0) {
    return <EmptyState icone={BarChart3} titulo="Sem dados ainda" descricao="Os lançamentos deste período aparecerão aqui." />;
  }

  const data = {
    labels: dados.map((d) => d.label),
    datasets: [
      {
        data: dados.map((d) => d.valor),
        backgroundColor: corBarra,
        borderRadius: 6,
        maxBarThickness: 26,
      },
    ],
  };

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: cor.superficie,
        titleColor: cor.textoForte,
        bodyColor: cor.texto,
        borderColor: cor.grade,
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (contexto) => ` ${formatarMoeda(contexto.parsed.x)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: cor.grade },
        ticks: {
          color: cor.texto,
          font: { family: cor.fonteNumeros, size: 10 },
          callback: (valor) => formatarMoeda(valor).replace(',00', ''),
        },
      },
      y: {
        grid: { display: false },
        ticks: { color: cor.textoForte, font: { family: cor.fonteFamilia, size: 12, weight: 500 } },
      },
    },
  };

  const alturaFinal = altura || Math.max(160, dados.length * 42);

  return (
    <div style={{ height: alturaFinal }}>
      <Bar data={data} options={options} />
    </div>
  );
}
