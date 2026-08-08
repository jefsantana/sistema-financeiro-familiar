import { Panel } from '../../components/dashboard/Panel.jsx';
import { GraficoBarras } from '../../components/charts/GraficoBarras.jsx';
import { Loading } from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { agruparPorCategoria } from '../../utils/financeiro.js';

export default function Relatorios() {
  const { registros: entradas, carregando: carregandoEntradas } = useCrudMock('Entradas');
  const { registros: gastos, carregando: carregandoGastos } = useCrudMock('Gastos');

  if (carregandoEntradas || carregandoGastos) return <Loading texto="Carregando relatórios..." />;

  const gastosPorCategoria = agruparPorCategoria(gastos, Infinity);
  const entradasPorCategoria = agruparPorCategoria(entradas, Infinity);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espaco-lg)' }}>
      <Panel titulo="📉 Gastos por Categoria" subtitulo="histórico completo">
        <GraficoBarras dados={gastosPorCategoria} cor="#EF4444" />
      </Panel>

      <Panel titulo="📈 Entradas por Categoria" subtitulo="histórico completo">
        <GraficoBarras dados={entradasPorCategoria} cor="#10B981" />
      </Panel>
    </div>
  );
}
