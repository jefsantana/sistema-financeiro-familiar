import { TrendingDown } from 'lucide-react';
import CrudPage from '../_shared/CrudPage.jsx';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { Avatar } from '../../components/ui/index.js';
import { formatarData, formatarMoeda } from '../../utils/formatadores.js';
import { CATEGORIAS_GASTO_FIXAS } from '../../utils/constantes.js';

export default function Gastos() {
  const { registros: cartoes } = useCrudMock('Cartoes');
  const categoriasGasto = CATEGORIAS_GASTO_FIXAS.map((c) => ({ valor: c.nome, rotulo: `${c.emoji} ${c.nome}` }));
  const nomesCartoes = cartoes.map((c) => c.nome);

  const config = {
    tabela: 'Gastos',
    icone: TrendingDown,
    tituloForm: 'Novo Gasto',
    tituloLista: 'Gastos cadastrados',
    textoVazioLista: 'Cadastre o primeiro gasto usando o formulário acima.',
    campos: [
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true, placeholder: 'Ex: Supermercado' },
      { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'moeda', obrigatorio: true },
      { nome: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
      { nome: 'categoria', rotulo: 'Categoria', tipo: 'select', obrigatorio: true, opcoes: categoriasGasto },
      { nome: 'cartao', rotulo: 'Cartão (opcional)', tipo: 'select', opcoes: nomesCartoes },
    ],
    colunas: [
      { chave: 'descricao', rotulo: 'Descrição' },
      { chave: 'categoria', rotulo: 'Categoria' },
      { chave: 'cartao', rotulo: 'Cartão', render: (r) => r.cartao || '-' },
      { chave: 'pessoa', rotulo: 'Pessoa', render: (r) => (r.pessoa ? <Avatar nome={r.pessoa} tamanho="pequeno" /> : '-') },
      { chave: 'data', rotulo: 'Data', render: (r) => formatarData(r.data) },
      { chave: 'valor', rotulo: 'Valor', numerica: true, render: (r) => <span className="valor-negativo">{formatarMoeda(r.valor)}</span> },
    ],
  };

  return <CrudPage config={config} />;
}
