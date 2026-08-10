import { useState } from 'react';
import { TrendingUp, TrendingDown, ArrowUpDown, Calendar, Users, Check } from 'lucide-react';
import { Panel } from '../../components/dashboard/Panel.jsx';
import { GraficoBarras } from '../../components/charts/GraficoBarras.jsx';
import { MonthlyTable } from '../../components/dashboard/MonthlyTable.jsx';
import { Loading, Select, Avatar, Card } from '../../components/ui/index.js';
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

  const mostrarComparativo = pessoas.length > 1 && filtroPessoa === 'todos';
  const comparativoPorPessoa = mostrarComparativo
    ? pessoas.map((pessoa) => {
        const entradasPessoa = entradas.filter((e) => e.pessoa === pessoa).filter(porPeriodo);
        const gastosPessoa = gastos.filter((g) => g.pessoa === pessoa).filter(porPeriodo);
        const totalEntradasPessoa = somar(entradasPessoa);
        const totalGastosPessoa = somar(gastosPessoa);
        return {
          pessoa,
          totalEntradas: totalEntradasPessoa,
          totalGastos: totalGastosPessoa,
          saldo: totalEntradasPessoa - totalGastosPessoa,
          principaisCategorias: agruparPorCategoria(gastosPessoa, 3),
        };
      })
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espaco-lg)' }}>
      <div className={styles.filtros}>
        <Select className={styles.filtroSelect} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          <option value="tudo">Todo o período</option>
          <option value="atual">Este mês</option>
          <option value="anterior">Mês passado</option>
        </Select>
        {pessoas.length > 1 && (
          <div className={styles.seletorPessoa} role="group" aria-label="Filtrar por pessoa">
            <button
              type="button"
              className={`${styles.opcaoPessoa} ${filtroPessoa === 'todos' ? styles.opcaoPessoaAtiva : ''}`}
              onClick={() => setFiltroPessoa('todos')}
            >
              <Users size={15} />
              Todos
              {filtroPessoa === 'todos' && <Check size={14} />}
            </button>
            {pessoas.map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.opcaoPessoa} ${filtroPessoa === p ? styles.opcaoPessoaAtiva : ''}`}
                onClick={() => setFiltroPessoa(p)}
              >
                <Avatar nome={p} tamanho="pequeno" />
                {p}
                {filtroPessoa === p && <Check size={14} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {mostrarComparativo && (
        <Panel icone={Users} titulo="Comparativo entre Pessoas" subtitulo={subtituloPeriodo}>
          <div className={styles.gradeComparativo}>
            {comparativoPorPessoa.map((item) => (
              <Card key={item.pessoa} className={styles.cardPessoa}>
                <div className={styles.cabecalhoCardPessoa}>
                  <Avatar nome={item.pessoa} />
                  <span>{item.pessoa}</span>
                </div>
                <div className={styles.linhasCardPessoa}>
                  <div className={styles.linhaCardPessoa}>
                    <span>Entradas</span>
                    <span className="valor-positivo">{formatarMoeda(item.totalEntradas)}</span>
                  </div>
                  <div className={styles.linhaCardPessoa}>
                    <span>Gastos</span>
                    <span className="valor-negativo">{formatarMoeda(item.totalGastos)}</span>
                  </div>
                  <div className={styles.linhaCardPessoa}>
                    <span>Saldo</span>
                    <span className={item.saldo >= 0 ? 'valor-positivo' : 'valor-negativo'}>
                      {formatarMoeda(item.saldo)}
                    </span>
                  </div>
                </div>
                {item.principaisCategorias.length > 0 && (
                  <div className={styles.categoriasCardPessoa}>
                    <p className={styles.tituloCategoriasCardPessoa}>Maiores gastos</p>
                    {item.principaisCategorias.map((c) => (
                      <div key={c.label} className={styles.linhaCategoriaCardPessoa}>
                        <span>{c.label}</span>
                        <span>{formatarMoeda(c.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </Panel>
      )}

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
