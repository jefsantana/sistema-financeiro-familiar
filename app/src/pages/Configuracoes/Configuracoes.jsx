import { useRef, useState } from 'react';
import { Settings, Pencil } from 'lucide-react';
import { Card, Button, Avatar } from '../../components/ui/index.js';
import { AjustarFotoPerfilModal } from '../../components/configuracoes/AjustarFotoPerfilModal.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { nomeExibicao, posicaoDaPessoa } from '../../utils/formatadores.js';
import styles from './Configuracoes.module.css';

export default function Configuracoes() {
  const { ehEscuro, alternarTema } = useTheme();
  const { perfil, usuario, sair, pessoas, atualizarFotoPessoal } = useAuth();
  const toast = useToast();
  const nomeExibido = nomeExibicao(perfil, usuario);
  const posicaoPropria = posicaoDaPessoa(pessoas, nomeExibido);
  const inputFotoRef = useRef(null);
  const [arquivoFoto, setArquivoFoto] = useState(null);

  function aoSelecionarFoto(evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    if (arquivo) setArquivoFoto(arquivo);
  }

  async function aoConfirmarFoto(dataUrl) {
    try {
      await atualizarFotoPessoal(posicaoPropria, dataUrl);
      toast.sucesso('Foto de perfil atualizada');
    } catch {
      toast.erro('Não foi possível salvar a foto. Tente novamente.');
    }
  }

  return (
    <div>
      <h1
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontFamily: 'var(--fonte-display)',
          fontSize: '1.2rem',
          fontWeight: 600,
          marginBottom: 'var(--espaco-lg)',
        }}
      >
        <Settings size={20} style={{ color: 'var(--cor-primaria)' }} /> Configurações
      </h1>

      <Card className={styles.secao}>
        <div className={styles.linha}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espaco-sm)' }}>
            {posicaoPropria >= 0 ? (
              <button
                type="button"
                className={styles.botaoAvatar}
                onClick={() => inputFotoRef.current?.click()}
                title="Alterar sua foto"
              >
                <Avatar nome={nomeExibido} />
                <span className={styles.marcadorEditar}>
                  <Pencil size={11} />
                </span>
              </button>
            ) : (
              <Avatar nome={nomeExibido} />
            )}
            <div>
              <p className={styles.rotuloLinha}>{nomeExibido}</p>
              <p className={styles.descricaoLinha}>{usuario?.email}</p>
            </div>
          </div>
          <Button variante="secundario" tamanho="pequeno" onClick={sair}>
            Sair
          </Button>
        </div>
      </Card>

      <input ref={inputFotoRef} type="file" accept="image/*" className={styles.entradaOculta} onChange={aoSelecionarFoto} />
      <AjustarFotoPerfilModal arquivo={arquivoFoto} aoFechar={() => setArquivoFoto(null)} aoConfirmar={aoConfirmarFoto} />

      <Card className={styles.secao}>
        <div className={styles.linha}>
          <div>
            <p className={styles.rotuloLinha}>Modo escuro</p>
            <p className={styles.descricaoLinha}>Alterna entre o tema claro e escuro em todo o sistema.</p>
          </div>
          <label className={styles.switch}>
            <input type="checkbox" checked={ehEscuro} onChange={alternarTema} />
            <span className={styles.trilho} />
          </label>
        </div>
      </Card>
    </div>
  );
}
