import { Target } from 'lucide-react';
import { EmptyState, ProgressBar } from '../ui/index.js';
import { formatarMoeda } from '../../utils/formatadores.js';
import styles from './GoalsWidget.module.css';

export function GoalsWidget({ metas }) {
  if (metas.length === 0) {
    return <EmptyState icone={Target} titulo="Nenhuma meta ainda" descricao="Crie uma meta financeira para acompanhar seu progresso aqui." />;
  }

  return (
    <ul className={styles.lista}>
      {metas.map((meta) => {
        const percentual = Math.min(100, Math.round((Number(meta.valorAtual) / Number(meta.valorAlvo)) * 100));
        return (
          <li key={meta.id} className={styles.item}>
            <div className={styles.cabecalho}>
              <span className={styles.descricao}>{meta.descricao}</span>
              <span className={styles.percentual}>{percentual}%</span>
            </div>
            <ProgressBar percentual={percentual} cor="sucesso" />
            <span className={styles.valores}>
              {formatarMoeda(meta.valorAtual)} de {formatarMoeda(meta.valorAlvo)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
