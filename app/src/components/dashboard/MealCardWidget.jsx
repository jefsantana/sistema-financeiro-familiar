import { UtensilsCrossed, TrendingUp, TrendingDown } from 'lucide-react';
import { EmptyState } from '../ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { formatarMoeda, formatarData } from '../../utils/formatadores.js';
import styles from './MealCardWidget.module.css';

const LIMITE_MOVIMENTOS_RECENTES = 4;

// Widget isolado do resto do Dashboard: busca seus próprios dados
// (cartão alimentação e movimentos) e não entra em nenhuma soma de
// saldo geral, gastos do mês ou qualquer outro agregado financeiro —
// é uma conta separada (Ticket, VR, Alelo...), não dinheiro em conta
// nem cartão de crédito comum.
export function MealCardWidget() {
  const { registros: cartoes, carregando: carregandoCartoes } = useCrudMock('CartoesAlimentacao');
  const { registros: movimentos, carregando: carregandoMovimentos } = useCrudMock('MovimentosCartaoAlimentacao');

  if (carregandoCartoes || carregandoMovimentos) return null;

  if (cartoes.length === 0) {
    return (
      <EmptyState
        icone={UtensilsCrossed}
        titulo="Nenhum cartão alimentação"
        descricao="Registre um gasto ou recarga do Ticket/VR pelo WhatsApp ou pela página Cartão Alimentação."
      />
    );
  }

  const movimentosRecentes = [...movimentos]
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .slice(0, LIMITE_MOVIMENTOS_RECENTES);

  return (
    <div className={styles.container}>
      <div className={styles.cartoes}>
        {cartoes.map((cartao) => {
          const saldoNegativo = Number(cartao.saldoAtual) < 0;
          return (
            <div key={cartao.id} className={styles.cartao}>
              <span className={styles.nomeCartao}>{cartao.nome}</span>
              <span className={`${styles.saldo} ${saldoNegativo ? styles.saldoNegativo : ''}`}>
                {formatarMoeda(cartao.saldoAtual)}
              </span>
            </div>
          );
        })}
      </div>

      {movimentosRecentes.length > 0 && (
        <ul className={styles.lista}>
          {movimentosRecentes.map((mov) => {
            const ehRecarga = mov.tipo === 'recarga';
            return (
              <li key={mov.id} className={styles.item}>
                <span className={`${styles.icone} ${ehRecarga ? styles.recarga : styles.gasto}`}>
                  {ehRecarga ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                </span>
                <div className={styles.info}>
                  <p className={styles.descricao}>{mov.descricao}</p>
                  <span className={styles.data}>{formatarData(mov.data)}</span>
                </div>
                <span className={`${styles.valor} ${ehRecarga ? styles.valorRecarga : styles.valorGasto}`}>
                  {ehRecarga ? '+' : '-'} {formatarMoeda(mov.valor)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
