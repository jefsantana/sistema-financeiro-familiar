import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Card } from '../ui/index.js';
import { formatarMoeda } from '../../utils/formatadores.js';
import { useEhCelular } from '../../hooks/useMediaQuery.js';
import styles from './StatCard.module.css';

export function StatCard({ icone: Icone, corIcone = 'primaria', rotulo, valor, tendencia, legenda, destaque = false }) {
  const ehCelular = useEhCelular();

  return (
    <Card
      comHover
      preenchimento={ehCelular ? 'pequeno' : 'normal'}
      className={`${styles.card} ${destaque ? styles.destaque : ''}`}
    >
      <div className={styles.topo}>
        <p className={styles.rotulo}>{rotulo}</p>
        {Icone && (
          <div className={`${styles.icone} ${destaque ? styles.iconeDestaque : styles[corIcone]}`}>
            <Icone />
          </div>
        )}
      </div>

      <p className={styles.valor}>{formatarMoeda(valor)}</p>

      {tendencia ? (
        <p
          className={`${styles.tendencia} ${
            destaque ? styles.tendenciaDestaque : tendencia.bom ? styles.tendenciaBoa : styles.tendenciaRuim
          }`}
        >
          {tendencia.subiu ? <ArrowUp /> : <ArrowDown />}
          {tendencia.percentual}% vs mês passado
        </p>
      ) : legenda ? (
        <p className={`${styles.tendencia} ${destaque ? styles.tendenciaDestaque : styles.tendenciaNeutra}`}>
          <Minus />
          {legenda}
        </p>
      ) : null}
    </Card>
  );
}
