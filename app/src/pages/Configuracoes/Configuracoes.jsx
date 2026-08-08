import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Card, Button, Avatar, ConfirmDialog } from '../../components/ui/index.js';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { limparDadosExemplo } from '../../services/mockData.js';
import { nomeExibicao } from '../../utils/formatadores.js';
import styles from './Configuracoes.module.css';

export default function Configuracoes() {
  const { ehEscuro, alternarTema } = useTheme();
  const { perfil, usuario, sair } = useAuth();
  const toast = useToast();
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false);

  async function aoLimparDados() {
    await limparDadosExemplo();
    toast.sucesso('Todos os lançamentos foram apagados. Recarregando...');
    setTimeout(() => window.location.reload(), 900);
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
            <Avatar nome={nomeExibicao(perfil, usuario)} />
            <div>
              <p className={styles.rotuloLinha}>{nomeExibicao(perfil, usuario)}</p>
              <p className={styles.descricaoLinha}>{usuario?.email}</p>
            </div>
          </div>
          <Button variante="secundario" tamanho="pequeno" onClick={sair}>
            Sair
          </Button>
        </div>
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

      <Card className={styles.secao}>
        <div className={styles.linha}>
          <div>
            <p className={styles.rotuloLinha}>Dados de exemplo</p>
            <p className={styles.descricaoLinha}>
              Este ambiente ainda usa dados de demonstração salvos no navegador. Ao conectar ao Supabase, essa opção deixará de existir.
            </p>
          </div>
          <Button variante="secundario" tamanho="pequeno" onClick={() => setConfirmandoLimpeza(true)}>
            Limpar dados
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        aberto={confirmandoLimpeza}
        aoFechar={() => setConfirmandoLimpeza(false)}
        aoConfirmar={aoLimparDados}
        titulo="Apagar todos os dados de exemplo?"
        mensagem="Isso apaga permanentemente todas as entradas, gastos, categorias, contas fixas, parcelamentos, cartões, metas e transferências salvos neste navegador. Não pode ser desfeito."
        textoConfirmar="Apagar tudo"
      />
    </div>
  );
}
