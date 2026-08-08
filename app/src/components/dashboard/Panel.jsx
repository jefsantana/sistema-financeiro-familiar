import { Card } from '../ui/index.js';
import styles from './Panel.module.css';

export function Panel({ titulo, icone: Icone, subtitulo, acao, children, className = '' }) {
  return (
    <Card className={className}>
      <div className={styles.cabecalho}>
        <p className={styles.titulo}>
          {Icone && <Icone size={16} className={styles.icone} />}
          {titulo}
          {subtitulo && <span className={styles.subtitulo}>{subtitulo}</span>}
        </p>
        {acao}
      </div>
      {children}
    </Card>
  );
}
