import { Layers } from 'lucide-react';
import CrudPage from '../_shared/CrudPage.jsx';
import { ProgressBar } from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { formatarMoeda } from '../../utils/formatadores.js';

export default function Parcelamentos() {
  const { registros: cartoes } = useCrudMock('Cartoes');
  const nomesCartoes = cartoes.map((c) => c.nome);

  const config = {
    tabela: 'Parcelamentos',
    icone: Layers,
    tituloForm: '🧩 Novo Parcelamento',
    tituloLista: '📋 Parcelamentos cadastrados',
    textoVazioLista: 'Cadastre o primeiro parcelamento usando o formulário acima.',
    campos: [
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true, placeholder: 'Ex: Notebook' },
      { nome: 'valorTotal', rotulo: 'Valor total (R$)', tipo: 'moeda', obrigatorio: true },
      { nome: 'numeroParcelas', rotulo: 'Nº de parcelas', tipo: 'numero', obrigatorio: true, min: 1 },
      { nome: 'parcelaAtual', rotulo: 'Parcela atual', tipo: 'numero', obrigatorio: true, min: 1 },
      { nome: 'diaVencimento', rotulo: 'Dia do vencimento', tipo: 'numero', obrigatorio: true, min: 1, max: 31 },
      { nome: 'cartao', rotulo: 'Cartão (opcional)', tipo: 'select', opcoes: nomesCartoes },
    ],
    colunas: [
      { chave: 'descricao', rotulo: 'Descrição' },
      { chave: 'cartao', rotulo: 'Cartão', render: (r) => r.cartao || '-' },
      { chave: 'valorTotal', rotulo: 'Valor Total', numerica: true, render: (r) => formatarMoeda(r.valorTotal) },
      { chave: 'diaVencimento', rotulo: 'Vencimento', render: (r) => `Dia ${r.diaVencimento || '-'}` },
      {
        chave: 'progresso',
        rotulo: 'Progresso',
        render: (r) => {
          const percentual = Math.min(100, Math.round((Number(r.parcelaAtual) / Number(r.numeroParcelas)) * 100));
          return (
            <div style={{ minWidth: 120 }}>
              <p style={{ fontSize: '0.8rem', marginBottom: 4 }}>
                {r.parcelaAtual}/{r.numeroParcelas}
              </p>
              <ProgressBar percentual={percentual} />
            </div>
          );
        },
      },
    ],
  };

  return <CrudPage config={config} />;
}
