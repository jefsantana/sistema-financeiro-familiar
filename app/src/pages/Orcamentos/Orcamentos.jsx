import { useMemo } from 'react';
import { Wallet } from 'lucide-react';
import CrudPage from '../_shared/CrudPage.jsx';
import { ProgressBar } from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { formatarMoeda } from '../../utils/formatadores.js';
import { mesAnoDe, obterMesAno } from '../../utils/financeiro.js';
import { CategoriaComIcone } from '../../components/lancamentos/CategoriaComIcone.jsx';
import { useCategorias } from '../../contexts/CategoriasContext.jsx';

export default function Orcamentos() {
  const { registros: gastos } = useCrudMock('Gastos');
  const { categoriasGasto, iconesGasto } = useCategorias();
  const mesAtual = mesAnoDe(new Date());

  const gastoPorCategoria = useMemo(() => {
    const mapa = {};
    gastos
      .filter((g) => obterMesAno(g.data) === mesAtual)
      .forEach((g) => {
        mapa[g.categoria] = (mapa[g.categoria] || 0) + Number(g.valor);
      });
    return mapa;
  }, [gastos, mesAtual]);

  const config = {
    tabela: 'Orcamentos',
    icone: Wallet,
    tituloForm: 'Novo Orçamento',
    tituloLista: 'Orçamentos deste mês',
    textoVazioLista: 'Defina um limite mensal por categoria usando o formulário acima.',
    campos: [
      {
        nome: 'categoria',
        rotulo: 'Categoria',
        tipo: 'select',
        obrigatorio: true,
        opcoes: categoriasGasto,
        iconePorValor: (valor) => iconesGasto[valor],
      },
      { nome: 'limiteMensal', rotulo: 'Limite mensal (R$)', tipo: 'moeda', obrigatorio: true },
    ],
    colunas: [
      { chave: 'categoria', rotulo: 'Categoria', render: (r) => <CategoriaComIcone nome={r.categoria} /> },
      { chave: 'limiteMensal', rotulo: 'Limite', numerica: true, render: (r) => formatarMoeda(r.limiteMensal) },
      {
        chave: 'gasto',
        rotulo: 'Gasto no mês',
        numerica: true,
        render: (r) => {
          const gasto = gastoPorCategoria[r.categoria] || 0;
          const estourou = gasto > Number(r.limiteMensal);
          return <span className={estourou ? 'valor-negativo' : ''}>{formatarMoeda(gasto)}</span>;
        },
      },
      {
        chave: 'progresso',
        rotulo: 'Progresso',
        render: (r) => {
          const gasto = gastoPorCategoria[r.categoria] || 0;
          const limiteNum = Number(r.limiteMensal);
          const percentual = limiteNum > 0 ? Math.round((gasto / limiteNum) * 100) : 0;
          const estourou = percentual > 100;
          return (
            <div style={{ minWidth: 140 }}>
              <p style={{ fontSize: '0.8rem', marginBottom: 4 }}>{percentual}%</p>
              <ProgressBar percentual={percentual} cor={estourou ? 'perigo' : percentual > 80 ? 'alerta' : 'primaria'} />
            </div>
          );
        },
      },
    ],
  };

  return <CrudPage config={config} />;
}
