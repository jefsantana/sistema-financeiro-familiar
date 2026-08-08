import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, LogOut, Heart, ImagePlus } from 'lucide-react';
import { NAV_ITEMS } from '../../utils/constantes.js';
import { ICONES_NAV } from '../../utils/icones.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useFotoCasal } from '../../hooks/useFotoCasal.js';
import { Avatar } from '../../components/ui/index.js';
import { AjustarFotoCasalModal } from '../../components/sidebar/AjustarFotoCasalModal.jsx';
import { AjustarFotoPerfilModal } from '../../components/sidebar/AjustarFotoPerfilModal.jsx';
import { nomeExibicao } from '../../utils/formatadores.js';
import styles from './Sidebar.module.css';

const GRUPOS_NAV = [...new Set(NAV_ITEMS.map((item) => item.grupo))].map((grupo) => ({
  grupo,
  itens: NAV_ITEMS.filter((item) => item.grupo === grupo),
}));

export function Sidebar({ aberta, recolhida, aoFechar, aoAlternarRecolhida }) {
  const { perfil, usuario, familia, pessoas, sair, atualizarFotoPessoal } = useAuth();
  const toast = useToast();
  const nomeExibido = usuario ? nomeExibicao(perfil, usuario) : '';
  const inputFotoRef = useRef(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const { foto: fotoCasal, posicao: posicaoFotoCasal, salvar: salvarFotoCasal } = useFotoCasal(perfil?.familia_id);

  const inputFotoPerfilRef = useRef(null);
  const [arquivoFotoPerfil, setArquivoFotoPerfil] = useState(null);
  const posicaoPropria = pessoas.indexOf(nomeExibido);

  function aoSelecionarFoto(evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    if (arquivo) setArquivoSelecionado(arquivo);
  }

  async function aoConfirmarFoto(dataUrl, posicao) {
    try {
      await salvarFotoCasal(dataUrl, posicao);
      toast.sucesso('Foto do casal atualizada');
    } catch {
      toast.erro('Não foi possível salvar a foto. Tente novamente.');
    }
  }

  function aoSelecionarFotoPerfil(evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    if (arquivo) setArquivoFotoPerfil(arquivo);
  }

  async function aoConfirmarFotoPerfil(dataUrl) {
    try {
      await atualizarFotoPessoal(posicaoPropria, dataUrl);
      toast.sucesso('Foto de perfil atualizada');
    } catch {
      toast.erro('Não foi possível salvar a foto. Tente novamente.');
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

        <button
          type="button"
          className={`${styles.fotoCasal} ${fotoCasal ? styles.fotoCasalPreenchida : ''}`}
          onClick={() => inputFotoRef.current?.click()}
          title={fotoCasal ? 'Trocar foto do casal' : 'Adicionar foto do casal'}
        >
          {fotoCasal ? (
            <img
              src={fotoCasal}
              alt="Foto do casal"
              className={styles.fotoCasalImagem}
              style={{ objectPosition: `center ${posicaoFotoCasal}%` }}
            />
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
        <AjustarFotoCasalModal
          arquivo={arquivoSelecionado}
          posicaoInicial={posicaoFotoCasal}
          aoFechar={() => setArquivoSelecionado(null)}
          aoConfirmar={aoConfirmarFoto}
        />
        <input
          ref={inputFotoPerfilRef}
          type="file"
          accept="image/*"
          className={styles.fotoCasalEntrada}
          onChange={aoSelecionarFotoPerfil}
        />
        <AjustarFotoPerfilModal
          arquivo={arquivoFotoPerfil}
          aoFechar={() => setArquivoFotoPerfil(null)}
          aoConfirmar={aoConfirmarFotoPerfil}
        />

        <div className={styles.rodape}>
          {nomeExibido && (
            <div className={styles.usuario}>
              {posicaoPropria >= 0 ? (
                <button
                  type="button"
                  className={styles.botaoAvatar}
                  onClick={() => inputFotoPerfilRef.current?.click()}
                  title="Alterar sua foto"
                >
                  <Avatar nome={nomeExibido} tamanho="pequeno" />
                </button>
              ) : (
                <Avatar nome={nomeExibido} tamanho="pequeno" />
              )}
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
