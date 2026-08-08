import { FileText } from 'lucide-react';
import CrudPage from '../_shared/CrudPage.jsx';
import { formatarMoeda } from '../../utils/formatadores.js';
import { CATEGORIAS_GASTO_FIXAS } from '../../utils/constantes.js';
import { ICONES_CATEGORIA_GASTO } from '../../utils/icones.js';
import { CategoriaComIcone } from '../../components/lancamentos/CategoriaComIcone.jsx';

export default function ContasFixas() {
  const config = {
    tabela: 'ContasFixas',
    icone: FileText,
    tituloForm: 'Nova Conta Fixa',
    tituloLista: 'Contas fixas cadastradas',
    textoVazioLista: 'Cadastre a primeira conta fixa usando o formulário acima.',
    campos: [
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true, placeholder: 'Ex: Aluguel' },
      { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'moeda', obrigatorio: true },
      { nome: 'diaVencimento', rotulo: 'Dia de vencimento', tipo: 'numero', obrigatorio: true, min: 1, max: 31 },
      {
        nome: 'categoria',
        rotulo: 'Categoria',
        tipo: 'select',
        obrigatorio: true,
        opcoes: CATEGORIAS_GASTO_FIXAS,
        iconePorValor: (valor) => ICONES_CATEGORIA_GASTO[valor],
      },
    ],
    colunas: [
      { chave: 'descricao', rotulo: 'Descrição' },
      { chave: 'categoria', rotulo: 'Categoria', render: (r) => <CategoriaComIcone nome={r.categoria} /> },
      { chave: 'diaVencimento', rotulo: 'Vencimento', render: (r) => `Dia ${r.diaVencimento}` },
      { chave: 'valor', rotulo: 'Valor', numerica: true, render: (r) => <span className="valor-negativo">{formatarMoeda(r.valor)}</span> },
    ],
  };

  return <CrudPage config={config} />;
}
