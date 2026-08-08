import { TrendingUp } from 'lucide-react';
import CrudPage from '../_shared/CrudPage.jsx';
import { Avatar } from '../../components/ui/index.js';
import { formatarData, formatarMoeda } from '../../utils/formatadores.js';
import { CATEGORIAS_ENTRADA_FIXAS } from '../../utils/constantes.js';
import { ICONES_CATEGORIA_ENTRADA } from '../../utils/icones.js';
import { CategoriaComIcone } from '../../components/lancamentos/CategoriaComIcone.jsx';

export default function Entradas() {
  const config = {
    tabela: 'Entradas',
    icone: TrendingUp,
    tituloForm: 'Nova Entrada',
    tituloLista: 'Entradas cadastradas',
    textoVazioLista: 'Cadastre a primeira entrada usando o formulário acima.',
    campos: [
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true, placeholder: 'Ex: Salário' },
      { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'moeda', obrigatorio: true },
      { nome: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
      {
        nome: 'categoria',
        rotulo: 'Categoria',
        tipo: 'select',
        obrigatorio: true,
        opcoes: CATEGORIAS_ENTRADA_FIXAS,
        iconePorValor: (valor) => ICONES_CATEGORIA_ENTRADA[valor],
      },
    ],
    colunas: [
      { chave: 'descricao', rotulo: 'Descrição' },
      { chave: 'categoria', rotulo: 'Categoria', render: (r) => <CategoriaComIcone nome={r.categoria} /> },
      { chave: 'pessoa', rotulo: 'Pessoa', render: (r) => (r.pessoa ? <Avatar nome={r.pessoa} tamanho="pequeno" /> : '-') },
      { chave: 'data', rotulo: 'Data', render: (r) => formatarData(r.data) },
      { chave: 'valor', rotulo: 'Valor', numerica: true, render: (r) => <span className="valor-positivo">{formatarMoeda(r.valor)}</span> },
    ],
  };

  return <CrudPage config={config} />;
}
