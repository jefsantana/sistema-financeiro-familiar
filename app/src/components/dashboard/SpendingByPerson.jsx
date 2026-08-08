import { Users } from 'lucide-react';
import { EmptyState, Avatar, ProgressBar } from '../ui/index.js';
import { formatarMoeda } from '../../utils/formatadores.js';
import styles from './SpendingByPerson.module.css';

export function SpendingByPerson({ dados }) {
  if (dados.length === 0) {
    return <EmptyState icone={Users} titulo="Sem gastos ainda" descricao="Assim que houver gastos este mês, a divisão por pessoa aparece aqui." />;
  }

  return (
    <ul className={styles.lista}>
      {dados.map((item) => (
        <li key={item.pessoa} className={styles.item}>
          <Avatar nome={item.pessoa} />
          <div className={styles.info}>
            <div className={styles.cabecalho}>
              <span className={styles.nome}>{item.pessoa}</span>
              <span className={styles.valor}>{formatarMoeda(item.valor)}</span>
            </div>
            <ProgressBar percentual={item.percentual} />
          </div>
          <span className={styles.percentual}>{item.percentual}%</span>
        </li>
      ))}
    </ul>
  );
}
