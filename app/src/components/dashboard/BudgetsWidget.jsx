import { Link } from 'react-router-dom';
import { Wallet2 } from 'lucide-react';
import { EmptyState, ProgressBar, Button } from '../ui/index.js';
import { formatarMoeda } from '../../utils/formatadores.js';
import styles from './BudgetsWidget.module.css';

export function BudgetsWidget({ orcamentos, gastosPorCategoria }) {
  if (orcamentos.length === 0) {
    return (
      <EmptyState
        icone={Wallet2}
        titulo="Nenhum orçamento definido"
        descricao="Defina limites por categoria para acompanhar seus gastos aqui."
        acao={
          <Link to="/orcamentos">
            <Button tamanho="pequeno">Criar orçamento</Button>
          </Link>
        }
      />
    );
  }

  return (
    <ul className={styles.lista}>
      {orcamentos.map((orcamento) => {
        const gasto = gastosPorCategoria[orcamento.categoria] || 0;
        const limite = Number(orcamento.limiteMensal);
        const percentual = limite > 0 ? Math.round((gasto / limite) * 100) : 0;
        const estourou = percentual > 100;

        return (
          <li key={orcamento.id} className={styles.item}>
            <div className={styles.cabecalho}>
              <span className={styles.categoria}>{orcamento.categoria}</span>
              <span className={`${styles.valores} ${estourou ? styles.estourado : ''}`}>
                {formatarMoeda(gasto)} de {formatarMoeda(limite)}
              </span>
            </div>
            <ProgressBar percentual={percentual} cor={estourou ? 'perigo' : percentual > 80 ? 'alerta' : 'primaria'} />
          </li>
        );
      })}
    </ul>
  );
}
