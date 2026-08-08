import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Select.module.css';

export function Select({ rotulo, className = '', id, children, ...props }) {
  const idGerado = useId();
  const idFinal = id || idGerado;

  return (
    <div className={`${styles.campo} ${className}`}>
      {rotulo && (
        <label htmlFor={idFinal} className={styles.rotulo}>
          {rotulo}
        </label>
      )}
      <div className={styles.envolveSelect}>
        <select id={idFinal} className={styles.select} {...props}>
          {children}
        </select>
        <ChevronDown className={styles.seta} />
      </div>
    </div>
  );
}
