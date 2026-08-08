import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail, Lock, User, Heart } from 'lucide-react';
import { Input, Button } from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import styles from './Login.module.css';

function mensagemDeErroEntrar(erro) {
  if (!erro) return '';
  if (erro.message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (erro.message.includes('Email not confirmed')) return 'Este e-mail ainda não foi confirmado.';
  return 'Não foi possível entrar. Tente novamente em instantes.';
}

function mensagemDeErroCadastrar(erro) {
  if (!erro) return '';
  if (erro.message.includes('already registered')) return 'Já existe uma conta com esse e-mail.';
  if (erro.message.includes('Password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
  return 'Não foi possível criar a conta. Tente novamente em instantes.';
}

export default function Login() {
  const { usuario, carregando, entrar, cadastrar } = useAuth();
  const [modo, setModo] = useState('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [pessoa2, setPessoa2] = useState('');
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [enviando, setEnviando] = useState(false);

  if (!carregando && usuario) return <Navigate to="/dashboard" replace />;

  function trocarModo(novoModo) {
    setModo(novoModo);
    setErro(null);
    setMensagem(null);
  }

  async function aoEntrar(evento) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await entrar(email, senha);
    setEnviando(false);
    if (error) setErro(mensagemDeErroEntrar(error));
  }

  async function aoCadastrar(evento) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    const { data, error } = await cadastrar(email, senha, { nome, pessoa2 });
    setEnviando(false);

    if (error) {
      setErro(mensagemDeErroCadastrar(error));
      return;
    }

    if (data?.session) return; // já entra direto, o redirecionamento acima cuida do resto

    setMensagem('Conta criada! Verifique seu e-mail para confirmar antes de entrar.');
    setModo('entrar');
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.cartao}>
        <div className={styles.logo}>
          <div className={styles.logoIcone}>
            <Heart size={16} fill="currentColor" />
          </div>
          <div className={styles.logoTextos}>
            <h1>Controle Financeiro</h1>
            <p className={styles.logoSubtitulo}>Familiar ou pessoal</p>
          </div>
        </div>

        <div className={styles.abas}>
          <button
            type="button"
            className={`${styles.aba} ${modo === 'entrar' ? styles.abaAtiva : ''}`}
            onClick={() => trocarModo('entrar')}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`${styles.aba} ${modo === 'cadastrar' ? styles.abaAtiva : ''}`}
            onClick={() => trocarModo('cadastrar')}
          >
            Cadastrar
          </button>
        </div>

        {erro && <p className={styles.erro}>{erro}</p>}
        {mensagem && <p className={styles.mensagem}>{mensagem}</p>}

        {modo === 'entrar' ? (
          <form className={styles.form} onSubmit={aoEntrar}>
            <Input
              rotulo="E-mail"
              type="email"
              icone={Mail}
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
            <Input
              rotulo="Senha"
              type="password"
              icone={Lock}
              required
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
            />
            <Button type="submit" larguraTotal carregando={enviando} className={styles.botaoEntrar}>
              Entrar
            </Button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={aoCadastrar}>
            <Input
              rotulo="Seu nome"
              icone={User}
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Maria"
            />
            <Input
              rotulo="Nome da segunda pessoa (opcional)"
              icone={User}
              value={pessoa2}
              onChange={(e) => setPessoa2(e.target.value)}
              placeholder="Deixe em branco se for só você"
            />
            <Input
              rotulo="E-mail"
              type="email"
              icone={Mail}
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
            <Input
              rotulo="Senha"
              type="password"
              icone={Lock}
              required
              minLength={6}
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
            />
            <Button type="submit" larguraTotal carregando={enviando} className={styles.botaoEntrar}>
              Criar conta
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
