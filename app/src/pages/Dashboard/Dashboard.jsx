import { useState } from 'react';
import {
  PieChart,
  Receipt,
  Bell,
  Users,
  Target,
  Wallet,
  Sparkles,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Loading, EmptyState, Button } from '../../components/ui/index.js';
import { Panel } from '../../components/dashboard/Panel.jsx';
import { SummaryCards } from '../../components/dashboard/SummaryCards.jsx';
import { UpcomingBills } from '../../components/dashboard/UpcomingBills.jsx';
import { RecentTransactions } from '../../components/dashboard/RecentTransactions.jsx';
import { SpendingByPerson } from '../../components/dashboard/SpendingByPerson.jsx';
import { GoalsWidget } from '../../components/dashboard/GoalsWidget.jsx';
import { BudgetsWidget } from '../../components/dashboard/BudgetsWidget.jsx';
import { FinancialInsights } from '../../components/dashboard/FinancialInsights.jsx';
import { GraficoLinha } from '../../components/charts/GraficoLinha.jsx';
import { GraficoDonut } from '../../components/charts/GraficoDonut.jsx';
import { useDashboardData } from '../../hooks/useDashboardData.js';
import { usePagamentos } from '../../hooks/usePagamentos.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { saudacao, dataPorExtenso, nomeExibicao } from '../../utils/formatadores.js';
import {
  somar,
  mesAnoDe,
  obterMesAno,
  calcularAlertasContasFixas,
  calcularAlertasParcelamentos,
  agruparPorCategoria,
  agruparPorPessoa,
  calcularTendencia,
  calcularResumoMensal,
  montarUltimosLancamentos,
  gerarInsights,
} from '../../utils/financeiro.js';
import styles from './Dashboard.module.css';

function nomeMesCapitalizado(data) {
  const nomeMes = data.toLocaleDateString('pt-BR', { month: 'long' });
  return `${nomeMes.charAt(0).toUpperCase()}${nomeMes.slice(1)}`;
}

function ultimoDiaDoMes(data) {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
}

function textoIntervaloMes(data) {
  return `01 a ${ultimoDiaDoMes(data)} de ${nomeMesCapitalizado(data)}`;
}

