import { useEffect, useRef, useState } from 'react';
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
import { CalendarioIntervalo } from '../../components/dashboard/CalendarioIntervalo.jsx';
import { GraficoLinha } from '../../components/charts/GraficoLinha.jsx';
import { GraficoDonut } from '../../components/charts/GraficoDonut.jsx';
import { useDashboardData } from '../../hooks/useDashboardData.js';
import { usePagamentos } from '../../hooks/usePagamentos.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { saudacao, dataPorExtenso, formatarData, nomeExibicao } from '../../utils/formatadores.js';
import {
  somar,
  mesAnoDe,
  calcularAlertasContasFixas,
  calcularAlertasParcelamentos,
  calcularAlertasFaturas,
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

function paraIso(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function primeiroDiaIso(data) {
  return paraIso(data.getFullYear(), data.getMonth() + 1, 1);
}

function ultimoDiaIso(data) {
  const ultimoDia = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  return paraIso(data.getFullYear(), data.getMonth() + 1, ultimoDia);
}

function textoIntervaloMes(data) {
  const ultimoDia = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  return `01 a ${ultimoDia} de ${nomeMesCapitalizado(data)}`;
}

// Datas "AAAA-MM-DD" são tratadas sempre em UTC aqui (mesma convenção
// do resto do app) pra somar/subtrair dias sem risco de escorregar um
// dia por causa do fuso horário local.
function somarDias(iso, dias) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function diferencaEmDias(isoFim, isoInicio) {
  const [anoA, mesA, diaA] = isoInicio.split('-').map(Number);
  const [anoB, mesB, diaB] = isoFim.split('-').map(Number);
  const inicio = Date.UTC(anoA, mesA - 1, diaA);
  const fim = Date.UTC(anoB, mesB - 1, diaB);
  return Math.round((fim - inicio) / 86400000);
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
  const [intervaloPersonalizado, setIntervaloPersonalizado] = useState(null);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [rascunhoInicio, setRascunhoInicio] = useState('');
  const [rascunhoFim, setRascunhoFim] = useState('');
  const seletorRef = useRef(null);

  const dataInicioEfetiva = intervaloPersonalizado?.inicio || primeiroDiaIso(dataReferencia);
  const dataFimEfetiva = intervaloPersonalizado?.fim || ultimoDiaIso(dataReferencia);

  useEffect(() => {
    function aoClicarFora(evento) {
      if (seletorRef.current && !seletorRef.current.contains(evento.target)) setSeletorAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  function mudarMes(deslocamento) {
    setIntervaloPersonalizado(null);
    setDataReferencia((atual) => new Date(atual.getFullYear(), atual.getMonth() + deslocamento, 1));
  }

  function abrirSeletorDeDatas() {
    setRascunhoInicio(dataInicioEfetiva);
    setRascunhoFim(dataFimEfetiva);
    setSeletorAberto((atual) => !atual);
  }

  function aoMudarSelecaoCalendario({ inicio, fim }) {
    setRascunhoInicio(inicio);
    setRascunhoFim(fim);
  }

  function aplicarIntervaloPersonalizado() {
    if (!rascunhoInicio || !rascunhoFim) {
      toast.erro('Selecione a data inicial e a data final no calendário.');
      return;
    }
    setIntervaloPersonalizado({ inicio: rascunhoInicio, fim: rascunhoFim });
    setSeletorAberto(false);
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
  const { entradas, gastos, contasFixas, pagamentos, parcelamentos, pagamentosParcelamentos, metas, orcamentos, cartoes, comprasCartao } =
    dados;

  const hoje = new Date();
  const ehPeriodoAtualReal = !intervaloPersonalizado && mesAnoDe(dataReferencia) === mesAnoDe(hoje);

  // "Período anterior" pra comparação: mesma duração, imediatamente
  // antes do período selecionado — funciona tanto pro mês inteiro
  // quanto pra um intervalo de datas escolhido à mão.
  const duracaoDias = diferencaEmDias(dataFimEfetiva, dataInicioEfetiva) + 1;
  const dataFimAnterior = somarDias(dataInicioEfetiva, -1);
  const dataInicioAnterior = somarDias(dataInicioEfetiva, -duracaoDias);

  const entradasMes = entradas.filter((e) => e.data >= dataInicioEfetiva && e.data <= dataFimEfetiva);
  const gastosMes = gastos.filter((g) => g.data >= dataInicioEfetiva && g.data <= dataFimEfetiva);
  const entradasMesAnterior = entradas.filter((e) => e.data >= dataInicioAnterior && e.data <= dataFimAnterior);
  const gastosMesAnterior = gastos.filter((g) => g.data >= dataInicioAnterior && g.data <= dataFimAnterior);

  const totalEntradasMes = somar(entradasMes);
  const totalSaidasMes = somar(gastosMes);

  // "Saldo Acumulado de Entradas" é a soma de todas as entradas (sem
  // descontar gastos) até o fim do período selecionado, comparável
  // com o fim do período anterior de mesma duração.
  const saldoAtual = somar(entradas.filter((e) => e.data <= dataFimEfetiva));
  const saldoAcumuladoAnterior = somar(entradas.filter((e) => e.data <= dataFimAnterior));
  const tendenciaSaldo = calcularTendencia(saldoAtual, saldoAcumuladoAnterior);

  const alertasContas = calcularAlertasContasFixas(contasFixas, pagamentos);
  const alertasParcelas = calcularAlertasParcelamentos(parcelamentos, pagamentosParcelamentos);
  const alertasFaturas = calcularAlertasFaturas(comprasCartao, cartoes);
  const vencimentos = [...alertasContas, ...alertasParcelas, ...alertasFaturas].sort((a, b) => a.diasRestantes - b.diasRestantes);

  const categoriasMes = agruparPorCategoria(gastosMes);
  const categoriasMesAnterior = agruparPorCategoria(gastosMesAnterior);
  const gastosPorCategoriaMapa = Object.fromEntries(agruparPorCategoria(gastosMes, 999).map((c) => [c.label, c.valor]));
  const resumoMensal = calcularResumoMensal(entradas, gastos);
  const ultimosLancamentos = montarUltimosLancamentos(entradas, gastos);
  const pessoasGasto = agruparPorPessoa(gastosMes);

  const subtituloMes = ehPeriodoAtualReal ? 'este mês' : `${formatarData(dataInicioEfetiva)} a ${formatarData(dataFimEfetiva)}`;
  const textoPeriodo = intervaloPersonalizado
    ? `${formatarData(dataInicioEfetiva)} a ${formatarData(dataFimEfetiva)}`
    : textoIntervaloMes(dataReferencia);

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
            Seu saldo {tendenciaSaldo.subiu ? 'aumentou' : 'diminuiu'} {tendenciaSaldo.percentual}% em relação ao período
            anterior.
          </div>
        )}
        <div className={styles.seletorMesContainer} ref={seletorRef}>
          <div className={styles.seletorMes}>
            <button type="button" className={styles.setaMes} onClick={() => mudarMes(-1)} aria-label="Mês anterior">
              <ChevronLeft size={16} />
            </button>
            <button type="button" className={styles.seletorMesLabel} onClick={abrirSeletorDeDatas}>
              <Calendar size={14} /> {textoPeriodo}
            </button>
            <button type="button" className={styles.setaMes} onClick={() => mudarMes(1)} aria-label="Próximo mês">
              <ChevronRight size={16} />
            </button>
          </div>

          {seletorAberto && (
            <div className={styles.popoverData}>
              <CalendarioIntervalo inicio={rascunhoInicio} fim={rascunhoFim} aoMudar={aoMudarSelecaoCalendario} />
              <div className={styles.popoverAcoes}>
                <Button type="button" variante="secundario" tamanho="pequeno" onClick={() => setSeletorAberto(false)}>
                  Cancelar
                </Button>
                <Button type="button" tamanho="pequeno" onClick={aplicarIntervaloPersonalizado}>
                  Aplicar
                </Button>
              </div>
            </div>
          )}
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
