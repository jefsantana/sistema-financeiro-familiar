import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Heart } from 'lucide-react';
import { Input, Button } from '../../components/ui/index.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import styles from '../Login/Login.module.css';

function mensagemDeErro(erro) {
  if (!erro) return '';
  if (erro.message.includes('Password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (erro.message.includes('session')) return 'Este link expirou. Peça um novo link de redefinição na tela de login.';
  return 'Não foi possível trocar a senha. Tente novamente.';
}

export default function RedefinirSenha() {
  const { atualizarSenha } = useAuth();
  const navegar = useNavigate();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await atualizarSenha(senha);
    setEnviando(false);

    if (error) {
      setErro(mensagemDeErro(error));
      return;
    }

    navegar('/dashboard', { replace: true });
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.cartao}>
        <div className={styles.logo}>
          <div className={styles.logoIcone}>
            <Heart size={16} fill="currentColor" />
          </div>
          <div className={styles.logoTextos}>
            <h1>Nova senha</h1>
            <p className={styles.logoSubtitulo}>Escolha uma senha nova pra sua conta</p>
          </div>
        </div>

        {erro && <p className={styles.erro}>{erro}</p>}

        <form className={styles.form} onSubmit={aoEnviar}>
          <Input
            rotulo="Nova senha"
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
            Salvar nova senha
          </Button>
        </form>
      </div>
    </div>
  );
}
