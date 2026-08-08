import styles from './Table.module.css';

export function Table({ children }) {
  return (
    <div className={styles.envolve}>
      <table className={styles.tabela}>{children}</table>
    </div>
  );
}

export function TableColunaAcoes({ children, ...props }) {
  return (
    <td className={styles.colunaAcoes} {...props}>
      {children}
    </td>
  );
}

export function TableColunaNumerica({ children, ...props }) {
  return (
    <td className={styles.colunaNumerica} {...props}>
      {children}
    </td>
  );
}

export function TableBotaoAcao({ children, ...props }) {
  return (
    <button type="button" className={styles.botaoAcao} {...props}>
      {children}
    </button>
  );
}
