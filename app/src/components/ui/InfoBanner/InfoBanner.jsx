import { Info } from 'lucide-react';
import styles from './InfoBanner.module.css';

export function InfoBanner({ children }) {
  return (
    <div className={styles.banner}>
      <Info size={16} className={styles.icone} />
      <p>{children}</p>
    </div>
  );
}
