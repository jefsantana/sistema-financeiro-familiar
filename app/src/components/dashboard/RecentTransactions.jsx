import { ArrowUp, ArrowDown, Receipt } from 'lucide-react';
import { EmptyState, Avatar } from '../ui/index.js';
import { formatarData, formatarMoeda } from '../../utils/formatadores.js';
import styles from './RecentTransactions.module.css';

export function RecentTransactions({ lancamentos }) {
  if (lancamentos.length === 0) {
    return <EmptyState icone={Receipt} titulo="Nenhum lançamento" descricao="Seus últimos lançamentos aparecerão aqui." />;
  }

  return (
    <ul className={styles.lista}>
      {lancamentos.map((item) => (
        <li key={`${item.tipo}-${item.id}`} className={styles.item}>
          <span className={`${styles.icone} ${styles[item.tipo]}`}>
            {item.tipo === 'entrada' ? <ArrowUp /> : <ArrowDown />}
          </span>
          <div className={styles.info}>
            <p className={styles.descricao}>{item.descricao}</p>
            <div className={styles.meta}>
              {item.pessoa && <Avatar nome={item.pessoa} tamanho="pequeno" />}
              {formatarData(item.data)}
            </div>
          </div>
          <span className={styles.valor} style={{ color: item.tipo === 'entrada' ? 'var(--cor-sucesso)' : 'var(--cor-perigo)' }}>
            {item.tipo === 'entrada' ? '+' : '-'} {formatarMoeda(item.valor)}
          </span>
        </li>
      ))}
    </ul>
  );
}
