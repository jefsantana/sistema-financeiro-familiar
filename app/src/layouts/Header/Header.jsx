import { Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import styles from './Header.module.css';

export function Header({ titulo, eyebrow = 'Painel', aoAbrirMenu }) {
  const { ehEscuro, alternarTema } = useTheme();

  return (
    <header className={styles.header}>
      <div className={styles.grupoEsquerda}>
        <button type="button" className={`${styles.botaoIcone} ${styles.botaoMenu}`} onClick={aoAbrirMenu} aria-label="Abrir menu">
          <Menu />
        </button>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 className={styles.titulo}>{titulo}</h2>
        </div>
      </div>

      <div className={styles.grupoDireita}>
        <button
          type="button"
          className={styles.botaoIcone}
          onClick={alternarTema}
          aria-label="Alternar modo claro/escuro"
        >
          {ehEscuro ? <Sun /> : <Moon />}
        </button>
      </div>
    </header>
  );
}
