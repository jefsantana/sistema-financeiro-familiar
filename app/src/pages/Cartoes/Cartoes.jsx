import { CreditCard } from 'lucide-react';
import CrudPage from '../_shared/CrudPage.jsx';
import { formatarMoeda } from '../../utils/formatadores.js';

export default function Cartoes() {
  const config = {
    tabela: 'Cartoes',
    icone: CreditCard,
    tituloForm: '💳 Novo Cartão',
    tituloLista: '📋 Cartões cadastrados',
    textoVazioLista: 'Cadastre o primeiro cartão usando o formulário acima.',
    campos: [
      { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, placeholder: 'Ex: Nubank' },
      { nome: 'limite', rotulo: 'Limite (R$)', tipo: 'moeda', obrigatorio: true },
      { nome: 'diaFechamento', rotulo: 'Dia de fechamento', tipo: 'numero', obrigatorio: true, min: 1, max: 31 },
    ],
    colunas: [
      { chave: 'nome', rotulo: 'Nome' },
      { chave: 'limite', rotulo: 'Limite', numerica: true, render: (r) => formatarMoeda(r.limite) },
      { chave: 'diaFechamento', rotulo: 'Fechamento', render: (r) => `Dia ${r.diaFechamento}` },
    ],
  };

  return <CrudPage config={config} />;
}
