import { useEffect, useRef, useState } from 'react';
import {
  Settings,
  Pencil,
  KeyRound,
  Trash2,
  UserX,
  Palette,
  Sun,
  Moon,
  MonitorSmartphone,
  Check,
  History,
  Monitor,
  Smartphone,
  AlertTriangle,
} from 'lucide-react';
import { Card, Button, Avatar, Input, ConfirmDialog } from '../../components/ui/index.js';
import { AjustarFotoPerfilModal } from '../../components/configuracoes/AjustarFotoPerfilModal.jsx';
import { useTheme, ACENTOS } from '../../contexts/ThemeContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { nomeExibicao, posicaoDaPessoa } from '../../utils/formatadores.js';
import { limparDadosFamilia, listarHistoricoAcessos } from '../../services/dados.js';
import styles from './Configuracoes.module.css';

function formatarDataAcesso(dataIso) {
  const data = new Date(dataIso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (data.toDateString() === hoje.toDateString()) return `Hoje, ${hora}`;
  if (data.toDateString() === ontem.toDateString()) return `Ontem, ${hora}`;
  return `${data.toLocaleDateString('pt-BR')}, ${hora}`;
}

const TEXTO_CONFIRMACAO_LIMPEZA = 'APAGAR TUDO';
const TEXTO_CONFIRMACAO_CONTA = 'EXCLUIR MINHA CONTA';

export default function Configuracoes() {
  const { tema, setTema, acento, setAcento } = useTheme();
  const { perfil, usuario, sair, pessoas, atualizarFotoPessoal, atualizarSenha, excluirConta } = useAuth();
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

  const [exclusaoAberta, setExclusaoAberta] = useState(false);
  const [textoExclusao, setTextoExclusao] = useState('');

  const [historicoAcessos, setHistoricoAcessos] = useState([]);
  useEffect(() => {
    // Pede os 2 mais recentes: o [0] é sempre a sessão atual (você,
    // agora), o [1] é o acesso anterior — que é o que vale mostrar
    // como "Último acesso" (mesma lógica do Gmail e afins).
    listarHistoricoAcessos(2)
      .then(setHistoricoAcessos)
      .catch(() => {});
  }, []);
  const acessoAnterior = historicoAcessos[1];

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

  async function aoConfirmarExclusaoConta() {
    const { error } = await excluirConta();
    if (error) {
      toast.erro('Não foi possível excluir sua conta. Tente novamente.');
      return;
    }
    setTextoExclusao('');
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
        <div className={`${styles.linha} ${styles.linhaPerfil}`}>
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
        <div className={styles.linhaTitulo}>
          <Palette size={16} style={{ color: 'var(--cor-primaria)' }} />
          <p className={styles.rotuloLinha}>Aparência</p>
        </div>

        <div className={styles.blocoAparencia}>
          <p className={styles.descricaoLinha}>Tema</p>
          <div className={styles.opcoesTema}>
            <button
              type="button"
              className={`${styles.opcaoTema} ${tema === 'light' ? styles.opcaoTemaAtiva : ''}`}
              onClick={() => setTema('light')}
            >
              <Sun size={16} /> Claro
            </button>
            <button
              type="button"
              className={`${styles.opcaoTema} ${tema === 'dark' ? styles.opcaoTemaAtiva : ''}`}
              onClick={() => setTema('dark')}
            >
              <Moon size={16} /> Escuro
            </button>
            <button
              type="button"
              className={`${styles.opcaoTema} ${tema === 'auto' ? styles.opcaoTemaAtiva : ''}`}
              onClick={() => setTema('auto')}
            >
              <MonitorSmartphone size={16} /> Automático
            </button>
          </div>
        </div>

        <div className={styles.blocoAparencia}>
          <p className={styles.descricaoLinha}>Cor de destaque</p>
          <div className={styles.opcoesAcento}>
            {ACENTOS.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                className={`${styles.swatchAcento} ${acento === opcao.valor ? styles.swatchAcentoAtivo : ''}`}
                style={{ background: `linear-gradient(135deg, ${opcao.cores[0]}, ${opcao.cores[1]})` }}
                onClick={() => setAcento(opcao.valor)}
                title={opcao.nome}
                aria-label={opcao.nome}
                aria-pressed={acento === opcao.valor}
              >
                {acento === opcao.valor && <Check size={14} color="#FFFFFF" />}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className={styles.secao}>
        <div className={styles.linhaTitulo}>
          <History size={16} style={{ color: 'var(--cor-primaria)' }} />
          <p className={styles.rotuloLinha}>Histórico de Acessos</p>
        </div>

        {!acessoAnterior ? (
          <p className={styles.descricaoLinha}>
            Este é o seu primeiro acesso registrado — ainda não há um acesso anterior pra mostrar aqui.
          </p>
        ) : (
          <ul className={styles.listaAcessos}>
            {(() => {
              const IconeDispositivo = acessoAnterior.dispositivo === 'mobile' ? Smartphone : Monitor;
              return (
                <li className={styles.itemAcesso}>
                  <div className={styles.iconeAcesso}>
                    <IconeDispositivo size={16} />
                  </div>
                  <div>
                    <p className={styles.rotuloAcesso}>Último acesso</p>
                    <p className={styles.dataAcesso}>{formatarDataAcesso(acessoAnterior.criadoEm)}</p>
                    <p className={styles.descricaoAcesso}>
                      {acessoAnterior.navegador} • {acessoAnterior.sistema}
                    </p>
                  </div>
                </li>
              );
            })()}
          </ul>
        )}
      </Card>

      <div className={styles.tituloAreaPerigo}>
        <AlertTriangle size={16} />
        Área de Perigo
      </div>

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

        <div className={styles.linha}>
          <div>
            <p className={styles.rotuloLinha}>Excluir minha conta</p>
            <p className={styles.descricaoLinha}>
              Apaga seu login permanentemente — você não conseguirá mais entrar com este e-mail. Os dados financeiros
              da família continuam intactos (inclusive pra outra pessoa, se houver). Se quiser apagar os dados
              também, use "Apagar todos os dados" antes.
            </p>
          </div>
          <Button variante="perigo" tamanho="pequeno" icone={UserX} onClick={() => setExclusaoAberta(true)}>
            Excluir conta
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

      <ConfirmDialog
        aberto={exclusaoAberta}
        aoFechar={() => {
          setExclusaoAberta(false);
          setTextoExclusao('');
        }}
        aoConfirmar={aoConfirmarExclusaoConta}
        titulo="Excluir sua conta?"
        mensagem="Essa ação é permanente e não pode ser desfeita. Seu login será apagado e você será desconectado. Os dados financeiros da família não são apagados."
        textoConfirmar="Excluir minha conta"
        confirmarDesabilitado={textoExclusao.trim().toUpperCase() !== TEXTO_CONFIRMACAO_CONTA}
      >
        <Input
          rotulo={`Para confirmar, digite "${TEXTO_CONFIRMACAO_CONTA}"`}
          value={textoExclusao}
          onChange={(e) => setTextoExclusao(e.target.value)}
          placeholder={TEXTO_CONFIRMACAO_CONTA}
        />
      </ConfirmDialog>
    </div>
  );
}
