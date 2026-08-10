import './registroChartJs.js';
import { Doughnut } from 'react-chartjs-2';
import { formatarMoeda } from '../../utils/formatadores.js';
import { useChartTheme, CORES_SERIE } from './useChartTheme.js';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { EmptyState } from '../ui/index.js';
import { PieChart } from 'lucide-react';

function pluginTextoCentral(total, cor) {
  return {
    id: 'textoCentral',
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const centroX = (chartArea.left + chartArea.right) / 2;
      const centroY = (chartArea.top + chartArea.bottom) / 2;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = cor.textoForte;
      ctx.font = `700 15px ${cor.fonteNumeros}`;
      ctx.fillText(formatarMoeda(total), centroX, centroY - 8);

      ctx.fillStyle = cor.texto;
      ctx.font = `600 10px ${cor.fonteFamilia}`;
      ctx.fillText('TOTAL', centroX, centroY + 12);
      ctx.restore();
    },
  };
}

export function GraficoDonut({ dados, altura = 220 }) {
  const cor = useChartTheme();
  const { ehEscuro } = useTheme();
  const total = dados.reduce((soma, d) => soma + d.valor, 0);

  if (total === 0) {
    return <EmptyState icone={PieChart} titulo="Sem dados ainda" descricao="Assim que houver gastos este mês, o gráfico aparece aqui." />;
  }

  const data = {
    labels: dados.map((d) => d.label),
    datasets: [
      {
        data: dados.map((d) => d.valor),
        backgroundColor: CORES_SERIE,
        borderColor: cor.superficie,
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'right',
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
          label: (contexto) => ` ${formatarMoeda(contexto.parsed)}`,
        },
      },
    },
  };

  return (
    <div style={{ height: altura }}>
      {/* A troca de tema muda só as cores desenhadas dentro do canvas
          (pelo plugin), e o react-chartjs-2 não redesenha isso sozinho
          quando só a cor muda — por isso a key força recriar o
          gráfico e garantir que o texto "TOTAL" sempre saia com a
          cor certa pro tema atual. */}
      <Doughnut key={ehEscuro ? 'escuro' : 'claro'} data={data} options={options} plugins={[pluginTextoCentral(total, cor)]} />
    </div>
  );
}
