import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Sidebar } from '../Sidebar/Sidebar.jsx';
import { BottomNav } from '../BottomNav/BottomNav.jsx';
import { Header } from '../Header/Header.jsx';
import { NovoLancamentoModal } from '../../components/lancamentos/NovoLancamentoModal.jsx';
import { useLocalStorage } from '../../hooks/useLocalStorage.js';
import { NAV_ITEMS } from '../../utils/constantes.js';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const location = useLocation();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [sidebarRecolhida, setSidebarRecolhida] = useLocalStorage('sidebarRecolhida', false);
  const [modalLancamentoAberto, setModalLancamentoAberto] = useState(false);

  const paginaAtual = NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));
  const titulo = paginaAtual?.label || 'Dashboard';

  return (
    <>
      <Sidebar
        aberta={menuMobileAberto}
        recolhida={sidebarRecolhida}
        aoFechar={() => setMenuMobileAberto(false)}
        aoAlternarRecolhida={() => setSidebarRecolhida((r) => !r)}
      />

      <div className={`${styles.main} ${sidebarRecolhida ? styles.mainRecolhido : ''}`}>
        <Header titulo={titulo} aoAbrirMenu={() => setMenuMobileAberto(true)} />
        <main className={styles.conteudo}>
          <Outlet />
        </main>
      </div>

      <button
        type="button"
        className={styles.fabDesktop}
        onClick={() => setModalLancamentoAberto(true)}
        aria-label="Novo lançamento"
      >
        <Plus />
      </button>

      <BottomNav aoAbrirNovoLancamento={() => setModalLancamentoAberto(true)} />

      <NovoLancamentoModal aberto={modalLancamentoAberto} aoFechar={() => setModalLancamentoAberto(false)} />
    </>
  );
}
