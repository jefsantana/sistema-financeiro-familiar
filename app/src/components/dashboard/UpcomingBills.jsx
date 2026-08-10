import { useState } from 'react';
import { PartyPopper, Layers, Pin, CreditCard } from 'lucide-react';
import { EmptyState, ConfirmDialog } from '../ui/index.js';
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

  if (vencimentos.length === 0) {
    return (
      <EmptyState icone={PartyPopper} titulo="Tudo em dia" descricao="Nenhuma conta ou parcela pendente este mês." />
    );
  }

  return (
    <ul className={styles.lista}>
      {vencimentos.map((item) => {
        const status = textoStatus(item.diasRestantes);
        const IconeTipo = item.tipo === 'fatura' ? CreditCard : item.tipo === 'parcelamento' ? Layers : Pin;

        return (
          <li key={item.id} className={`${styles.item} ${status.classe}`}>
            <div>
              <p className={styles.descricao}>
                <IconeTipo size={14} className={styles.iconeTipo} /> {item.descricao}
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
                onClick={() => setParaPagar(item)}
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
        aoConfirmar={() => aoPagar(paraPagar, nomeExibicao(perfil, usuario).split(' ')[0])}
        titulo="Confirmar pagamento"
        mensagem={
          paraPagar
            ? `Confirma o pagamento de "${paraPagar.descricao}" no valor de ${formatarMoeda(paraPagar.valor)}? Isso vai debitar o valor do saldo.`
            : ''
        }
        textoConfirmar="Confirmar pagamento"
        variantePerigo={false}
      />
    </ul>
  );
}