export default function Dashboard() {
  const { dados, carregando, erro, recarregar } = useDashboardData();
  const { perfil, usuario } = useAuth();
  const toast = useToast();
  const { pagar, pagando } = usePagamentos(async () => {
    await recarregar();
    toast.sucesso('Pagamento registrado com sucesso');
  });

  const [dataReferencia, setDataReferencia] = useState(() => new Date());

  function mudarMes(deslocamento) {
    setDataReferencia((atual) => new Date(atual.getFullYear(), atual.getMonth() + deslocamento, 1));
  }

  if (erro) {
    return (
      <EmptyState
        icone={AlertTriangle}
        titulo="Não foi possível carregar seu painel"
        descricao="Houve um erro ao buscar seus dados. Tente novamente em instantes."
        acao={<Button onClick={recarregar}>Tentar de novo</Button>}
      />
    );
  }

  if (carregando || !dados) return <Loading texto="Carregando seu painel financeiro..." />;

  const nomeUsuario = nomeExibicao(perfil, usuario).split(' ')[0] || 'por aí';
  const { entradas, gastos, contasFixas, pagamentos, parcelamentos, pagamentosParcelamentos, metas, orcamentos } = dados;

  const hoje = new Date();
  const mesSelecionado = mesAnoDe(dataReferencia);
  const mesAnteriorSelecionado = mesAnoDe(new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() - 1, 1));
  const ehMesAtualReal = mesSelecionado === mesAnoDe(hoje);

  const entradasMes = entradas.filter((e) => obterMesAno(e.data) === mesSelecionado);
  const gastosMes = gastos.filter((g) => obterMesAno(g.data) === mesSelecionado);
  const entradasMesAnterior = entradas.filter((e) => obterMesAno(e.data) === mesAnteriorSelecionado);
  const gastosMesAnterior = gastos.filter((g) => obterMesAno(g.data) === mesAnteriorSelecionado);

  const totalEntradasMes = somar(entradasMes);
  const totalSaidasMes = somar(gastosMes);

  // "Saldo Atual" é o acumulado até o fim do mês selecionado (comparável
  // com o fim do mês anterior, pra dar o percentual de variação).
  const saldoAtual =
    somar(entradas.filter((e) => obterMesAno(e.data) <= mesSelecionado)) -
    somar(gastos.filter((g) => obterMesAno(g.data) <= mesSelecionado));
  const saldoAcumuladoMesAnterior =
    somar(entradas.filter((e) => obterMesAno(e.data) <= mesAnteriorSelecionado)) -
    somar(gastos.filter((g) => obterMesAno(g.data) <= mesAnteriorSelecionado));
  const tendenciaSaldo = calcularTendencia(saldoAtual, saldoAcumuladoMesAnterior);

  const alertasContas = calcularAlertasContasFixas(contasFixas, pagamentos);
  const alertasParcelas = calcularAlertasParcelamentos(parcelamentos, pagamentosParcelamentos);
  const vencimentos = [...alertasContas, ...alertasParcelas].sort((a, b) => a.diasRestantes - b.diasRestantes);

  const categoriasMes = agruparPorCategoria(gastosMes);
  const categoriasMesAnterior = agruparPorCategoria(gastosMesAnterior);
  const gastosPorCategoriaMapa = Object.fromEntries(agruparPorCategoria(gastosMes, 999).map((c) => [c.label, c.valor]));
  const resumoMensal = calcularResumoMensal(entradas, gastos);
  const ultimosLancamentos = montarUltimosLancamentos(entradas, gastos);
  const pessoasGasto = agruparPorPessoa(gastosMes);

  const subtituloMes = ehMesAtualReal
    ? 'este mês'
    : dataReferencia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const insights = gerarInsights({
    categoriasMes,
    categoriasMesAnterior,
    entradasMes: totalEntradasMes,
    saidasMes: totalSaidasMes,
    vencimentos,
    pessoasGasto,
  });

  return (
    <div>
      <div className={styles.saudacao}>
        <h1>{saudacao()}, {nomeUsuario}!</h1>
        <p className={styles.data}>{dataPorExtenso(hoje)}</p>
      </div>

      <div className={styles.faixaTopo}>
        {tendenciaSaldo && (
          <div className={styles.bannerSaldo}>
            {tendenciaSaldo.subiu ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            Seu saldo {tendenciaSaldo.subiu ? 'aumentou' : 'diminuiu'} {tendenciaSaldo.percentual}% em relação ao mês
            passado.
          </div>
        )}
        <div className={styles.seletorMes}>
          <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
            <ChevronLeft size={16} />
          </button>
          <span>
            <Calendar size={14} /> {textoIntervaloMes(dataReferencia)}
          </span>
          <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <SummaryCards
        saldoAtual={saldoAtual}
        tendenciaSaldo={tendenciaSaldo}
        entradasMes={totalEntradasMes}
        saidasMes={totalSaidasMes}
        entradasMesAnterior={somar(entradasMesAnterior)}
        saidasMesAnterior={somar(gastosMesAnterior)}
      />

      <div className={styles.painelPrincipal}>
        <div className={`${styles.grade} ${styles.grupo}`}>
          <div className={styles.itemGrafico}>
            <Panel
              icone={TrendingUp}
              titulo="Evolução Financeira"
              subtitulo={resumoMensal.length === 1 ? 'último mês' : `últimos ${resumoMensal.length} meses`}
            >
              <GraficoLinha
                pontos={[...resumoMensal].reverse().map((m) => ({ mes: m.nomeCurto, entrada: m.entrada, saida: m.saida, saldo: m.saldo }))}
              />
            </Panel>
          </div>

          <div className={styles.itemCategoria}>
            <Panel icone={PieChart} titulo="Gastos por Categoria" subtitulo={subtituloMes}>
              <GraficoDonut dados={categoriasMes} />
            </Panel>
          </div>
        </div>

        <div className={`${styles.grade} ${styles.grupo}`}>
          <div className={styles.itemUltimos}>
            <Panel icone={Receipt} titulo="Últimos Lançamentos">
              <RecentTransactions lancamentos={ultimosLancamentos} />
            </Panel>
          </div>

          <div className={styles.itemVencimentos}>
            <Panel icone={Bell} titulo="Próximos Vencimentos" subtitulo={subtituloMes}>
              <UpcomingBills vencimentos={vencimentos} aoPagar={pagar} pagando={pagando} />
            </Panel>
          </div>
        </div>

        <div className={styles.itemInsights}>
          <Panel icone={Sparkles} titulo="Insights Financeiros">
            <FinancialInsights insights={insights} />
          </Panel>
        </div>

        <div className={`${styles.grade3} ${styles.grupo}`}>
          <div className={styles.itemPessoa}>
            <Panel icone={Users} titulo="Gastos por Pessoa" subtitulo={subtituloMes}>
              <SpendingByPerson dados={pessoasGasto} />
            </Panel>
          </div>

          <div className={styles.itemMetas}>
            <Panel icone={Target} titulo="Metas">
              <GoalsWidget metas={metas} />
            </Panel>
          </div>

          <div className={styles.itemOrcamento}>
            <Panel icone={Wallet} titulo="Orçamento" subtitulo={subtituloMes}>
              <BudgetsWidget orcamentos={orcamentos} gastosPorCategoria={gastosPorCategoriaMapa} />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
