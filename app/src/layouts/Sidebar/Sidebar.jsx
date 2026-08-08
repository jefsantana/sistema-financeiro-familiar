import { NavLink } from 'react-router-dom';
import { PanelLeftClose, LogOut, Heart } from 'lucide-react';
import { NAV_ITEMS } from '../../utils/constantes.js';
import { ICONES_NAV } from '../../utils/icones.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { Avatar } from '../../components/ui/index.js';
import { nomeExibicao } from '../../utils/formatadores.js';
import styles from './Sidebar.module.css';

const GRUPOS_NAV = [...new Set(NAV_ITEMS.map((item) => item.grupo))].map((grupo) => ({
  grupo,
  itens: NAV_ITEMS.filter((item) => item.grupo === grupo),
}));

export function Sidebar({ aberta, recolhida, aoFechar, aoAlternarRecolhida }) {
  const { perfil, usuario, familia, pessoas, sair } = useAuth();
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
          <div className={styles.logoIcone}>
            <Heart size={16} fill="currentColor" />
          </div>
          <div className={styles.logoTextos}>
            <h1>{familia?.nome || 'Minha família'}</h1>
            <p className={styles.logoSubtitulo}>{pessoas.length > 1 ? 'Finanças em dupla' : 'Finanças pessoais'}</p>
          </div>
        </div>

        <ul className={styles.menu}>
          {GRUPOS_NAV.map(({ grupo, itens }) => (
            <li key={grupo}>
              <p className={styles.grupoTitulo}>{grupo}</p>
              <ul className={styles.grupoLista}>
                {itens.map((item) => {
                  const Icone = ICONES_NAV[item.icon];
                  const corIcone =
                    item.path === '/entradas' ? styles.iconeEntrada : item.path === '/gastos' ? styles.iconeGasto : '';
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) => `${styles.link} ${isActive ? styles.linkAtivo : ''}`}
                        onClick={aoFechar}
                      >
                        <Icone className={corIcone} />
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
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
