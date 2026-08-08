import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { Input, Button } from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import styles from './Login.module.css';

function mensagemDeErro(erro) {
  if (!erro) return '';
  if (erro.message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (erro.message.includes('Email not confirmed')) return 'Este e-mail ainda não foi confirmado.';
  return 'Não foi possível entrar. Tente novamente em instantes.';
}

export default function Login() {
  const { usuario, carregando, entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  if (!carregando && usuario) return <Navigate to="/dashboard" replace />;

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await entrar(email, senha);
    setEnviando(false);
    if (error) setErro(error);
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.cartao}>
        <div className={styles.logo}>
          <svg width="32" height="32" viewBox="0 0 30 30" fill="none">
            <circle cx="12" cy="15" r="8" stroke="#7B61FF" strokeWidth="1.8" />
            <circle cx="18" cy="15" r="8" stroke="#FF7A9C" strokeWidth="1.8" />
          </svg>
          <div className={styles.logoTextos}>
            <h1>Jeferson &amp; Raquel</h1>
            <p className={styles.logoSubtitulo}>Controle Financeiro</p>
          </div>
        </div>

        <form className={styles.form} onSubmit={aoEnviar}>
          {erro && <p className={styles.erro}>{mensagemDeErro(erro)}</p>}

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
      </div>
    </div>
  );
}
