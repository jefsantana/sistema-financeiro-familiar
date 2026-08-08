import { useRef, useState } from 'react';
import { Settings, Pencil, KeyRound, Trash2 } from 'lucide-react';
import { Card, Button, Avatar, Input, ConfirmDialog } from '../../components/ui/index.js';
import { AjustarFotoPerfilModal } from '../../components/configuracoes/AjustarFotoPerfilModal.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { nomeExibicao, posicaoDaPessoa } from '../../utils/formatadores.js';
import { limparDadosFamilia } from '../../services/dados.js';
import styles from './Configuracoes.module.css';

const TEXTO_CONFIRMACAO_LIMPEZA = 'APAGAR TUDO';

export default function Configuracoes() {
  const { ehEscuro, alternarTema } = useTheme();
  const { perfil, usuario, sair, pessoas, atualizarFotoPessoal, atualizarSenha } = useAuth();
  const toast = useToast();
  const nomeExibido = nomeExibicao(perfil, usuario);
  const posicaoPropria = posicaoDaPessoa(pessoas, nomeExibido);
  const inputFotoRef = useRef(null);
  const [arquivoFoto, setArquivoFoto] = useState(null);

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState(null);

  const [limpezaAberta, setLimpezaAberta] = useState(false);
  const [textoLimpeza, setTextoLimpeza] = useState('');

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

  async function aoTrocarSenha(evento) {
    evento.preventDefault();
    setErroSenha(null);

    if (novaSenha.length < 6) {
      setErroSenha('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErroSenha('As senhas não são iguais.');
      return;
    }

    setSalvandoSenha(true);
    const { error } = await atualizarSenha(novaSenha);
    setSalvandoSenha(false);

    if (error) {
      setErroSenha('Não foi possível trocar a senha. Tente novamente.');
      return;
    }

    setNovaSenha('');
    setConfirmarSenha('');
    toast.sucesso('Senha atualizada com sucesso');
  }

  async function aoConfirmarLimpeza() {
    try {
      await limparDadosFamilia(perfil.familia_id);
      toast.sucesso('Todos os dados foram apagados');
    } catch {
      toast.erro('Não foi possível apagar os dados. Tente novamente.');
    } finally {
      setTextoLimpeza('');
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
        <div className={styles.linhaTitulo}>
          <KeyRound size={16} style={{ color: 'var(--cor-primaria)' }} />
          <p className={styles.rotuloLinha}>Alterar senha</p>
        </div>
        <form className={styles.formSenha} onSubmit={aoTrocarSenha}>
          {erroSenha && <p className={styles.erroSenha}>{erroSenha}</p>}
          <Input
            rotulo="Nova senha"
            type="password"
            minLength={6}
            autoComplete="new-password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder="Mínimo de 6 caracteres"
          />
          <Input
            rotulo="Confirmar nova senha"
            type="password"
            minLength={6}
            autoComplete="new-password"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            placeholder="Repita a nova senha"
          />
          <Button type="submit" variante="secundario" tamanho="pequeno" carregando={salvandoSenha}>
            Salvar nova senha
          </Button>
        </form>
      </Card>

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

      <Card className={`${styles.secao} ${styles.zonaPerigo}`}>
        <div className={styles.linha}>
          <div>
            <p className={styles.rotuloLinha}>Apagar todos os dados</p>
            <p className={styles.descricaoLinha}>
              Remove permanentemente todos os lançamentos, contas fixas, parcelamentos, cartões, metas e categorias da
              família — como se fosse uma conta recém-criada. Não afeta seu login.
            </p>
          </div>
          <Button variante="perigo" tamanho="pequeno" icone={Trash2} onClick={() => setLimpezaAberta(true)}>
            Apagar tudo
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        aberto={limpezaAberta}
        aoFechar={() => {
          setLimpezaAberta(false);
          setTextoLimpeza('');
        }}
        aoConfirmar={aoConfirmarLimpeza}
        titulo="Apagar todos os dados?"
        mensagem="Essa ação é permanente e não pode ser desfeita. Todos os lançamentos, contas, cartões, metas e categorias da família serão apagados para sempre — inclusive os da outra pessoa da família, se houver."
        textoConfirmar="Apagar tudo"
        confirmarDesabilitado={textoLimpeza.trim().toUpperCase() !== TEXTO_CONFIRMACAO_LIMPEZA}
      >
        <Input
          rotulo={`Para confirmar, digite "${TEXTO_CONFIRMACAO_LIMPEZA}"`}
          value={textoLimpeza}
          onChange={(e) => setTextoLimpeza(e.target.value)}
          placeholder={TEXTO_CONFIRMACAO_LIMPEZA}
        />
      </ConfirmDialog>
    </div>
  );
}
