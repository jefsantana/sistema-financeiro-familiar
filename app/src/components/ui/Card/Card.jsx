import styles from './Card.module.css';

const PREENCHIMENTOS = {
  normal: styles.preenchimentoNormal,
  pequeno: styles.preenchimentoPequeno,
  nenhum: styles.preenchimentoNenhum,
};

export function Card({ children, comHover = false, preenchimento = 'normal', className = '', ...props }) {
  const classes = [styles.card, comHover && styles.comHover, PREENCHIMENTOS[preenchimento], className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
