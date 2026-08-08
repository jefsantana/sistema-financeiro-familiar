import { Loader2 } from 'lucide-react';
import styles from './Button.module.css';

export function Button({
  children,
  variante = 'primario',
  tamanho = 'normal',
  larguraTotal = false,
  carregando = false,
  icone: Icone,
  className = '',
  disabled,
  type = 'button',
  ...props
}) {
  const classes = [
    styles.botao,
    styles[variante],
    tamanho === 'pequeno' && styles.pequeno,
    tamanho === 'grande' && styles.grande,
    larguraTotal && styles.larguraTotal,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || carregando} {...props}>
      {carregando ? (
        <Loader2 className={`${styles.icone} ${styles.girando}`} />
      ) : (
        Icone && <Icone className={styles.icone} />
      )}
      {children}
    </button>
  );
}
