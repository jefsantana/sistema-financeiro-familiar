import { useState } from 'react';
import { PartyPopper } from 'lucide-react';
import { EmptyState, ConfirmDialog } from '../ui/index.js';
import { SeletorPessoa } from '../lancamentos/SeletorPessoa.jsx';
import { formatarMoeda, nomeExibicao } from '../../utils/formatadores.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import styles from './UpcomingBills.module.css';

function textoStatus(diasRestantes) {
  if (diasRestantes < 0) return { classe: styles.vencida, texto: `Vencida há ${Math.abs(diasRestantes)} dia(s)` };
  if (diasRestantes === 0) return { classe: styles.hoje, texto: 'Vence hoje' };
  if (diasRestantes <= 5) return { classe: styles.proxima, texto: `Vence em ${diasRestantes} dia(s)` };
  return { classe: '', texto: `Vence em ${diasRestantes} dias` };
}

export function UpcomingBills({ vencimentos, aoPagar, pagando }) {
  const { perfil, usuario } = useAuth();
  const [paraPagar, setParaPagar] = useState(null);
  const [pessoa, setPessoa] = useState('');

  if (vencimentos.length === 0) {
    return (
      <EmptyState icone={PartyPopper} titulo="Tudo em dia" descricao="Nenhuma conta ou parcela pendente este mês." />
    );
  }

  function abrirConfirmacao(item) {
    setPessoa(nomeExibicao(perfil, usuario).split(' ')[0]);
    setParaPagar(item);
  }

  return (
    <ul className={styles.lista}>
      {vencimentos.map((item) => {
        const status = textoStatus(item.diasRestantes);
        const rotulo = item.tipo === 'parcelamento' ? '🧩' : '📌';

        return (
          <li key={item.id} className={`${styles.item} ${status.classe}`}>
            <div>
              <p className={styles.descricao}>
                {rotulo} {item.descricao}
              </p>
              <p className={styles.info}>
                {status.texto} · {formatarMoeda(item.valor)}
              </p>
            </div>
            <div className={styles.acoes}>
              <button
                type="button"
                className={styles.botaoPagar}
                disabled={pagando === item.id}
                onClick={() => abrirConfirmacao(item)}
              >
                {pagando === item.id ? '...' : 'Pagar'}
              </button>
            </div>
          </li>
        );
      })}

      <ConfirmDialog
        aberto={Boolean(paraPagar)}
        aoFechar={() => setParaPagar(null)}
        aoConfirmar={() => aoPagar(paraPagar, pessoa)}
        titulo="Confirmar pagamento"
        mensagem={
          paraPagar
            ? `Confirma o pagamento de "${paraPagar.descricao}" no valor de ${formatarMoeda(paraPagar.valor)}? Isso vai debitar o valor do saldo.`
            : ''
        }
        textoConfirmar="Confirmar pagamento"
        variantePerigo={false}
      >
        <SeletorPessoa rotulo="Quem pagou?" valor={pessoa} aoSelecionar={setPessoa} />
      </ConfirmDialog>
    </ul>
  );
}
