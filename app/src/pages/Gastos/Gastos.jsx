import { TrendingDown } from 'lucide-react';
import CrudPage from '../_shared/CrudPage.jsx';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { Avatar } from '../../components/ui/index.js';
import { formatarData, formatarMoeda } from '../../utils/formatadores.js';
import { CATEGORIAS_GASTO_FIXAS } from '../../utils/constantes.js';
import { ICONES_CATEGORIA_GASTO } from '../../utils/icones.js';
import { CategoriaComIcone } from '../../components/lancamentos/CategoriaComIcone.jsx';
import { criarCompraNoCartao } from '../../utils/comprasCartao.js';

export default function Gastos() {
  const { registros: cartoes } = useCrudMock('Cartoes');
  const nomesCartoes = cartoes.map((c) => c.nome);
  const toast = useToast();

  const config = {
    tabela: 'Gastos',
    icone: TrendingDown,
    tituloForm: 'Novo Gasto',
    tituloLista: 'Gastos cadastrados',
    textoVazioLista: 'Cadastre o primeiro gasto usando o formulário acima.',
    dica: 'Escolheu um cartão de crédito? A compra entra na fatura do cartão e só vira gasto quando a fatura for paga, no Dashboard — não conta no seu saldo agora.',
    criarAlternativo: async ({ dados, familiaId, pessoa }) => {
      if (!dados.cartao) return false;
      try {
        await criarCompraNoCartao({
          descricao: dados.descricao,
          valor: dados.valor,
          data: dados.data,
          categoria: dados.categoria,
          cartao: dados.cartao,
          pessoa,
          familiaId,
          cartoes,
        });
        toast.sucesso('Compra lançada na fatura do cartão');
        return true;
      } catch (erro) {
        toast.erro('Não foi possível salvar. Tente novamente.');
        throw erro;
      }
    },
    campos: [
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true, placeholder: 'Ex: Supermercado' },
      { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'moeda', obrigatorio: true },
      { nome: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
      {
        nome: 'categoria',
        rotulo: 'Categoria',
        tipo: 'select',
        obrigatorio: true,
        opcoes: CATEGORIAS_GASTO_FIXAS,
        iconePorValor: (valor) => ICONES_CATEGORIA_GASTO[valor],
      },
      { nome: 'cartao', rotulo: 'Cartão (opcional)', tipo: 'select', opcoes: nomesCartoes },
    ],
    colunas: [
      { chave: 'descricao', rotulo: 'Descrição' },
      { chave: 'categoria', rotulo: 'Categoria', render: (r) => <CategoriaComIcone nome={r.categoria} /> },
      { chave: 'cartao', rotulo: 'Cartão', render: (r) => r.cartao || '-' },
      { chave: 'pessoa', rotulo: 'Pessoa', render: (r) => (r.pessoa ? <Avatar nome={r.pessoa} tamanho="pequeno" /> : '-') },
      { chave: 'data', rotulo: 'Data', render: (r) => formatarData(r.data) },
      { chave: 'valor', rotulo: 'Valor', numerica: true, render: (r) => <span className="valor-negativo">{formatarMoeda(r.valor)}</span> },
    ],
  };

  return <CrudPage config={config} />;
}
