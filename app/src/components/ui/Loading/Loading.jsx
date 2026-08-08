import styles from './Loading.module.css';

export function Loading({ texto = 'Carregando...' }) {
  return (
    <div className={styles.container}>
      <div className={styles.spinner} />
      {texto && <p className={styles.texto}>{texto}</p>}
    </div>
  );
}
