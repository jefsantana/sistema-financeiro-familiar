import { Wallet, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import { StatCard } from './StatCard.jsx';
import { calcularTendencia } from '../../utils/financeiro.js';
import styles from './SummaryCards.module.css';

function moedaCompacta(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function SummaryCards({
  saldoAtual,
  tendenciaSaldo,
  entradasMes,
  saidasMes,
  entradasMesAnterior,
  saidasMesAnterior,
  pessoasEntradas = [],
}) {
  const saldoMes = entradasMes - saidasMes;
  const saldoMesAnterior = entradasMesAnterior - saidasMesAnterior;

  return (
    <div className={styles.grade}>
      <StatCard destaque icone={Wallet} rotulo="Saldo Atual" valor={saldoAtual} tendencia={tendenciaSaldo} />
      <StatCard
        icone={TrendingUp}
        corIcone="sucesso"
        rotulo="Entradas do mês"
        valor={entradasMes}
        tendencia={calcularTendencia(entradasMes, entradasMesAnterior)}
        extra={
          pessoasEntradas.length > 1
            ? pessoasEntradas.map((p) => (
                <span key={p.pessoa}>
                  {p.pessoa}: {moedaCompacta(p.valor)}
                </span>
              ))
            : null
        }
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
        rotulo="Saldo do mês"
        valor={saldoMes}
        tendencia={calcularTendencia(saldoMes, saldoMesAnterior)}
      />
    </div>
  );
}
