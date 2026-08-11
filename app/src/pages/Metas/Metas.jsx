import { Target } from 'lucide-react';
import CrudPage from '../_shared/CrudPage.jsx';
import { ProgressBar } from '../../components/ui/index.js';
import { formatarMoeda } from '../../utils/formatadores.js';

export default function Metas() {
  const config = {
    tabela: 'Metas',
    icone: Target,
    tituloForm: 'Nova Meta',
    tituloLista: 'Metas cadastradas',
    textoVazioLista: 'Cadastre a primeira meta usando o formulário acima.',
    campos: [
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true, placeholder: 'Ex: Viagem' },
      { nome: 'valorAlvo', rotulo: 'Valor alvo (R$)', tipo: 'moeda', obrigatorio: true },
      { nome: 'valorAtual', rotulo: 'Valor já guardado (R$)', tipo: 'moeda' },
    ],
    colunas: [
      { chave: 'descricao', rotulo: 'Descrição' },
      { chave: 'valorAlvo', rotulo: 'Valor Alvo', numerica: true, render: (r) => formatarMoeda(r.valorAlvo) },
      { chave: 'valorAtual', rotulo: 'Guardado', numerica: true, render: (r) => formatarMoeda(r.valorAtual) },
      {
        chave: 'progresso',
        rotulo: 'Progresso',
        render: (r) => {
          const percentual = Math.min(100, Math.round((Number(r.valorAtual) / Number(r.valorAlvo)) * 100) || 0);
          return (
            <div style={{ minWidth: 140 }}>
              <p style={{ fontSize: '0.8rem', marginBottom: 4 }}>{percentual}%</p>
              <ProgressBar percentual={percentual} cor="sucesso" />
            </div>
          );
        },
      },
    ],
  };

  return <CrudPage config={config} />;
}
