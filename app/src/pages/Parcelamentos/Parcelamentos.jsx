import { Layers } from 'lucide-react';
import CrudPage from '../_shared/CrudPage.jsx';
import { ProgressBar } from '../../components/ui/index.js';
import { useCrudMock } from '../../hooks/useCrudMock.js';
import { formatarMoeda } from '../../utils/formatadores.js';
import { CategoriaComIcone } from '../../components/lancamentos/CategoriaComIcone.jsx';
import { useCategorias } from '../../contexts/CategoriasContext.jsx';

export default function Parcelamentos() {
  const { registros: cartoes } = useCrudMock('Cartoes');
  const nomesCartoes = cartoes.map((c) => c.nome);
  const { categoriasGasto, iconesGasto } = useCategorias();

  const config = {
    tabela: 'Parcelamentos',
    icone: Layers,
    tituloForm: 'Novo Parcelamento',
    tituloLista: 'Parcelamentos cadastrados',
    textoVazioLista: 'Cadastre o primeiro parcelamento usando o formulário acima.',
    dica: 'Use para uma compra dividida em várias vezes, geralmente no cartão de crédito (ex: um notebook em 10x). Uma conta que se repete todo mês com o mesmo valor, como aluguel ou internet, vai em "Contas Fixas". Se a máquina cobrou juros pra parcelar, preencha "Valor original" com o preço à vista — assim o sistema mostra separado quanto foi de juros.',
    validar: (dados) => {
      if (Number(dados.parcelaAtual) > Number(dados.numeroParcelas)) {
        return 'A "Parcela atual" não pode ser maior que o "Nº de parcelas".';
      }
      if (dados.valorOriginal > 0 && dados.valorOriginal > dados.valorTotal) {
        return 'O "Valor original" não pode ser maior que o "Valor total" (o total já inclui os juros).';
      }
      return null;
    },
    campos: [
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true, placeholder: 'Ex: Notebook' },
      {
        nome: 'valorOriginal',
        rotulo: 'Valor original (à vista, opcional)',
        tipo: 'moeda',
        placeholder: 'Deixe em branco se não teve juros',
      },
      { nome: 'valorTotal', rotulo: 'Valor total parcelado (R$)', tipo: 'moeda', obrigatorio: true },
      { nome: 'numeroParcelas', rotulo: 'Nº de parcelas', tipo: 'numero', obrigatorio: true, min: 1 },
      { nome: 'parcelaAtual', rotulo: 'Parcela atual', tipo: 'numero', obrigatorio: true, min: 1 },
      { nome: 'diaVencimento', rotulo: 'Dia do vencimento', tipo: 'numero', obrigatorio: true, min: 1, max: 31 },
      { nome: 'cartao', rotulo: 'Cartão (opcional)', tipo: 'select', opcoes: nomesCartoes },
      {
        nome: 'categoria',
        rotulo: 'Categoria',
        tipo: 'select',
        obrigatorio: true,
        opcoes: categoriasGasto,
        iconePorValor: (valor) => iconesGasto[valor],
      },
    ],
    colunas: [
      { chave: 'descricao', rotulo: 'Descrição' },
      { chave: 'categoria', rotulo: 'Categoria', render: (r) => <CategoriaComIcone nome={r.categoria} /> },
      { chave: 'cartao', rotulo: 'Cartão', render: (r) => r.cartao || '-' },
      { chave: 'valorTotal', rotulo: 'Valor Total', numerica: true, render: (r) => formatarMoeda(r.valorTotal) },
      {
        chave: 'juros',
        rotulo: 'Juros',
        numerica: true,
        render: (r) => {
          const juros = Number(r.valorOriginal) > 0 ? Number(r.valorTotal) - Number(r.valorOriginal) : 0;
          if (juros <= 0) return <span style={{ color: 'var(--cor-texto-secundario)' }}>—</span>;
          return <span className="valor-negativo">{formatarMoeda(juros)}</span>;
        },
      },
      { chave: 'diaVencimento', rotulo: 'Vencimento', render: (r) => `Dia ${r.diaVencimento || '-'}` },
      {
        chave: 'progresso',
        rotulo: 'Progresso',
        render: (r) => {
          const numeroParcelas = Number(r.numeroParcelas);
          const parcelaAtual = Number(r.parcelaAtual);
          const valorParcela = Number(r.valorTotal) / numeroParcelas;
          const parcelasRestantes = Math.max(0, numeroParcelas - parcelaAtual + 1);
          const saldoDevedor = valorParcela * parcelasRestantes;
          const percentual = Math.min(100, Math.round((parcelaAtual / numeroParcelas) * 100));
          return (
            <div style={{ minWidth: 140 }}>
              <p style={{ fontSize: '0.8rem', marginBottom: 4 }}>
                {r.parcelaAtual}/{r.numeroParcelas} · {formatarMoeda(saldoDevedor)} restando
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
