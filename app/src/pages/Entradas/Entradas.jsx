import { TrendingUp } from 'lucide-react';
import CrudPage from '../_shared/CrudPage.jsx';
import { Avatar } from '../../components/ui/index.js';
import { formatarData, formatarMoeda } from '../../utils/formatadores.js';
import { CategoriaComIcone } from '../../components/lancamentos/CategoriaComIcone.jsx';
import { useCategorias } from '../../contexts/CategoriasContext.jsx';

export default function Entradas() {
  const { categoriasEntrada, iconesEntrada } = useCategorias();

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
        opcoes: categoriasEntrada,
        iconePorValor: (valor) => iconesEntrada[valor],
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
