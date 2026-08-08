import { Tag, TrendingUp, TrendingDown } from 'lucide-react';
import CrudPage from '../_shared/CrudPage.jsx';
import { Badge } from '../../components/ui/index.js';

export default function Categorias() {
  const config = {
    tabela: 'Categorias',
    icone: Tag,
    tituloForm: 'Nova Categoria',
    tituloLista: 'Categorias cadastradas',
    textoVazioLista: 'Cadastre a primeira categoria usando o formulário acima.',
    campos: [
      { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, placeholder: 'Ex: Alimentação' },
      {
        nome: 'tipo',
        rotulo: 'Tipo',
        tipo: 'select',
        obrigatorio: true,
        opcoes: [
          { valor: 'entrada', rotulo: 'Entrada' },
          { valor: 'gasto', rotulo: 'Gasto' },
        ],
      },
    ],
    colunas: [
      { chave: 'nome', rotulo: 'Nome' },
      {
        chave: 'tipo',
        rotulo: 'Tipo',
        render: (r) => (
          <Badge cor={r.tipo === 'entrada' ? 'sucesso' : 'perigo'}>
            {r.tipo === 'entrada' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {r.tipo === 'entrada' ? 'Entrada' : 'Gasto'}
          </Badge>
        ),
      },
    ],
  };

  return <CrudPage config={config} />;
}
