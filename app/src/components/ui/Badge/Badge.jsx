import styles from './Badge.module.css';

export function Badge({ children, cor = 'neutro', className = '', ...props }) {
  const classes = [styles.badge, styles[cor], className].filter(Boolean).join(' ');
  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
