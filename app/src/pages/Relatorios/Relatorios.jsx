import { useState } from 'react';
import { TrendingUp, TrendingDown, ArrowUpDown, Calendar } from 'lucide-react';
import { Panel } from '../../components/dashboard/Panel.jsx';
import { GraficoBarras } from '../../components/charts/GraficoBarras.jsx';
import { MonthlyTable } from '../../components/dashboard/MonthlyTable.jsx';
import { Loading, Select } from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  agruparPorCategoria,
  obterMesAno,
  mesAnoDe,
  somar,
  calcularTendencia,
  calcularResumoMensal,
} from '../../utils/financeiro.js';
import { formatarMoeda, nomeMesAno } from '../../utils/formatadores.js';
import styles from './Relatorios.module.css';

export default function Relatorios() {
  const { registros: entradas, carregando: carregandoEntradas } = useCrudMock('Entradas');
  const { registros: gastos, carregando: carregandoGastos } = useCrudMock('Gastos');
  const { pessoas } = useAuth();

  const [periodo, setPeriodo] = useState('tudo');
  const [filtroPessoa, setFiltroPessoa] = useState('todos');

  if (carregandoEntradas || carregandoGastos) return <Loading texto="Carregando relatórios..." />;

  const hoje = new Date();
  const mesAtual = mesAnoDe(hoje);
  const mesAnterior = mesAnoDe(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));

  const porPessoa = (item) => filtroPessoa === 'todos' || item.pessoa === filtroPessoa;
  const porPeriodo = (item) => {
    if (periodo === 'tudo') return true;
    const mesAno = obterMesAno(item.data);
    if (periodo === 'atual') return mesAno === mesAtual;
    return mesAno === mesAnterior;
  };

  const entradasFiltradas = entradas.filter(porPessoa).filter(porPeriodo);
  const gastosFiltrados = gastos.filter(porPessoa).filter(porPeriodo);

  const gastosPorCategoria = agruparPorCategoria(gastosFiltrados, Infinity);
  const entradasPorCategoria = agruparPorCategoria(entradasFiltradas, Infinity);

  const subtituloPeriodo = periodo === 'tudo' ? 'histórico completo' : periodo === 'atual' ? 'este mês' : 'mês passado';

  const entradasMesAtual = somar(entradas.filter(porPessoa).filter((e) => obterMesAno(e.data) === mesAtual));
  const gastosMesAtual = somar(gastos.filter(porPessoa).filter((g) => obterMesAno(g.data) === mesAtual));
  const entradasMesPassado = somar(entradas.filter(porPessoa).filter((e) => obterMesAno(e.data) === mesAnterior));
  const gastosMesPassado = somar(gastos.filter(porPessoa).filter((g) => obterMesAno(g.data) === mesAnterior));

  const tendenciaEntradas = calcularTendencia(entradasMesAtual, entradasMesPassado);
  const tendenciaGastos = calcularTendencia(gastosMesAtual, gastosMesPassado, true);

  const resumoMensal = calcularResumoMensal(entradas.filter(porPessoa), gastos.filter(porPessoa));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espaco-lg)' }}>
      <div className={styles.filtros}>
        <Select className={styles.filtroSelect} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          <option value="tudo">Todo o período</option>
          <option value="atual">Este mês</option>
          <option value="anterior">Mês passado</option>
        </Select>
        {pessoas.length > 1 && (
          <Select className={styles.filtroSelect} value={filtroPessoa} onChange={(e) => setFiltroPessoa(e.target.value)}>
            <option value="todos">Todas as pessoas</option>
            {pessoas.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        )}
      </div>

      <Panel icone={ArrowUpDown} titulo="Este mês vs. mês passado" subtitulo={nomeMesAno(hoje)}>
        <div className={styles.comparativo}>
          <div className={styles.itemComparativo}>
            <span className={styles.rotuloComparativo}>Entradas</span>
            <span className="valor-positivo">{formatarMoeda(entradasMesAtual)}</span>
            {tendenciaEntradas && (
              <span className={tendenciaEntradas.bom ? styles.tendenciaBoa : styles.tendenciaRuim}>
                {tendenciaEntradas.subiu ? '↑' : '↓'} {tendenciaEntradas.percentual}%
              </span>
            )}
          </div>
          <div className={styles.itemComparativo}>
            <span className={styles.rotuloComparativo}>Gastos</span>
            <span className="valor-negativo">{formatarMoeda(gastosMesAtual)}</span>
            {tendenciaGastos && (
              <span className={tendenciaGastos.bom ? styles.tendenciaBoa : styles.tendenciaRuim}>
                {tendenciaGastos.subiu ? '↑' : '↓'} {tendenciaGastos.percentual}%
              </span>
            )}
          </div>
        </div>
      </Panel>

      <Panel icone={TrendingDown} titulo="Gastos por Categoria" subtitulo={subtituloPeriodo}>
        <GraficoBarras dados={gastosPorCategoria} cor="#EF4444" />
      </Panel>

      <Panel icone={TrendingUp} titulo="Entradas por Categoria" subtitulo={subtituloPeriodo}>
        <GraficoBarras dados={entradasPorCategoria} cor="#10B981" />
      </Panel>

      <Panel icone={Calendar} titulo="Resumo Mensal">
        <MonthlyTable resumo={resumoMensal} />
      </Panel>
    </div>
  );
}
