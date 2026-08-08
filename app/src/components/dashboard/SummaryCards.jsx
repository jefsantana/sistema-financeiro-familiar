import { Wallet, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import { StatCard } from './StatCard.jsx';
import { calcularTendencia } from '../../utils/financeiro.js';
import styles from './SummaryCards.module.css';

export function SummaryCards({ saldoAtual, entradasMes, saidasMes, entradasMesAnterior, saidasMesAnterior }) {
  const economiaMes = entradasMes - saidasMes;
  const economiaMesAnterior = entradasMesAnterior - saidasMesAnterior;

  return (
    <div className={styles.grade}>
      <StatCard destaque icone={Wallet} rotulo="Saldo Atual" valor={saldoAtual} legenda="Acumulado geral" />
      <StatCard
        icone={TrendingUp}
        corIcone="sucesso"
        rotulo="Entradas do mês"
        valor={entradasMes}
        tendencia={calcularTendencia(entradasMes, entradasMesAnterior)}
      />
      <StatCard
        icone={TrendingDown}
        corIcone="perigo"
        rotulo="Gastos do mês"
        valor={saidasMes}
        tendencia={calcularTendencia(saidasMes, saidasMesAnterior, true)}
      />
      <StatCard
        icone={PiggyBank}
        corIcone="info"
        rotulo="Economia do mês"
        valor={economiaMes}
        tendencia={calcularTendencia(economiaMes, economiaMesAnterior)}
      />
    </div>
  );
}
