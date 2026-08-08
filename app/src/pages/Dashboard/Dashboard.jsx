import { TrendingUp, PieChart, Receipt, Bell, Users, Target, Wallet, Sparkles, Calendar } from 'lucide-react';
import { Loading } from '../../components/ui/index.js';
import { Panel } from '../../components/dashboard/Panel.jsx';
import { SummaryCards } from '../../components/dashboard/SummaryCards.jsx';
import { UpcomingBills } from '../../components/dashboard/UpcomingBills.jsx';
import { RecentTransactions } from '../../components/dashboard/RecentTransactions.jsx';
import { SpendingByPerson } from '../../components/dashboard/SpendingByPerson.jsx';
import { GoalsWidget } from '../../components/dashboard/GoalsWidget.jsx';
import { BudgetsWidget } from '../../components/dashboard/BudgetsWidget.jsx';
import { FinancialInsights } from '../../components/dashboard/FinancialInsights.jsx';
import { MonthlyTable } from '../../components/dashboard/MonthlyTable.jsx';
import { GraficoLinha } from '../../components/charts/GraficoLinha.jsx';
import { GraficoDonut } from '../../components/charts/GraficoDonut.jsx';
import { useDashboardData } from '../../hooks/useDashboardData.js';
import { usePagamentos } from '../../hooks/usePagamentos.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { saudacao, dataPorExtenso, nomeMesAno, nomeExibicao } from '../../utils/formatadores.js';
import {
  somar,
  mesAnoDe,
  obterMesAno,
  calcularAlertasContasFixas,
  calcularAlertasParcelamentos,
  agruparPorCategoria,
  agruparPorPessoa,
  calcularResumoMensal,
  montarUltimosLancamentos,
  gerarInsights,
} from '../../utils/financeiro.js';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { dados, carregando, recarregar } = useDashboardData();
  const { perfil, usuario } = useAuth();
  const toast = useToast();
  const { pagar, pagando } = usePagamentos(async () => {
    await recarregar();
    toast.sucesso('Pagamento registrado com sucesso');
  });

  if (carregando || !dados) return <Loading texto="Carregando seu painel financeiro..." />;

  const nomeUsuario = nomeExibicao(perfil, usuario).split(' ')[0] || 'por aí';
  const { entradas, gastos, contasFixas, pagamentos, parcelamentos, pagamentosParcelamentos, metas, orcamentos } = dados;

  const hoje = new Date();
  const mesAtual = mesAnoDe(hoje);
  const mesAnterior = mesAnoDe(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));

  const entradasMes = entradas.filter((e) => obterMesAno(e.data) === mesAtual);
  const gastosMes = gastos.filter((g) => obterMesAno(g.data) === mesAtual);
  const entradasMesAnterior = entradas.filter((e) => obterMesAno(e.data) === mesAnterior);
  const gastosMesAnterior = gastos.filter((g) => obterMesAno(g.data) === mesAnterior);

  const totalEntradasMes = somar(entradasMes);
  const totalSaidasMes = somar(gastosMes);
  const saldoAtual = somar(entradas) - somar(gastos);

  const alertasContas = calcularAlertasContasFixas(contasFixas, pagamentos);
  const alertasParcelas = calcularAlertasParcelamentos(parcelamentos, pagamentosParcelamentos);
  const vencimentos = [...alertasContas, ...alertasParcelas].sort((a, b) => a.diasRestantes - b.diasRestantes);

  const categoriasMes = agruparPorCategoria(gastosMes);
  const categoriasMesAnterior = agruparPorCategoria(gastosMesAnterior);
  const gastosPorCategoriaMapa = Object.fromEntries(agruparPorCategoria(gastosMes, 999).map((c) => [c.label, c.valor]));
  const resumoMensal = calcularResumoMensal(entradas, gastos);
  const ultimosLancamentos = montarUltimosLancamentos(entradas, gastos);
  const pessoasGasto = agruparPorPessoa(gastosMes);

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

      <SummaryCards
        saldoAtual={saldoAtual}
        entradasMes={totalEntradasMes}
        saidasMes={totalSaidasMes}
        entradasMesAnterior={somar(entradasMesAnterior)}
        saidasMesAnterior={somar(gastosMesAnterior)}
      />

      <div className={`${styles.secao} ${styles.grade}`}>
        <Panel icone={TrendingUp} titulo="Evolução Financeira" subtitulo={`últimos ${resumoMensal.length} meses`}>
          <GraficoLinha pontos={[...resumoMensal].reverse().map((m) => ({ mes: m.nomeCurto, entrada: m.entrada, saida: m.saida, saldo: m.saldo }))} />
        </Panel>

        <Panel icone={PieChart} titulo="Gastos por Categoria" subtitulo="este mês">
          <GraficoDonut dados={categoriasMes} />
        </Panel>
      </div>

      <div className={`${styles.secao} ${styles.grade}`}>
        <Panel icone={Receipt} titulo="Últimos Lançamentos">
          <RecentTransactions lancamentos={ultimosLancamentos} />
        </Panel>

        <Panel icone={Bell} titulo="Próximos Vencimentos" subtitulo={nomeMesAno(hoje)}>
          <UpcomingBills vencimentos={vencimentos} aoPagar={pagar} pagando={pagando} />
        </Panel>
      </div>

      <div className={`${styles.secao} ${styles.grade3}`}>
        <Panel icone={Users} titulo="Gastos por Pessoa" subtitulo="este mês">
          <SpendingByPerson dados={pessoasGasto} />
        </Panel>

        <Panel icone={Target} titulo="Metas">
          <GoalsWidget metas={metas} />
        </Panel>

        <Panel icone={Wallet} titulo="Orçamento" subtitulo="por categoria">
          <BudgetsWidget orcamentos={orcamentos} gastosPorCategoria={gastosPorCategoriaMapa} />
        </Panel>
      </div>

      <div className={`${styles.secao} ${styles.grade}`}>
        <Panel icone={Sparkles} titulo="Insights Financeiros">
          <FinancialInsights insights={insights} />
        </Panel>

        <Panel icone={Calendar} titulo="Resumo Mensal">
          <MonthlyTable resumo={resumoMensal} />
        </Panel>
      </div>
    </div>
  );
}
