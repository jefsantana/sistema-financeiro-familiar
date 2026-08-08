import styles from './ProgressBar.module.css';

export function ProgressBar({ percentual, cor = 'primaria' }) {
  const valor = Math.min(100, Math.max(0, percentual));
  return (
    <div className={styles.trilho} role="progressbar" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={100}>
      <div className={`${styles.preenchida} ${styles[cor] || ''}`} style={{ width: `${valor}%` }} />
    </div>
  );
}
