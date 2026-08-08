import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, LogOut, Heart, ImagePlus } from 'lucide-react';
import { NAV_ITEMS } from '../../utils/constantes.js';
import { ICONES_NAV } from '../../utils/icones.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Avatar } from '../../components/ui/index.js';
import { nomeExibicao } from '../../utils/formatadores.js';
import styles from './Sidebar.module.css';

const GRUPOS_NAV = [...new Set(NAV_ITEMS.map((item) => item.grupo))].map((grupo) => ({
  grupo,
  itens: NAV_ITEMS.filter((item) => item.grupo === grupo),
}));

const CHAVE_FOTO_CASAL = 'sffm:v1:fotoCasal';
const LARGURA_MAXIMA_FOTO = 320;

function redimensionarImagem(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(leitor.error);
    leitor.onload = () => {
      const imagem = new Image();
      imagem.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      imagem.onload = () => {
        const escala = Math.min(1, LARGURA_MAXIMA_FOTO / imagem.width);
        const canvas = document.createElement('canvas');
        canvas.width = imagem.width * escala;
        canvas.height = imagem.height * escala;
        canvas.getContext('2d').drawImage(imagem, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      imagem.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });
}

export function Sidebar({ aberta, recolhida, aoFechar, aoAlternarRecolhida }) {
  const { perfil, usuario, sair } = useAuth();
  const toast = useToast();
  const nomeExibido = usuario ? nomeExibicao(perfil, usuario) : '';
  const inputFotoRef = useRef(null);
  const [fotoCasal, setFotoCasal] = useState(() => localStorage.getItem(CHAVE_FOTO_CASAL) || '');

  async function aoSelecionarFoto(evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!arquivo) return;

    try {
      const dataUrl = await redimensionarImagem(arquivo);
      localStorage.setItem(CHAVE_FOTO_CASAL, dataUrl);
      setFotoCasal(dataUrl);
      toast.sucesso('Foto do casal atualizada');
    } catch {
      toast.erro('Não foi possível usar essa imagem. Tente outra foto.');
    }
  }

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
            <h1>Jeferson &amp; Raquel</h1>
            <p className={styles.logoSubtitulo}>Finanças em dupla</p>
          </div>
        </div>

        <ul className={styles.menu}>
          {GRUPOS_NAV.map(({ grupo, itens }) => (
            <li key={grupo}>
              <p className={styles.grupoTitulo}>{grupo}</p>
              <ul className={styles.grupoLista}>
                {itens.map((item) => {
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
            </li>
          ))}
        </ul>

        <button
          type="button"
          className={styles.fotoCasal}
          onClick={() => inputFotoRef.current?.click()}
          title={fotoCasal ? 'Trocar foto do casal' : 'Adicionar foto do casal'}
        >
          {fotoCasal ? (
            <img src={fotoCasal} alt="Foto do casal" className={styles.fotoCasalImagem} />
          ) : (
            <>
              <ImagePlus size={16} />
              <span>Foto do casal</span>
            </>
          )}
        </button>
        <input
          ref={inputFotoRef}
          type="file"
          accept="image/*"
          className={styles.fotoCasalEntrada}
          onChange={aoSelecionarFoto}
        />

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
