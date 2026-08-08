import { NavLink } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { NAV_ITEMS_MOBILE } from '../../utils/constantes.js';
import { ICONES_NAV } from '../../utils/icones.js';
import styles from './BottomNav.module.css';

export function BottomNav({ aoAbrirNovoLancamento }) {
  const [esquerda, direita] = [NAV_ITEMS_MOBILE.slice(0, 2), NAV_ITEMS_MOBILE.slice(2)];

  return (
    <nav className={styles.nav} aria-label="Navegação principal">
      {esquerda.map((item) => (
        <ItemNav key={item.path} item={item} />
      ))}

      <div className={styles.botaoCentral}>
        <button type="button" className={styles.fab} onClick={aoAbrirNovoLancamento} aria-label="Novo lançamento">
          <Plus />
        </button>
      </div>

      {direita.map((item) => (
        <ItemNav key={item.path} item={item} />
      ))}
    </nav>
  );
}

function ItemNav({ item }) {
  const Icone = ICONES_NAV[item.icon];
  return (
    <NavLink to={item.path} className={({ isActive }) => `${styles.item} ${isActive ? styles.itemAtivo : ''}`}>
      <Icone />
      <span>{item.label}</span>
    </NavLink>
  );
}
