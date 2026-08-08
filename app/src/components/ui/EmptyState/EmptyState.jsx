import { Inbox } from 'lucide-react';
import styles from './EmptyState.module.css';

export function EmptyState({ icone: Icone = Inbox, titulo, descricao, acao }) {
  return (
    <div className={styles.container}>
      <div className={styles.icone}>
        <Icone size={26} />
      </div>
      {titulo && <p className={styles.titulo}>{titulo}</p>}
      {descricao && <p className={styles.descricao}>{descricao}</p>}
      {acao && <div className={styles.acao}>{acao}</div>}
    </div>
  );
}
