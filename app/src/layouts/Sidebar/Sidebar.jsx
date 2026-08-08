import { NavLink } from 'react-router-dom';
import { PanelLeftClose, LogOut } from 'lucide-react';
import { NAV_ITEMS } from '../../utils/constantes.js';
import { ICONES_NAV } from '../../utils/icones.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { Avatar } from '../../components/ui/index.js';
import { nomeExibicao } from '../../utils/formatadores.js';
import styles from './Sidebar.module.css';

export function Sidebar({ aberta, recolhida, aoFechar, aoAlternarRecolhida }) {
  const { perfil, usuario, sair } = useAuth();
  const nomeExibido = usuario ? nomeExibicao(perfil, usuario) : '';

  return (
    <>
      <nav
        className={[styles.sidebar, aberta && styles.sidebarAberta, recolhida && styles.sidebarRecolhida]
          .filter(Boolean)
          .join(' ')}
        aria-label="Menu principal"
      >
        <div className={styles.logo}>
          <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
            <circle cx="12" cy="15" r="8" stroke="#7B61FF" strokeWidth="1.8" />
            <circle cx="18" cy="15" r="8" stroke="#FF7A9C" strokeWidth="1.8" />
          </svg>
          <div className={styles.logoTextos}>
            <h1>Jeferson &amp; Raquel</h1>
            <p className={styles.logoSubtitulo}>Controle Financeiro</p>
          </div>
        </div>

        <ul className={styles.menu}>
          {NAV_ITEMS.map((item) => {
            const Icone = ICONES_NAV[item.icon];
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `${styles.link} ${isActive ? styles.linkAtivo : ''}`}
                  onClick={aoFechar}
                >
                  <Icone />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>

        <div className={styles.rodape}>
          {nomeExibido && (
            <div className={styles.usuario}>
              <Avatar nome={nomeExibido} tamanho="pequeno" />
              <span className={styles.usuarioNome}>{nomeExibido}</span>
              <button type="button" className={styles.botaoSair} onClick={sair} aria-label="Sair da conta" title="Sair">
                <LogOut />
              </button>
            </div>
          )}
          <button type="button" className={styles.botaoRecolher} onClick={aoAlternarRecolhida}>
            <PanelLeftClose />
            <span>Recolher menu</span>
          </button>
        </div>
      </nav>
      <div className={`${styles.overlay} ${aberta ? styles.overlayAtivo : ''}`} onClick={aoFechar} />
    </>
  );
}
