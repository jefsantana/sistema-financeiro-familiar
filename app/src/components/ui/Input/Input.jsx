import { useId } from 'react';
import styles from './Input.module.css';

export function Input({ rotulo, erro, icone: Icone, className = '', id, ...props }) {
  const idGerado = useId();
  const idFinal = id || idGerado;

  return (
    <div className={`${styles.campo} ${className}`}>
      {rotulo && (
        <label htmlFor={idFinal} className={styles.rotulo}>
          {rotulo}
        </label>
      )}
      <div className={styles.envolveEntrada}>
        {Icone && <Icone className={styles.icone} />}
        <input
          id={idFinal}
          className={`${styles.entrada} ${Icone ? styles.comIcone : ''} ${erro ? styles.comErro : ''}`}
          aria-invalid={Boolean(erro)}
          {...props}
        />
      </div>
      {erro && <span className={styles.mensagemErro}>{erro}</span>}
    </div>
  );
}
