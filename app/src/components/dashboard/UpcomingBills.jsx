import { PartyPopper } from 'lucide-react';
import { EmptyState } from '../ui/index.js';
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
  const pessoa = nomeExibicao(perfil, usuario).split(' ')[0];

  if (vencimentos.length === 0) {
    return (
      <EmptyState icone={PartyPopper} titulo="Tudo em dia" descricao="Nenhuma conta ou parcela pendente este mês." />
    );
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
                onClick={() => aoPagar(item, pessoa)}
              >
                {pagando === item.id ? '...' : 'Pagar'}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
