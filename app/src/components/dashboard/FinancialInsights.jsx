import { Sparkles, TrendingUp, TrendingDown, AlertCircle, Info } from 'lucide-react';
import { EmptyState } from '../ui/index.js';
import styles from './FinancialInsights.module.css';

const ICONES = {
  sucesso: TrendingUp,
  alerta: AlertCircle,
  perigo: TrendingDown,
  info: Info,
  neutro: Sparkles,
};

export function FinancialInsights({ insights }) {
  if (insights.length === 0) {
    return <EmptyState icone={Sparkles} titulo="Tudo tranquilo por aqui" descricao="Assim que houver algo relevante, mostramos aqui." />;
  }

  return (
    <ul className={styles.lista}>
      {insights.map((insight, indice) => {
        const Icone = ICONES[insight.tom] || Sparkles;
        return (
          <li key={indice} className={`${styles.item} ${styles[insight.tom]}`}>
            <span className={styles.icone}>
              <Icone />
            </span>
            {insight.texto}
          </li>
        );
      })}
    </ul>
  );
}
