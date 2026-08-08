import { Tag, TrendingUp } from 'lucide-react';
import CrudPage from '../_shared/CrudPage.jsx';
import { Card } from '../../components/ui/index.js';
import { CATEGORIAS_GASTO_FIXAS } from '../../utils/constantes.js';
import { ICONES_CATEGORIA_GASTO } from '../../utils/icones.js';
import styles from './Categorias.module.css';

export default function Categorias() {
  const configEntrada = {
    tabela: 'Categorias',
    icone: TrendingUp,
    tituloForm: 'Nova categoria de entrada',
    tituloLista: 'Categorias de entrada',
    textoVazioLista: 'Cadastre a primeira categoria de entrada usando o formulário acima.',
    dadosFixos: { tipo: 'entrada' },
    filtrar: (registro) => registro.tipo === 'entrada',
    campos: [{ nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, placeholder: 'Ex: Salário' }],
    colunas: [{ chave: 'nome', rotulo: 'Nome' }],
  };

  return (
    <div>
      <Card className={styles.secaoFixa}>
        <div className={styles.cabecalhoFixo}>
          <Tag size={18} style={{ color: 'var(--cor-primaria)' }} />
          <div>
            <h2 className={styles.titulo}>Categorias de gasto</h2>
            <p className={styles.descricao}>
              Essa lista é fixa e não pode ser editada — escolha uma delas ao registrar um gasto.
            </p>
          </div>
        </div>
        <div className={styles.grade}>
          {CATEGORIAS_GASTO_FIXAS.map((nome) => {
            const Icone = ICONES_CATEGORIA_GASTO[nome];
            return (
              <div key={nome} className={styles.itemFixo}>
                <Icone size={16} className={styles.iconeItem} />
                {nome}
              </div>
            );
          })}
        </div>
      </Card>

      <CrudPage config={configEntrada} />
    </div>
  );
}
