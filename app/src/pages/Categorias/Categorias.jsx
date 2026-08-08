import { Tag, TrendingUp } from 'lucide-react';
import { Card } from '../../components/ui/index.js';
import { CATEGORIAS_GASTO_FIXAS, CATEGORIAS_ENTRADA_FIXAS } from '../../utils/constantes.js';
import { ICONES_CATEGORIA_GASTO, ICONES_CATEGORIA_ENTRADA } from '../../utils/icones.js';
import styles from './Categorias.module.css';

function ListaFixa({ icone: IconeSecao, titulo, descricao, categorias, icones }) {
  return (
    <Card className={styles.secaoFixa}>
      <div className={styles.cabecalhoFixo}>
        <IconeSecao size={18} style={{ color: 'var(--cor-primaria)' }} />
        <div>
          <h2 className={styles.titulo}>{titulo}</h2>
          <p className={styles.descricao}>{descricao}</p>
        </div>
      </div>
      <div className={styles.grade}>
        {categorias.map((nome) => {
          const Icone = icones[nome];
          return (
            <div key={nome} className={styles.itemFixo}>
              <Icone size={16} className={styles.iconeItem} />
              {nome}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Categorias() {
  return (
    <div>
      <ListaFixa
        icone={Tag}
        titulo="Categorias de gasto"
        descricao="Essa lista é fixa e não pode ser editada — escolha uma delas ao registrar um gasto."
        categorias={CATEGORIAS_GASTO_FIXAS}
        icones={ICONES_CATEGORIA_GASTO}
      />

      <ListaFixa
        icone={TrendingUp}
        titulo="Categorias de entrada"
        descricao="Essa lista é fixa e não pode ser editada — escolha uma delas ao registrar uma entrada."
        categorias={CATEGORIAS_ENTRADA_FIXAS}
        icones={ICONES_CATEGORIA_ENTRADA}
      />
    </div>
  );
}
